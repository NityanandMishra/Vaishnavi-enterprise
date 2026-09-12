import { NextRequest, NextResponse } from "next/server";
import { generateOrderInvoice } from "@/lib/orders/invoice-generator";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/orders/[id]/invoice - Generates GST invoice
 * GET /api/admin/orders/[id]/invoice - Retrieves GST invoice data
 * Implements ORD-11: Generate a compliant GST invoice.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await req.json().catch(() => ({}));
    const actor = body.actor || "Staff";

    const result = await generateOrderInvoice(orderId, actor);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error generating invoice:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate invoice" },
      { status: 400 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;

    const invoice = await prisma.invoice.findUnique({
      where: { orderId },
      include: {
        order: {
          select: {
            orderNumber: true,
            status: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not generated yet for this order" },
        { status: 404 }
      );
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(invoice.invoiceData);
    } catch {
      parsedData = {};
    }

    return NextResponse.json({
      invoice,
      data: parsedData,
    });
  } catch (error: any) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}
