import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const courier = await prisma.courier.findUnique({
      where: { id },
    });

    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    const contentType = req.headers.get("content-type") || "";
    let rows: Array<{ pincode: string; supportsCod?: boolean; transitDays?: number }> = [];

    if (contentType.includes("application/json")) {
      const body = await req.json();
      rows = Array.isArray(body) ? body : body.rows || [];
    } else {
      // CSV text parsing
      const text = await req.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      
      // Determine if there is a header
      const startIndex = lines[0].toLowerCase().includes("pincode") ? 1 : 0;
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        if (parts[0]) {
          rows.push({
            pincode: parts[0],
            supportsCod: parts[1] !== undefined ? parts[1].toLowerCase() === "true" || parts[1] === "1" || parts[1].toLowerCase() === "yes" : true,
            transitDays: parts[2] ? parseInt(parts[2], 10) : 3,
          });
        }
      }
    }

    const validPincodes: Array<{ pincode: string; supportsCod: boolean; transitDays: number }> = [];
    const invalidRows: Array<{ row: any; reason: string }> = [];

    for (const r of rows) {
      const pin = String(r.pincode).trim();
      if (!/^\d{6}$/.test(pin)) {
        invalidRows.push({ row: r, reason: "Invalid 6-digit pincode format" });
        continue;
      }

      validPincodes.push({
        pincode: pin,
        supportsCod: r.supportsCod ?? true,
        transitDays: typeof r.transitDays === "number" && !isNaN(r.transitDays) ? r.transitDays : 3,
      });
    }

    let upsertedCount = 0;
    for (const item of validPincodes) {
      await prisma.courierServiceability.upsert({
        where: {
          courierId_pincode: {
            courierId: courier.id,
            pincode: item.pincode,
          },
        },
        create: {
          courierId: courier.id,
          pincode: item.pincode,
          supportsCod: item.supportsCod,
          transitDays: item.transitDays,
          isActive: true,
        },
        update: {
          supportsCod: item.supportsCod,
          transitDays: item.transitDays,
          isActive: true,
        },
      });
      upsertedCount++;
    }

    return NextResponse.json({
      success: true,
      courierId: courier.id,
      courierName: courier.name,
      totalProcessed: rows.length,
      importedCount: upsertedCount,
      invalidCount: invalidRows.length,
      invalidRows: invalidRows.slice(0, 50), // Sample for display
    });
  } catch (error: any) {
    console.error("Courier serviceability upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload serviceability" },
      { status: 500 }
    );
  }
}
