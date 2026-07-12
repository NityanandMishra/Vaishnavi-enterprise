import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Double-check server side (middleware covers this but defence-in-depth)
  if (!session || (session.user as any)?.role !== "ADMIN") {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-white/5 flex items-center px-6 gap-4 flex-shrink-0 bg-slate-950/50">
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-orange-500 to-brand-orange-700 flex items-center justify-center text-xs font-bold text-white">
              {session.user?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <span>{session.user?.name ?? session.user?.email}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
