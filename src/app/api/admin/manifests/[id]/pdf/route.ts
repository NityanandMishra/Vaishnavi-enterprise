import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Look up by id or manifestNumber
    const manifest = await prisma.manifest.findFirst({
      where: {
        OR: [{ id }, { manifestNumber: id }],
      },
      include: {
        courier: true,
      },
    });

    if (!manifest) {
      return new Response("Manifest not found", { status: 404 });
    }

    const startOfDay = new Date(manifest.manifestDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(manifest.manifestDate);
    endOfDay.setHours(23, 59, 59, 999);

    const shipments = await prisma.shipment.findMany({
      where: {
        courierId: manifest.courierId,
        dispatchedAt: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        order: true,
        lines: { include: { orderLine: true } },
      },
      orderBy: { dispatchedAt: "asc" },
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Courier Handover Manifest - ${manifest.manifestNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #111;
      margin: 0;
      padding: 15px;
      font-size: 13px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #222;
      padding-bottom: 12px;
      margin-bottom: 15px;
    }
    .title {
      font-size: 20px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      background: #f8f9fa;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 15px;
      border: 1px solid #e9ecef;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background-color: #f1f3f5;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 11px;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 40px;
      padding-top: 20px;
    }
    .sign-box {
      border-top: 1px dashed #444;
      padding-top: 8px;
    }
    @media print {
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 15px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 18px; font-weight: bold; cursor: pointer;">
      🖨️ Print Manifest
    </button>
  </div>

  <div class="header">
    <div>
      <div class="title">COURIER HANDOVER MANIFEST</div>
      <div style="font-size: 12px; color: #555;">Vaishnavi Enterprises Logistics Central</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 16px; font-weight: bold; font-family: monospace;">${manifest.manifestNumber}</div>
      <div>Date: ${new Date(manifest.manifestDate).toLocaleDateString()}</div>
    </div>
  </div>

  <div class="meta">
    <div><strong>Courier Partner:</strong> ${manifest.courier.name} (${manifest.courier.code})</div>
    <div><strong>Total Shipments:</strong> ${shipments.length}</div>
    <div><strong>Dispatched By:</strong> ${manifest.createdByName || "Warehouse Supervisor"}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 35px;">#</th>
        <th>Shipment #</th>
        <th>AWB Number</th>
        <th>Order #</th>
        <th>Destination City & PIN</th>
        <th>Weight</th>
        <th>Payment</th>
      </tr>
    </thead>
    <tbody>
      ${
        shipments.length > 0
          ? shipments
              .map(
                (s, idx) => {
                  let destination = "";
                  try {
                    const addr = typeof s.order.shippingAddress === "string"
                      ? JSON.parse(s.order.shippingAddress)
                      : s.order.shippingAddress || {};
                    destination = `${addr.city || ""} ${addr.pincode || addr.postalCode ? `- ${addr.pincode || addr.postalCode}` : ""}`;
                  } catch {
                    destination = s.order.deliveryStateCode || "—";
                  }

                  return `<tr>
                    <td>${idx + 1}</td>
                    <td style="font-family: monospace;">${s.shipmentNumber}</td>
                    <td style="font-family: monospace; font-weight: bold;">${s.awbNumber || "—"}</td>
                    <td>#${s.order.orderNumber}</td>
                    <td>${destination || "—"}</td>
                    <td>${s.weightGrams} g</td>
                    <td>${s.order.paymentMethod === "COD" ? `COD (₹${(s.codAmountPaise / 100).toFixed(2)})` : "Prepaid"}</td>
                  </tr>`;
                }
              )
              .join("")
          : `<tr><td colspan="7" style="text-align: center; padding: 20px;">No shipments dispatched for this courier today.</td></tr>`
      }
    </tbody>
  </table>

  <div class="signature-grid">
    <div class="sign-box">
      <strong>Warehouse Dispatcher Signature:</strong><br><br>
      Name: _______________________________<br>
      Date & Time: _________________________
    </div>
    <div class="sign-box">
      <strong>Courier Pickup Executive Signature:</strong><br><br>
      Name: _______________________________<br>
      Employee ID: ________________________<br>
      Total Parcels Received: ______________
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error: any) {
    console.error("Manifest PDF view error:", error);
    return new Response("Failed to generate manifest PDF", { status: 500 });
  }
}
