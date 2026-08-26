import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "CATALOG_MANAGER")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "orders";
  const dateStr = new Date().toISOString().slice(0, 10);

  let csvContent = "";
  let filename = `vaishnavi-${type}-${dateStr}.csv`;

  if (type === "orders") {
    const orders = await prisma.order.findMany({
      include: {
        user: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Order ID",
      "Date",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Status",
      "Payment Method",
      "Subtotal (INR)",
      "Coupon Code",
      "Discount (INR)",
      "Total Amount (INR)",
      "Shipping City",
      "Shipping State",
      "Shipping Pincode",
      "Items Count",
    ];

    const rows = orders.map((order) => {
      let addr: any = {};
      try {
        addr = JSON.parse(order.shippingAddress);
      } catch (_) {}

      return [
        order.id,
        new Date(order.createdAt).toISOString(),
        addr.fullName || order.user?.name || "",
        order.user?.email || "",
        addr.phone || order.user?.phone || "",
        order.status,
        order.paymentMethod,
        order.totalAmount + (order.discountAmount || 0),
        order.couponCode || "",
        order.discountAmount || 0,
        order.totalAmount,
        addr.city || "",
        addr.state || "",
        addr.pincode || "",
        order.items.reduce((s, i) => s + i.quantity, 0),
      ].map(escapeCSV).join(",");
    });

    csvContent = [headers.join(","), ...rows].join("\n");
  } else if (type === "inventory") {
    const variants = await prisma.productVariant.findMany({
      include: {
        product: {
          include: {
            category: true,
            brand: true,
          },
        },
      },
      orderBy: { stock: "asc" },
    });

    const headers = [
      "Variant ID",
      "SKU",
      "Product Title",
      "Variant Name",
      "Category",
      "Brand",
      "Stock Count",
      "Stock Status",
      "Price (INR)",
      "HSN Code",
      "Available",
    ];

    const rows = variants.map((v) => [
      v.id,
      v.sku || "",
      v.product.title,
      v.title || "Default",
      v.product.category?.name || "",
      v.product.brand?.name || "",
      v.stock,
      v.stock === 0 ? "OUT_OF_STOCK" : v.stock <= 10 ? "LOW_STOCK" : "IN_STOCK",
      v.price ?? v.product.basePrice,
      v.product.hsnCode || v.product.category?.hsnCode || "8541",
      v.isAvailable ? "YES" : "NO",
    ].map(escapeCSV).join(","));

    csvContent = [headers.join(","), ...rows].join("\n");
  } else if (type === "leads") {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Lead ID",
      "Date",
      "Name",
      "Phone",
      "Email",
      "City",
      "Pincode",
      "Product / Inquiry",
      "Status",
      "Details / Notes",
    ];

    const rows = leads.map((l) => [
      l.id,
      new Date(l.createdAt).toISOString(),
      l.name,
      l.phone,
      l.email || "",
      l.city || "",
      l.pincode || "",
      l.productName || "General Solar Inquiry",
      l.status,
      l.message || "",
    ].map(escapeCSV).join(","));

    csvContent = [headers.join(","), ...rows].join("\n");
  } else {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        brand: true,
        variants: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Product ID",
      "Title",
      "Category",
      "Brand",
      "Base Price (INR)",
      "Checkout Mode",
      "Stock Mode",
      "Total Stock",
      "HSN Code",
      "GST Rate (%)",
    ];

    const rows = products.map((p) => [
      p.id,
      p.title,
      p.category?.name || "",
      p.brand?.name || "",
      p.basePrice,
      p.checkoutMode,
      p.stockMode,
      p.variants.reduce((s, v) => s + v.stock, 0),
      p.hsnCode || p.category?.hsnCode || "8541",
      p.gstRate || p.category?.gstRate || 18,
    ].map(escapeCSV).join(","));

    csvContent = [headers.join(","), ...rows].join("\n");
  }

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
