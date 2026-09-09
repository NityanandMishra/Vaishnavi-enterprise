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

  } else if (type === "attributes") {
    const attributes = await prisma.attribute.findMany({
      where: { deletedAt: null },
      include: {
        values: { where: { deletedAt: null }, orderBy: { displayOrder: "asc" } },
        categoryAttributes: { include: { category: true } },
      },
      orderBy: { name: "asc" },
    });

    const headers = [
      "Attribute ID",
      "Name",
      "Code",
      "Input Type",
      "Variant Defining",
      "Values Count",
      "Values",
      "Attached Categories",
      "Active Status",
    ];

    const rows = attributes.map((a) => [
      a.id,
      a.name,
      a.code,
      a.inputType,
      a.isVariantDefining ? "YES" : "NO",
      a.values.length,
      a.values.map((v) => v.label).join(" | "),
      a.categoryAttributes.map((ca) => ca.category.name).join(" | "),
      a.isActive ? "ACTIVE" : "INACTIVE",
    ].map(escapeCSV).join(","));

    csvContent = [headers.join(","), ...rows].join("\n");
  } else if (type === "products-template") {
    filename = "vaishnavi-products-import-template.csv";
    const headers = [
      "Title",
      "Slug",
      "Category",
      "Brand",
      "SKU",
      "Selling Price",
      "MRP",
      "Stock",
      "Unit",
      "HSN",
      "Weight (g)",
      "Length (cm)",
      "Width (cm)",
      "Height (cm)",
      "Short Description",
      "Description",
    ];

    const sampleRows = [
      [
        "1200mm Brushless BLDC Ceiling Fan with Remote",
        "bldc-ceiling-fan-1200mm",
        "Electricals",
        "Havells",
        "HV-BLDC-1200",
        "2499",
        "3999",
        "50",
        "Piece",
        "8414",
        "4500",
        "50",
        "30",
        "25",
        "Energy efficient 28W BLDC ceiling fan with smart remote control.",
        "High quality ceiling fan offering 65% power saving with 2-year manufacturer warranty.",
      ].map(escapeCSV).join(","),
    ];

    csvContent = [headers.join(","), ...sampleRows].join("\n");
  } else {
    // Filtered Products Export (variant-level)
    const statusParam = searchParams.get("status");
    const categoryIdParam = searchParams.get("categoryId");
    const brandIdParam = searchParams.get("brandId");
    const searchParam = searchParams.get("search");

    const where: any = { deletedAt: null };
    if (statusParam && statusParam !== "ALL") where.status = statusParam;
    if (categoryIdParam && categoryIdParam !== "ALL") where.categoryId = categoryIdParam;
    if (brandIdParam && brandIdParam !== "ALL") where.brandId = brandIdParam;
    if (searchParam) {
      where.OR = [
        { title: { contains: searchParam } },
        { slug: { contains: searchParam } },
        { variants: { some: { sku: { contains: searchParam } } } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
        variants: { orderBy: { position: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Product ID",
      "Title",
      "Slug",
      "Status",
      "Category",
      "Brand",
      "SKU",
      "Variant Name",
      "Selling Price (INR)",
      "MRP (INR)",
      "Stock",
      "Unit",
      "HSN Code",
      "Created Date",
    ];

    const rows: string[] = [];
    for (const p of products) {
      if (p.variants.length === 0) {
        rows.push(
          [
            p.id,
            p.title,
            p.slug,
            p.status,
            p.category?.name || "",
            p.brand?.name || "",
            "",
            "Standard",
            p.basePrice,
            p.basePrice,
            0,
            p.unit || "Piece",
            p.hsnCode || p.category?.hsnCode || "8541",
            p.createdAt.toISOString().slice(0, 10),
          ].map(escapeCSV).join(",")
        );
      } else {
        for (const v of p.variants) {
          rows.push(
            [
              p.id,
              p.title,
              p.slug,
              p.status,
              p.category?.name || "",
              p.brand?.name || "",
              v.sku || "",
              v.title,
              v.price ?? p.basePrice,
              v.mrp ?? v.price ?? p.basePrice,
              v.stock,
              p.unit || "Piece",
              p.hsnCode || p.category?.hsnCode || "8541",
              p.createdAt.toISOString().slice(0, 10),
            ].map(escapeCSV).join(",")
          );
        }
      }
    }

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
