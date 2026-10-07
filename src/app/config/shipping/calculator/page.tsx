import { redirect } from "next/navigation";

export default function ConfigCalculatorPage({ searchParams }: { searchParams: any }) {
  const query = new URLSearchParams(searchParams).toString();
  redirect(`/admin/shipping/calculator${query ? `?${query}` : ""}`);
}
