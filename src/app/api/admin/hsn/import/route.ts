import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTaxWrite } from "@/lib/tax/auth-helper";

export async function POST(req: NextRequest) {
  try {
    const user = await requireTaxWrite();
    const body = await req.json();
    const { rows, action } = body; // action: "PREVIEW" | "COMMIT"

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "No CSV rows provided" }, { status: 400 });
    }

    const existingHsns = await prisma.hsnCode.findMany({
      where: { deletedAt: null },
      select: { code: true },
    });
    const existingCodeSet = new Set(existingHsns.map((h) => h.code));

    const validatedRows: Array<{
      rowNumber: number;
      code: string;
      description: string;
      rate: number;
      isValid: boolean;
      error?: string;
    }> = [];

    const seenInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const code = String(r.code || "").trim();
      const description = String(r.description || "").trim();
      const rate = parseFloat(String(r.rate || "0"));
      const rowNumber = i + 1;

      if (!code) {
        validatedRows.push({ rowNumber, code, description, rate, isValid: false, error: "Missing HSN code" });
        continue;
      }

      if (!/^\d+$/.test(code)) {
        validatedRows.push({ rowNumber, code, description, rate, isValid: false, error: "HSN code must contain digits only" });
        continue;
      }

      if (![4, 6, 8].includes(code.length)) {
        validatedRows.push({
          rowNumber,
          code,
          description,
          rate,
          isValid: false,
          error: `HSN code must be 4, 6 or 8 digits (entered ${code.length})`,
        });
        continue;
      }

      if (existingCodeSet.has(code)) {
        validatedRows.push({ rowNumber, code, description, rate, isValid: false, error: `HSN code ${code} already exists in catalog` });
        continue;
      }

      if (seenInBatch.has(code)) {
        validatedRows.push({ rowNumber, code, description, rate, isValid: false, error: `Duplicate code ${code} in CSV batch` });
        continue;
      }

      if (!description) {
        validatedRows.push({ rowNumber, code, description, rate, isValid: false, error: "Description is required" });
        continue;
      }

      if (isNaN(rate) || rate < 0 || rate > 100) {
        validatedRows.push({ rowNumber, code, description, rate, isValid: false, error: "GST rate must be between 0 and 100" });
        continue;
      }

      seenInBatch.add(code);
      validatedRows.push({ rowNumber, code, description, rate, isValid: true });
    }

    if (action === "PREVIEW") {
      const validCount = validatedRows.filter((r) => r.isValid).length;
      const invalidCount = validatedRows.length - validCount;
      return NextResponse.json({
        ok: true,
        preview: validatedRows,
        validCount,
        invalidCount,
        total: validatedRows.length,
      });
    }

    // action === "COMMIT": only commit valid rows
    const toCommit = validatedRows.filter((r) => r.isValid);
    if (toCommit.length === 0) {
      return NextResponse.json({ ok: false, error: "No valid rows to commit" }, { status: 400 });
    }

    const created = await prisma.$transaction(
      toCommit.map((r) =>
        prisma.hsnCode.create({
          data: {
            code: r.code,
            description: r.description,
            rateType: "FLAT",
            rateVersions: {
              create: {
                gstRate: r.rate,
                effectiveFrom: new Date(),
                createdBy: user.name,
              },
            },
          },
        })
      )
    );

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entity: "HSN",
        entityId: "CSV_IMPORT",
        action: "IMPORT_HSN_CSV",
        afterState: JSON.stringify({ count: created.length }),
      },
    });

    return NextResponse.json({
      ok: true,
      committedCount: created.length,
      message: `Successfully imported ${created.length} HSN codes.`,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
