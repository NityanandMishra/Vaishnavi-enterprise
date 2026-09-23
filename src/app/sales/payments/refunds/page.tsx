import { redirect } from "next/navigation";

export default function SalesRefundsPage({ searchParams }: { searchParams: any }) {
  const query = new URLSearchParams(searchParams).toString();
  redirect(`/admin/payments/refunds${query ? `?${query}` : ""}`);
}
