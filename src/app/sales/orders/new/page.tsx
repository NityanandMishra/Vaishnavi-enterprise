import { redirect } from "next/navigation";

export default function SalesOrderNewPage() {
  redirect(`/admin/orders/new`);
}
