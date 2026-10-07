import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatPaise } from "@/lib/money";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "thermal"; // "thermal" (4x6) or "a4"

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        courier: true,
        order: {
          include: {
            items: true,
          },
        },
        lines: {
          include: {
            orderLine: true,
          },
        },
      },
    });

    if (!shipment) {
      return new Response("Shipment not found", { status: 404 });
    }

    let parsedAddress: any = {};
    try {
      parsedAddress = typeof shipment.order.shippingAddress === "string"
        ? JSON.parse(shipment.order.shippingAddress)
        : shipment.order.shippingAddress || {};
    } catch {
      parsedAddress = {};
    }

    const deliveryStreet = parsedAddress.street || parsedAddress.addressLine1 || "Customer Address";
    const deliveryCity = parsedAddress.city || "";
    const deliveryState = parsedAddress.state || shipment.order.deliveryStateCode || "";
    const deliveryPincode = parsedAddress.pincode || parsedAddress.postalCode || "";

    const isCod = shipment.order.paymentMethod === "COD";
    const awb = shipment.awbNumber || "PENDING-DISPATCH";

    // Clean HTML for thermal 4x6 printing or A4
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Shipping Label - ${shipment.shipmentNumber}</title>
  <style>
    @page {
      size: ${format === "a4" ? "A4" : "4in 6in"};
      margin: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      margin: 0;
      padding: ${format === "a4" ? "20mm" : "10px"};
      color: #000;
      background: #fff;
    }
    .label-box {
      width: ${format === "a4" ? "100mm" : "3.75in"};
      border: 2px solid #000;
      padding: 12px;
      box-sizing: border-box;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
    }
    .courier-badge {
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .payment-tag {
      font-size: 16px;
      font-weight: 800;
      padding: 4px 8px;
      border: 2px solid #000;
    }
    .payment-tag.cod {
      background: #000;
      color: #fff;
    }
    .barcode-section {
      text-align: center;
      padding: 12px 0;
      border-bottom: 2px solid #000;
    }
    .barcode-mock {
      font-family: monospace;
      font-size: 28px;
      letter-spacing: 5px;
      font-weight: bold;
      background: repeating-linear-gradient(
        90deg,
        #000 0px,
        #000 2px,
        #fff 2px,
        #fff 4px,
        #000 4px,
        #000 7px,
        #fff 7px,
        #fff 9px
      );
      height: 48px;
      margin: 0 auto 6px auto;
      width: 85%;
    }
    .awb-text {
      font-family: monospace;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    .address-section {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      padding: 10px 0;
      border-bottom: 2px solid #000;
      font-size: 12px;
    }
    .section-title {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 11px;
      color: #333;
      margin-bottom: 2px;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 8px 0;
      border-bottom: 2px solid #000;
      font-size: 12px;
    }
    .items-list {
      padding-top: 8px;
      font-size: 11px;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align: center; margin-bottom: 12px;">
    <button onclick="window.print()" style="padding: 8px 16px; font-weight: bold; cursor: pointer;">
      🖨️ Print Label (${format === "a4" ? "A4" : "4×6 Thermal"})
    </button>
  </div>

  <div class="label-box">
    <div class="header">
      <div class="courier-badge">${shipment.courier.name}</div>
      <div class="payment-tag ${isCod ? "cod" : ""}">${isCod ? `COD: ₹${(shipment.codAmountPaise / 100).toFixed(2)}` : "PREPAID"}</div>
    </div>

    <div class="barcode-section">
      <div class="barcode-mock"></div>
      <div class="awb-text">AWB: ${awb}</div>
    </div>

    <div class="address-section">
      <div>
        <div class="section-title">Ship To:</div>
        <div style="font-size: 14px; font-weight: bold;">${shipment.order.customerName || "Customer"}</div>
        <div>${deliveryStreet}</div>
        <div>${deliveryCity}, ${deliveryState} - <strong>${deliveryPincode}</strong></div>
        <div>Phone: ${shipment.order.customerPhone || "—"}</div>
      </div>
      <div style="border-top: 1px dashed #ccc; padding-top: 6px; margin-top: 4px;">
        <div class="section-title">Shipped From:</div>
        <div><strong>Vaishnavi Enterprises</strong>, Warehouse A-1, Mumbai, MH - 400001</div>
      </div>
    </div>

    <div class="details-grid">
      <div><strong>Shipment:</strong> ${shipment.shipmentNumber}</div>
      <div><strong>Order:</strong> #${shipment.order.orderNumber}</div>
      <div><strong>Weight:</strong> ${shipment.weightGrams} g</div>
      <div><strong>Date:</strong> ${new Date(shipment.createdAt).toLocaleDateString()}</div>
    </div>

    <div class="items-list">
      <div class="section-title">Contents (${shipment.lines.reduce((s, l) => s + l.quantity, 0)} items):</div>
      ${shipment.lines
        .map(
          (l) => `<div class="item-row">
            <span>${l.orderLine.productName}</span>
            <span>× ${l.quantity}</span>
          </div>`
        )
        .join("")}
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("Generate label error:", error);
    return new Response("Failed to generate shipping label", { status: 500 });
  }
}
