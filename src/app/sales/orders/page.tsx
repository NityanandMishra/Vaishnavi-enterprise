import { redirect } from "next/navigation";

export default function SalesOrdersPage({ searchParams }: { searchParams: any }) {
  const query = new URLSearchParams(searchParams).toString();
  redirect(`/admin/orders${query ? `?${query}` : ""}`);
}
