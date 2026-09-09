"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { unitInputSchema, UnitInput } from "@/lib/validations/tax";
import { requireUnitsRead, requireUnitsWrite } from "@/lib/tax/auth-helper";

export async function getUnitsAction() {
  await requireUnitsRead();

  const units = await prisma.unit.findMany({
    where: { deletedAt: null },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  return {
    ok: true,
    data: units.map((u) => ({
      id: u.id,
      name: u.name,
      symbol: u.symbol,
      unitType: u.unitType,
      decimalPrecision: u.decimalPrecision,
      isActive: u.isActive,
      isSystem: u.isSystem,
      productCount: u._count.products,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
  };
}

export async function createUnitAction(raw: UnitInput) {
  const user = await requireUnitsWrite();

  const parsed = unitInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", issues: parsed.error.format() };
  }

  const data = parsed.data;

  const existing = await prisma.unit.findFirst({
    where: { name: data.name, deletedAt: null },
  });

  if (existing) {
    return { ok: false, error: `A unit named '${data.name}' already exists.` };
  }

  const unit = await prisma.unit.create({
    data: {
      name: data.name,
      symbol: data.symbol,
      unitType: data.unitType,
      decimalPrecision: data.decimalPrecision,
      isActive: data.isActive,
      isSystem: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "UNIT",
      entityId: unit.id,
      action: "UNIT_CREATED",
      afterState: JSON.stringify(unit),
    },
  });

  revalidatePath("/admin/units");
  revalidatePath("/config/units");
  return { ok: true, data: unit };
}

export async function updateUnitAction(id: string, raw: Partial<UnitInput>) {
  const user = await requireUnitsWrite();

  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      _count: { select: { products: true } },
    },
  });

  if (!unit || unit.deletedAt) {
    return { ok: false, error: "Unit not found" };
  }

  const parsed = unitInputSchema.partial().safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", issues: parsed.error.format() };
  }

  const data = parsed.data;

  // Precision lock check
  if (
    data.decimalPrecision !== undefined &&
    data.decimalPrecision !== unit.decimalPrecision &&
    unit._count.products > 0
  ) {
    return {
      ok: false,
      error: `Precision cannot be changed while ${unit._count.products} products use this unit.`,
    };
  }

  if (data.name && data.name !== unit.name) {
    const duplicate = await prisma.unit.findFirst({
      where: { name: data.name, id: { not: id }, deletedAt: null },
    });
    if (duplicate) {
      return { ok: false, error: `A unit named '${data.name}' already exists.` };
    }
  }

  const updated = await prisma.unit.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.symbol && { symbol: data.symbol }),
      ...(data.unitType && { unitType: data.unitType }),
      ...(data.decimalPrecision !== undefined && { decimalPrecision: data.decimalPrecision }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "UNIT",
      entityId: unit.id,
      action: "UNIT_UPDATED",
      beforeState: JSON.stringify(unit),
      afterState: JSON.stringify(updated),
    },
  });

  revalidatePath("/admin/units");
  revalidatePath("/config/units");
  return { ok: true, data: updated };
}

export async function deleteUnitAction(id: string) {
  const user = await requireUnitsWrite();

  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      _count: { select: { products: true } },
    },
  });

  if (!unit || unit.deletedAt) {
    return { ok: false, error: "Unit not found" };
  }

  if (unit.isSystem) {
    return {
      ok: false,
      error: `${unit.name} is a system unit and cannot be deleted.`,
    };
  }

  if (unit._count.products > 0) {
    return {
      ok: false,
      error: `${unit.name} is used by ${unit._count.products} products and cannot be deleted. Deactivate it instead.`,
    };
  }

  const deleted = await prisma.unit.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "UNIT",
      entityId: unit.id,
      action: "UNIT_DELETED",
      beforeState: JSON.stringify(unit),
    },
  });

  revalidatePath("/admin/units");
  revalidatePath("/config/units");
  return { ok: true, message: `Unit '${unit.name}' deleted.` };
}

export async function restoreDefaultUnitsAction() {
  const user = await requireUnitsWrite();

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

  revalidatePath("/admin/units");
  revalidatePath("/config/units");
  return { ok: true, restoredCount };
}
