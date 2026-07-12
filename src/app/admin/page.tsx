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
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-900/30 text-amber-400 border-amber-800/30",
    CAPTURED: "bg-blue-900/30 text-blue-400 border-blue-800/30",
    COD_CONFIRMED: "bg-purple-900/30 text-purple-400 border-purple-800/30",
    FULFILLED: "bg-cyan-900/30 text-cyan-400 border-cyan-800/30",
    DELIVERED: "bg-brand-orange-900/30 text-brand-orange-400 border-brand-orange-800/30",
    CANCELLED: "bg-red-900/30 text-red-400 border-red-800/30",
    REFUNDED: "bg-slate-800 text-slate-400 border-slate-700",
    NEW: "bg-red-900/30 text-red-400 border-red-800/30",
    NEW_LEAD: "bg-brand-orange-900/30 text-brand-orange-400 border-brand-orange-800/30",
    CONTACTED: "bg-amber-900/30 text-amber-400 border-amber-800/30",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[status] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>
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
      take: 10,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const revenue = todayRevenue._sum.totalAmount ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          {now.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Today's Revenue",
            value: formatINR(revenue),
            icon: TrendingUp,
            color: "text-brand-orange-400",
            bg: "bg-brand-orange-900/20",
            href: null,
          },
          {
            label: "Orders This Month",
            value: monthOrderCount.toString(),
            icon: ShoppingBag,
            color: "text-blue-400",
            bg: "bg-blue-900/20",
            href: "/admin/orders",
          },
          {
            label: "Pending Orders",
            value: pendingOrderCount.toString(),
            icon: Clock,
            color: "text-amber-400",
            bg: "bg-amber-900/20",
            href: "/admin/orders?status=PENDING",
          },
          {
            label: "Active Leads",
            value: activeLeadCount.toString(),
            icon: MessageSquare,
            color: "text-purple-400",
            bg: "bg-purple-900/20",
            href: "/admin/leads",
          },
        ].map(({ label, value, icon: Icon, color, bg, href }) => (
          <div key={label} className={`glass-card rounded-2xl p-4 ${href ? "cursor-pointer" : ""}`}>
            {href ? (
              <Link href={href} className="block">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  <Icon size={20} className={color} />
                </div>
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={`font-heading font-bold text-xl ${color}`}>{value}</p>
              </Link>
            ) : (
              <>
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  <Icon size={20} className={color} />
                </div>
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={`font-heading font-bold text-xl ${color}`}>{value}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Low Stock Alerts ─────────────────────────────────────────── */}
      {lowStockVariants.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-amber-400" />
            <h2 className="font-heading font-semibold text-base text-white">Low Stock Alerts</h2>
          </div>
          <div className="space-y-2">
            {lowStockVariants.map((v) => (
              <Link
                key={v.id}
                href={`/admin/products/${v.productId}/edit`}
                className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div>
                  <p className="text-sm text-white">{v.product.title}</p>
                  <p className="text-xs text-slate-500">{v.title}</p>
                </div>
                <span className="text-xs font-bold text-red-400">{v.stock} left</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── Recent Orders ──────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-base text-white">Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs text-brand-orange-400 hover:text-brand-orange-300 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-1">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No orders yet.</p>
            ) : (
              recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-slate-400 truncate">#{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-white truncate">{order.user?.name ?? order.user?.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                    <StatusBadge status={order.status} />
                    <p className="text-xs font-bold text-brand-orange-400">{formatINR(order.totalAmount)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* ── Recent Leads ───────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-base text-white">Recent Leads</h2>
            <Link href="/admin/leads" className="text-xs text-brand-orange-400 hover:text-brand-orange-300 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-1">
            {recentLeads.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No leads yet.</p>
            ) : (
              recentLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/admin/leads/${lead.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white">{lead.name}</p>
                    <p className="text-xs text-slate-500 truncate">{lead.productName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                    <StatusBadge status={lead.status} />
                    <p className="text-xs text-slate-600">{lead.phone}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
