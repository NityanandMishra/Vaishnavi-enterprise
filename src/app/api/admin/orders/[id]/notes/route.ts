import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, ORDER_WRITE_ROLES } from "@/lib/api-guard";
import { addOrderNote } from "@/lib/orders/order-service";

/**
 * POST /api/admin/orders/[id]/notes
 * Implements ORD-08: Internal and customer-visible notes.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await guardApiRole(ORDER_WRITE_ROLES);
    if (auth.response) return auth.response;
    const orderId = params.id;
    const body = await req.json();
    const { body: noteBody, isCustomerVisible = false } = body;
    const actor = auth.user.name; // audit actor comes from the session, never the request body

    const note = await addOrderNote(orderId, {
      body: noteBody,
      isCustomerVisible: Boolean(isCustomerVisible),
      actor,
    });

    return NextResponse.json({ success: true, note }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding order note:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add order note" },
      { status: 400 }
    );
  }
}
