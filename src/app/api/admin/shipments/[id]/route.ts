import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        courier: true,
        order: {
          include: {
            items: {
              where: { status: "ACTIVE" },
              include: { shipmentLines: true },
            },
            shipments: {
              select: {
                id: true,
                shipmentNumber: true,
                status: true,
                awbNumber: true,
              },
            },
          },
        },
        lines: {
          include: {
            orderLine: true,
          },
        },
        events: {
          orderBy: { eventAt: "desc" },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Identify unshipped or remaining items on the order (S3: "Not in this shipment")
    const notInThisShipment = [];
    for (const orderItem of shipment.order.items) {
      const shippedInThis = shipment.lines.find((l) => l.orderLineId === orderItem.id)?.quantity || 0;
      const totalShippedAcrossAll = orderItem.shipmentLines.reduce((sum, sl) => sum + sl.quantity, 0);
      const remainingUnshipped = orderItem.quantity - totalShippedAcrossAll;
      
      if (shippedInThis < orderItem.quantity) {
        notInThisShipment.push({
          orderLineId: orderItem.id,
          productName: orderItem.productName,
          sku: orderItem.sku,
          orderedQuantity: orderItem.quantity,
          inThisShipmentQuantity: shippedInThis,
          remainingUnshippedQuantity: remainingUnshipped,
        });
      }
    }

    return NextResponse.json({
      shipment,
      notInThisShipment,
    });
  } catch (error: any) {
    console.error("Get shipment detail error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get shipment detail" },
      { status: 500 }
    );
  }
}
