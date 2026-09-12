import { redirect } from "next/navigation";

export default function SalesOrderDetailPage({ params }: { params: { id: string } }) {
  redirect(`/admin/orders/${params.id}`);
}
