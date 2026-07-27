import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/utils";
import Link from "next/link";
import {
  ShoppingBag,
  TrendingUp,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  Clock,
  Search,
  Plus,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    PENDING: { bg: "bg-[#FEF3C7]", text: "text-[#B45309]", border: "border-[#FDE68A]" },
    CAPTURED: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", border: "border-[#BFDBFE]" },
    COD_CONFIRMED: { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]", border: "border-[#E9D5FF]" },
    FULFILLED: { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]", border: "border-[#BAE6FD]" },
    DELIVERED: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]", border: "border-[#A7F3D0]" },
    CANCELLED: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", border: "border-[#FCA5A5]" },
    REFUNDED: { bg: "bg-[#F1F5F9]", text: "text-[#475569]", border: "border-[#E2E8F0]" },
    NEW: { bg: "bg-[#FFEDD5]", text: "text-[#EA580C]", border: "border-[#FED7AA]" },
    CONTACTED: { bg: "bg-[#FEF3C7]", text: "text-[#B45309]", border: "border-[#FDE68A]" },
  };

  const current = styles[status] ?? { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" };

  return (
    <span className={`text-[11px] font-bold px-[8px] py-[3px] rounded-[4px] border ${current.bg} ${current.text} ${current.border}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default async function AdminDashboard() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    todayRevenue,
    monthOrderCount,
    pendingOrderCount,
    activeLeadCount,
    lowStockVariants,
    recentOrders,
    recentLeads,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: {
        status: { in: ["CAPTURED", "FULFILLED", "DELIVERED"] },
        createdAt: { gte: startOfToday },
      },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({
      where: {
        status: { not: "CANCELLED" },
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.order.count({
      where: { status: { in: ["PENDING", "COD_CONFIRMED"] } },
    }),
    prisma.lead.count({
      where: { status: { in: ["NEW", "CONTACTED"] } },
    }),
    prisma.productVariant.findMany({
      where: {
        stock: { lte: 5 },
        product: { stockMode: "TRACKED", isAvailable: true },
      },
      include: { product: { select: { id: true, title: true } } },
      take: 5,
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const revenue = todayRevenue._sum.totalAmount ?? 0;

  return (
    <div className="font-sans space-y-6">
      {/* Welcome Bar */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="m-0 text-sm text-[#64748B]">
            Welcome back. Here is what's happening with your business today.
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white py-3 px-5 rounded-[4px] font-semibold text-sm cursor-pointer transition-colors"
        >
          <Plus size={18} />
          <span>Create New Order</span>
        </Link>
      </div>

      {/* Search Input bar */}
      <div className="relative max-w-[560px] mb-6">
        <Search size={20} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          placeholder="Search orders, leads, or products..."
          className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] pl-[42px] pr-[16px] py-3 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#EA580C] focus:ring-0 font-sans"
        />
      </div>

      {/* ── Stat Cards Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px] mb-6">
        {/* Today's Revenue */}
        <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] p-[22px] flex items-start justify-between">
          <div>
            <p className="m-0 mb-1 text-[12px] font-bold tracking-[0.05em] text-[#94A3B8] uppercase">
              Today's Revenue
            </p>
            <h4 className="m-0 text-[26px] font-bold text-[#0F172A] tracking-tight font-sans">
              {formatINR(revenue)}
            </h4>
            <p className="m-0 mt-1.5 text-[12px] font-bold text-[#16A34A]">+12% from yesterday</p>
          </div>
          <div className="bg-[#F1F5F9] p-2.5 rounded-[6px] text-[#0F172A] flex-shrink-0">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Orders This Month */}
        <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] p-[22px] flex items-start justify-between">
          <Link href="/admin/orders" className="flex-1 flex justify-between items-start">
            <div>
              <p className="m-0 mb-1 text-[12px] font-bold tracking-[0.05em] text-[#94A3B8] uppercase">
                Orders This Month
              </p>
              <h4 className="m-0 text-[26px] font-bold text-[#0F172A] tracking-tight font-sans">
                {monthOrderCount}
              </h4>
              <p className="m-0 mt-1.5 text-[12px] text-[#64748B]">Target: 150 orders</p>
            </div>
            <div className="bg-[#F1F5F9] p-2.5 rounded-[6px] text-[#0F172A] flex-shrink-0">
              <ShoppingBag size={20} />
            </div>
          </Link>
        </div>

        {/* Pending Orders */}
        <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] p-[22px] flex items-start justify-between border-b-[4px] border-b-[#D97706]">
          <Link href="/admin/orders" className="flex-1 flex justify-between items-start">
            <div>
              <p className="m-0 mb-1 text-[12px] font-bold tracking-[0.05em] text-[#94A3B8] uppercase">
                Pending Orders
              </p>
              <h4 className="m-0 text-[26px] font-bold text-[#D97706] tracking-tight font-sans">
                {pendingOrderCount}
              </h4>
              <p className="m-0 mt-1.5 text-[12px] font-bold text-[#EA580C] flex items-center gap-0.5">
                View filtered orders <ArrowRight size={12} />
              </p>
            </div>
            <div className="bg-[#FEF3C7] p-2.5 rounded-[6px] text-[#D97706] flex-shrink-0">
              <Clock size={20} />
            </div>
          </Link>
        </div>

        {/* Active Leads */}
        <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] p-[22px] flex items-start justify-between border-b-[4px] border-b-[#2563EB]">
          <Link href="/admin/leads" className="flex-1 flex justify-between items-start">
            <div>
              <p className="m-0 mb-1 text-[12px] font-bold tracking-[0.05em] text-[#94A3B8] uppercase">
                Active Leads
              </p>
              <h4 className="m-0 text-[26px] font-bold text-[#2563EB] tracking-tight font-sans">
                {activeLeadCount}
              </h4>
              <p className="m-0 mt-1.5 text-[12px] font-bold text-[#EA580C] flex items-center gap-0.5">
                View filtered leads <ArrowRight size={12} />
              </p>
            </div>
            <div className="bg-[#DBEAFE] p-2.5 rounded-[6px] text-[#2563EB] flex-shrink-0">
              <MessageSquare size={20} />
            </div>
          </Link>
        </div>
      </div>

      {/* ── Low Stock Alert Banner ─────────────────────────────────── */}
      {lowStockVariants.length > 0 && (
        <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-[6px] padding px-5 py-4 flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-[#D97706]" />
            <p className="m-0 font-bold text-[#92400E] text-sm font-sans">
              {lowStockVariants.length} products are low on stock
            </p>
          </div>
          <Link
            href="/admin/products"
            className="bg-[#D97706] hover:bg-[#B45309] text-white border-none py-[9px] px-[18px] rounded-[4px] text-[13px] font-bold transition-colors cursor-pointer"
          >
            Review Inventory
          </Link>
        </div>
      )}

      {/* ── Recent Action Grids ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <section className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col">
          <div className="px-6 py-[16px] flex items-center justify-between border-b border-[#E2E8F0]">
            <h4 className="m-0 text-[18px] font-semibold text-[#0F172A]">Recent Orders</h4>
            <Link
              href="/admin/orders"
              className="text-[#EA580C] hover:text-[#C2410C] font-bold text-[13px] transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  <th className="px-6 py-3 text-left text-[11px] font-bold tracking-[0.03em] text-[#475569] uppercase">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold tracking-[0.03em] text-[#475569] uppercase">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold tracking-[0.03em] text-[#475569] uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold tracking-[0.03em] text-[#475569] uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                      No orders registered.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((o) => (
                    <tr key={o.id} className="border-t border-[#E2E8F0] hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-[14px] text-[13px] font-bold text-[#0F172A] font-mono whitespace-nowrap">
                        <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                          #{o.id.slice(0, 8)}...
                        </Link>
                      </td>
                      <td className="px-6 py-[14px] text-[13px] text-[#0f172a] font-medium truncate max-w-[150px]">
                        {o.user?.name ?? o.user?.email ?? "Unknown"}
                      </td>
                      <td className="px-6 py-[14px] text-[13px] font-bold text-[#0F172A] whitespace-nowrap">
                        {formatINR(o.totalAmount)}
                      </td>
                      <td className="px-6 py-[14px] whitespace-nowrap">
                        <StatusBadge status={o.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Leads */}
        <section className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col">
          <div className="px-6 py-[16px] flex items-center justify-between border-b border-[#E2E8F0]">
            <h4 className="m-0 text-[18px] font-semibold text-[#0F172A]">Recent Leads</h4>
            <Link
              href="/admin/leads"
              className="text-[#EA580C] hover:text-[#C2410C] font-bold text-[13px] transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  <th className="px-6 py-3 text-left text-[11px] font-bold tracking-[0.03em] text-[#475569] uppercase">
                    Lead Customer
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold tracking-[0.03em] text-[#475569] uppercase">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold tracking-[0.03em] text-[#475569] uppercase">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold tracking-[0.03em] text-[#475569] uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                      No customer inquiries registered.
                    </td>
                  </tr>
                ) : (
                  recentLeads.map((l) => (
                    <tr key={l.id} className="border-t border-[#E2E8F0] hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-[14px] text-[13px] font-bold text-[#0F172A] whitespace-nowrap">
                        <Link href={`/admin/leads/${l.id}`} className="hover:underline">
                          {l.name}
                        </Link>
                      </td>
                      <td className="px-6 py-[14px] text-[13px] text-[#475569] font-medium truncate max-w-[150px]" title={l.productName}>
                        {l.productName}
                      </td>
                      <td className="px-6 py-[14px] text-[13px] text-[#0f172a] font-mono whitespace-nowrap">
                        {l.phone}
                      </td>
                      <td className="px-6 py-[14px] whitespace-nowrap">
                        <StatusBadge status={l.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
