import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Double-check server side (middleware covers this but defence-in-depth)
  const role = (session?.user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "CATALOG_MANAGER" && role !== "OPS_EXECUTIVE" && role !== "FINANCE")) {
    redirect("/admin/login");
  }

  return <AdminShell user={session.user as any}>{children}</AdminShell>;
}
