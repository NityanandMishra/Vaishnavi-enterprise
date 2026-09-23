import { redirect } from "next/navigation";

export default function SalesCodPage({ searchParams }: { searchParams: any }) {
  const query = new URLSearchParams(searchParams).toString();
  redirect(`/admin/payments/cod${query ? `?${query}` : ""}`);
}
