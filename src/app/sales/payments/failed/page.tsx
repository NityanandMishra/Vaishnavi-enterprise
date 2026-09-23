import { redirect } from "next/navigation";

export default function SalesFailedPaymentsPage({ searchParams }: { searchParams: any }) {
  const query = new URLSearchParams(searchParams).toString();
  redirect(`/admin/payments/failed${query ? `?${query}` : ""}`);
}
