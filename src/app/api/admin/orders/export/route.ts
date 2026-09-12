import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/orders/export
 * Implements ORD-15: Filtered order CSV export with order-level or item-level format.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "order"; // "order" | "item"
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where: any = { deletedAt: null };
    if (status && status !== "ALL") where.status = status;
    if (paymentStatus && paymentStatus !== "ALL") where.paymentStatus = paymentStatus;
    if (dateFrom || dateTo) {
      where.placedAt = {};
      if (dateFrom) where.placedAt.gte = new Date(dateFrom);
      if (dateTo) where.placedAt.lte = new Date(dateTo);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        user: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { placedAt: "desc" },
    });

    let csvContent = "";

    function escapeCsv(val: any): string {
      if (val === null || val === undefined) return "";
      const str = String(val).replace(/"/g, '""');
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    }

    if (format === "item") {
      // Line-level export (one row per item)
      const headers = [
        "Order Number",
        "Placed At",
        "Order Status",
        "Payment Status",
        "Payment Method",
        "Customer Name",
        "Customer Phone",
        "Customer Email",
        "Delivery State",
        "SKU",
        "Item Name",
        "Variant",
        "Quantity",
        "Cancelled Qty",
        "Unit Price",
        "HSN",
        "GST Rate",
        "CGST",
        "SGST",
        "IGST",
        "Line Total",
        "Item Status",
      ];
      csvContent += headers.join(",") + "\n";

      for (const order of orders) {
        for (const item of order.items) {
          const row = [
            escapeCsv(order.orderNumber || order.id),
            escapeCsv(order.placedAt.toISOString()),
            escapeCsv(order.status),
            escapeCsv(order.paymentStatus),
            escapeCsv(order.paymentMethod),
            escapeCsv(order.customerName || order.user?.name),
            escapeCsv(order.customerPhone || order.user?.phone),
            escapeCsv(order.customerEmail || order.user?.email),
            escapeCsv(order.deliveryStateCode),
            escapeCsv(item.sku),
            escapeCsv(item.productName),
            escapeCsv(item.variantTitle),
            escapeCsv(item.quantity),
            escapeCsv(item.cancelledQty),
            escapeCsv(item.price.toFixed(2)),
            escapeCsv(item.hsnCode),
            escapeCsv(item.gstRate),
            escapeCsv((item.cgstAmount || 0).toFixed(2)),
            escapeCsv((item.sgstAmount || 0).toFixed(2)),
            escapeCsv((item.igstAmount || 0).toFixed(2)),
            escapeCsv((item.lineTotal || 0).toFixed(2)),
            escapeCsv(item.status),
          ];
          csvContent += row.join(",") + "\n";
        }
      }
    } else {
      // Order-level export (one row per order)
      const headers = [
        "Order Number",
        "Placed At",
        "Status",
        "Payment Status",
        "Payment Method",
        "Source",
        "Customer Name",
        "Customer Phone",
        "Customer Email",
        "Delivery State",
        "Subtotal",
        "Discount",
        "Tax Total",
        "Shipping",
        "Grand Total",
        "Paid Amount",
        "Balance Amount",
        "Items Count",
      ];
      csvContent += headers.join(",") + "\n";

      for (const order of orders) {
        const activeItemsCount = order.items.reduce(
          (sum, i) => sum + (i.quantity - (i.cancelledQty || 0)),
          0
        );
        const row = [
          escapeCsv(order.orderNumber || order.id),
          escapeCsv(order.placedAt.toISOString()),
          escapeCsv(order.status),
          escapeCsv(order.paymentStatus),
          escapeCsv(order.paymentMethod),
          escapeCsv(order.source),
          escapeCsv(order.customerName || order.user?.name),
          escapeCsv(order.customerPhone || order.user?.phone),
          escapeCsv(order.customerEmail || order.user?.email),
          escapeCsv(order.deliveryStateCode),
          escapeCsv(order.subtotalAmount.toFixed(2)),
          escapeCsv(order.discountAmount.toFixed(2)),
          escapeCsv(order.taxAmount.toFixed(2)),
          escapeCsv(order.shippingCost.toFixed(2)),
          escapeCsv(order.totalAmount.toFixed(2)),
          escapeCsv(order.paidAmount.toFixed(2)),
          escapeCsv(order.balanceAmount.toFixed(2)),
          escapeCsv(activeItemsCount),
        ];
        csvContent += row.join(",") + "\n";
      }
    }

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders-${format}-${Date.now()}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Error exporting orders:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export orders" },
      { status: 500 }
    );
  }
}
