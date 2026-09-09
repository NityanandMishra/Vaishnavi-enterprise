import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUnitsWrite } from "@/lib/tax/auth-helper";

const DEFAULT_UNITS = [
  { name: "Piece", symbol: "pcs", unitType: "COUNT", decimalPrecision: 0, isSystem: true },
  { name: "Set", symbol: "set", unitType: "COUNT", decimalPrecision: 0, isSystem: true },
  { name: "Pair", symbol: "pr", unitType: "COUNT", decimalPrecision: 0, isSystem: true },
  { name: "Kilogram", symbol: "kg", unitType: "WEIGHT", decimalPrecision: 3, isSystem: true },
  { name: "Gram", symbol: "g", unitType: "WEIGHT", decimalPrecision: 2, isSystem: true },
  { name: "Litre", symbol: "l", unitType: "VOLUME", decimalPrecision: 2, isSystem: true },
  { name: "Millilitre", symbol: "ml", unitType: "VOLUME", decimalPrecision: 0, isSystem: true },
  { name: "Metre", symbol: "m", unitType: "LENGTH", decimalPrecision: 2, isSystem: true },
  { name: "Centimetre", symbol: "cm", unitType: "LENGTH", decimalPrecision: 1, isSystem: true },
  { name: "Box", symbol: "box", unitType: "COUNT", decimalPrecision: 0, isSystem: true },
  { name: "Dozen", symbol: "dz", unitType: "COUNT", decimalPrecision: 0, isSystem: true },
  { name: "Packet", symbol: "pkt", unitType: "COUNT", decimalPrecision: 0, isSystem: true },
];

export async function POST(req: NextRequest) {
  try {
    const user = await requireUnitsWrite();

    let restoredCount = 0;
    for (const def of DEFAULT_UNITS) {
      const existing = await prisma.unit.findFirst({
        where: { name: def.name },
      });

      if (!existing) {
        await prisma.unit.create({ data: def });
        restoredCount++;
      } else if (existing.deletedAt !== null) {
        await prisma.unit.update({
          where: { id: existing.id },
          data: { deletedAt: null, isActive: true, isSystem: true },
        });
        restoredCount++;
      }
    }

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "UNIT",
        entityId: "SYSTEM",
        action: "RESTORE_DEFAULT_UNITS",
        afterState: JSON.stringify({ restoredCount }),
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Restored ${restoredCount} default units.`,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
