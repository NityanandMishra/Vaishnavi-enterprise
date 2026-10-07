import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createManifest } from "@/lib/shipping/shipping-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const manifests = await prisma.manifest.findMany({
      include: { courier: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ manifests });
  } catch (error: any) {
    console.error("List manifests error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list manifests" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { courierId, manifestDate } = body;

    if (!courierId) {
      return NextResponse.json({ error: "Courier ID is required" }, { status: 400 });
    }

    const manifest = await createManifest({
      courierId,
      manifestDate: manifestDate ? new Date(manifestDate) : undefined,
      userId: user.id,
      userName: user.name || user.email,
    });

    return NextResponse.json({ success: true, manifest }, { status: 201 });
  } catch (error: any) {
    console.error("Create manifest error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create manifest" },
      { status: 500 }
    );
  }
}
