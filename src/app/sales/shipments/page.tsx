import { redirect } from "next/navigation";

export default function SalesShipmentsPage({ searchParams }: { searchParams: any }) {
  const query = new URLSearchParams(searchParams).toString();
  redirect(`/admin/shipments${query ? `?${query}` : ""}`);
}
