import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

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
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Dynamic Header */}
        <AdminHeader user={session.user as any} />

        {/* Page Content */}
        <main className="flex-1 p-8 max-w-[1440px] w-full mx-auto box-border overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
