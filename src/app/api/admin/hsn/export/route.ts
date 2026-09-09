import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTaxRead } from "@/lib/tax/auth-helper";

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  try {
    await requireTaxRead();

    const hsns = await prisma.hsnCode.findMany({
      where: { deletedAt: null },
      orderBy: [{ code: "asc" }],
      include: {
        rateVersions: {
          orderBy: [{ effectiveFrom: "desc" }],
          include: { slabs: true },
        },
        _count: {
          select: { categoryMappings: true, products: true },
        },
      },
    });

    const headers = ["HSN Code", "Description", "Rate Type", "GST Rate %", "Cess Rate %", "Categories", "Products", "Status"];
    const rows = [headers.join(",")];

    const now = new Date();

    for (const h of hsns) {
      const activeVersion =
        h.rateVersions.find(
          (v) => new Date(v.effectiveFrom) <= now && (!v.effectiveTo || new Date(v.effectiveTo) >= now)
        ) || h.rateVersions[0];

      let rateStr = "";
      if (h.rateType === "SLAB") {
        const rates = (activeVersion?.slabs || []).map((s) => `${s.gstRate}%`);
        rateStr = Array.from(new Set(rates)).join(" / ");
      } else {
        rateStr = activeVersion?.gstRate !== null && activeVersion?.gstRate !== undefined ? `${activeVersion.gstRate}%` : "";
      }

      rows.push(
        [
          escapeCSV(h.code),
          escapeCSV(h.description),
          escapeCSV(h.rateType),
          escapeCSV(rateStr),
          escapeCSV(h.cessRate ? `${h.cessRate}%` : "0%"),
          escapeCSV(h._count.categoryMappings),
          escapeCSV(h._count.products),
          escapeCSV(h.isActive ? "Active" : "Inactive"),
        ].join(",")
      );
    }

    const csvContent = rows.join("\r\n");
    const dateStr = new Date().toISOString().slice(0, 10);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vaishnavi-hsn-directory-${dateStr}.csv"`,
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
