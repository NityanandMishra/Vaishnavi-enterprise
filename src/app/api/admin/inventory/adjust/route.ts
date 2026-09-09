import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import {
  adjustStock,
  PreconditionRequiredError,
  ConflictError,
} from "@/lib/inventory/inventory-service";
import { AdjustStockSchema } from "@/lib/inventory/types";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const role = (user as any)?.role;
  if (
    !session ||
    (role !== "ADMIN" &&
      role !== "SUPER_ADMIN" &&
      role !== "CATALOG_MANAGER" &&
      role !== "OPS_EXECUTIVE")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
