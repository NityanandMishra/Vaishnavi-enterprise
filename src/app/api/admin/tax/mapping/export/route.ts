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

    const categories = await prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        hsnMapping: {
          include: {
            hsn: {
              include: {
                rateVersions: {
                  orderBy: [{ effectiveFrom: "desc" }],
                  include: { slabs: true },
                },
              },
            },
          },
        },
        parent: {
          include: {
            hsnMapping: {
              include: {
                hsn: {
                  include: {
                    rateVersions: {
                      orderBy: [{ effectiveFrom: "desc" }],
                      include: { slabs: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const headers = ["Category Name", "Parent Category", "HSN Code", "Description", "Rate", "Source"];
    const rows = [headers.join(",")];

    const now = new Date();

    for (const cat of categories) {
      let hsn: any = null;
      let source = "Missing";

      if (cat.hsnMapping?.hsn) {
        hsn = cat.hsnMapping.hsn;
        source = cat.parentId ? "Override" : "Direct";
      } else if (cat.parent?.hsnMapping?.hsn) {
        hsn = cat.parent.hsnMapping.hsn;
        source = "Inherited";
      }

      let rateStr = "—";
      if (hsn) {
        const activeVersion =
          hsn.rateVersions?.find(
            (v: any) => new Date(v.effectiveFrom) <= now && (!v.effectiveTo || new Date(v.effectiveTo) >= now)
          ) || hsn.rateVersions?.[0];

        if (hsn.rateType === "SLAB") {
          const rates = (activeVersion?.slabs || []).map((s: any) => `${s.gstRate}%`);
          rateStr = Array.from(new Set(rates)).join(" / ");
        } else {
          rateStr = activeVersion?.gstRate !== null && activeVersion?.gstRate !== undefined ? `${activeVersion.gstRate}%` : "—";
        }
      }

      rows.push(
        [
          escapeCSV(cat.name),
          escapeCSV(cat.parent?.name || "—"),
          escapeCSV(hsn ? hsn.code : "—"),
          escapeCSV(hsn ? hsn.description : "—"),
          escapeCSV(rateStr),
          escapeCSV(source),
        ].join(",")
      );
    }

    const csvContent = rows.join("\r\n");
    const dateStr = new Date().toISOString().slice(0, 10);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vaishnavi-category-tax-mapping-${dateStr}.csv"`,
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
