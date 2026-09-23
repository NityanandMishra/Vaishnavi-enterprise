import { redirect } from "next/navigation";

export default function SalesPaymentsPage({ searchParams }: { searchParams: any }) {
  const query = new URLSearchParams(searchParams).toString();
  redirect(`/admin/payments${query ? `?${query}` : ""}`);
}
