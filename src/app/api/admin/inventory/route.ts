import { NextRequest, NextResponse } from "next/server";
import { guardApiRole, STAFF_ROLES } from "@/lib/api-guard";
import { getInventoryOverview } from "@/lib/inventory/inventory-service";

export async function GET(request: NextRequest) {
  const auth = await guardApiRole(STAFF_ROLES);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const search = searchParams.get("search") || undefined;
  const stockStatus = searchParams.get("stockStatus") as any;
  const categoryId = searchParams.get("categoryId") || undefined;
  const brandId = searchParams.get("brandId") || undefined;

  try {
    const data = await getInventoryOverview({
      page,
      limit,
      search,
      stockStatus,
      categoryId,
      brandId,
    });

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch inventory" }, { status: 500 });
  }
}
