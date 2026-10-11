import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, INVENTORY_ADJUST_ROLES } from "@/lib/api-guard";
import {
  adjustStock,
  PreconditionRequiredError,
  ConflictError,
} from "@/lib/inventory/inventory-service";
import { AdjustStockSchema } from "@/lib/inventory/types";

export async function POST(request: NextRequest) {
  const auth = await guardApiRole(INVENTORY_ADJUST_ROLES);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const json = await request.json();
    const parsed = AdjustStockSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const result = await adjustStock({
      variantId: parsed.data.variantId,
      mode: parsed.data.mode,
      quantity: parsed.data.quantity,
      reasonCode: parsed.data.reasonCode,
      note: parsed.data.note,
      actorId: (user as any).id || "admin",
      actorName: user?.name || "Admin",
      confirmLarge: parsed.data.confirmLarge,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof PreconditionRequiredError) {
      return NextResponse.json(
        { error: err.message, details: err.details },
        { status: 428 }
      );
    }
    if (err instanceof ConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err.message || "Adjustment failed" },
      { status: err.statusCode || 400 }
    );
  }
}
