import { redirect } from "next/navigation";

export default function SalesReconciliationPage({ searchParams }: { searchParams: any }) {
  const query = new URLSearchParams(searchParams).toString();
  redirect(`/admin/payments/reconciliation${query ? `?${query}` : ""}`);
}
