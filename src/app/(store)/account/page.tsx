import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Package, MapPin, User, ChevronRight, Mail, Phone, Heart } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import { cn, formatINR } from "@/lib/utils";
import EmptyState from "@/components/store/EmptyState";
import SignOutButton from "@/components/store/SignOutButton";

export const metadata: Metadata = { title: "My Account" };

const TABS = [
  { value: "orders", label: "Orders" },
  { value: "addresses", label: "Addresses" },
  { value: "profile", label: "Profile" },
] as const;

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning",
  CAPTURED: "bg-success/10 text-success",
  COD_CONFIRMED: "bg-success/10 text-success",
  FULFILLED: "bg-surface-sunken text-slate-700",
  DELIVERED: "bg-success/10 text-success",
  CANCELLED: "bg-danger/10 text-danger",
  REFUNDED: "bg-slate-200 text-slate-700",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/auth/login?callbackUrl=/account");

  const activeTab = TABS.some((t) => t.value === searchParams.tab)
    ? (searchParams.tab as string)
    : "orders";

  const [user, orders, addresses, wishlistCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { items: { select: { id: true } } },
    }),
    prisma.address.findMany({ where: { userId }, orderBy: { isDefault: "desc" } }),
    prisma.wishlistItem.count({ where: { userId } }),
  ]);

  if (!user) redirect("/auth/login?callbackUrl=/account");

  return (
    <div className="max-w-content mx-auto px-4 lg:px-8 pt-4 lg:pt-6 pb-4">
      {/* Profile header */}
      <div className="bg-surface border border-border-base rounded-lg p-5 lg:p-6 flex items-center gap-4 mb-6">
        <div className="w-16 h-16 flex-shrink-0 rounded-full bg-surface-sunken flex items-center justify-center">
          <User size={28} className="text-slate-500" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 truncate">
            {user.name ?? "My Account"}
          </h1>
          <p className="text-sm text-slate-600 truncate">{user.email}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm bg-surface-sunken text-slate-700">
              {orders.length} {orders.length === 1 ? "Order" : "Orders"}
            </span>
            <Link
              href="/wishlist"
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm bg-surface-sunken text-slate-700 hover:text-brand-orange-600 transition-colors"
            >
              <Heart size={11} /> {wishlistCount} Saved
            </Link>
          </div>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:items-start">
        {/* Tab rail — horizontal on mobile, vertical on desktop */}
        <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar border-b lg:border-b-0 border-border-base mb-6 lg:mb-0 lg:sticky lg:top-24">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/account?tab=${tab.value}`}
              className={cn(
                "flex-shrink-0 min-h-[48px] flex items-center px-4 text-sm font-medium transition-colors lg:rounded-md",
                activeTab === tab.value
                  ? "text-slate-900 font-bold border-b-2 lg:border-b-0 border-slate-900 lg:bg-surface lg:border lg:border-border-base"
                  : "text-slate-500 hover:text-slate-900 lg:hover:bg-surface"
              )}
            >
              {tab.label}
            </Link>
          ))}
          <Link
            href="/wishlist"
            className="flex-shrink-0 min-h-[48px] flex items-center px-4 text-sm font-medium text-slate-500 hover:text-slate-900 lg:hover:bg-surface lg:rounded-md transition-colors"
          >
            Wishlist
          </Link>
        </nav>

        <div className="min-w-0">
          {activeTab === "orders" &&
            (orders.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No orders yet"
                description="Once you place an order it will show up here with live tracking."
                actionLabel="Start Shopping"
                actionHref="/categories"
              />
            ) : (
              <ul className="space-y-3">
                {orders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="flex items-center gap-4 bg-surface border border-border-base rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm",
                              STATUS_TONE[order.status] ?? "bg-slate-200 text-slate-700"
                            )}
                          >
                            {order.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {order.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} ·{" "}
                          {order.items.length} {order.items.length === 1 ? "item" : "items"}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-slate-900 whitespace-nowrap">
                        {formatINR(order.totalAmount)}
                      </span>
                      <ChevronRight size={18} className="text-muted flex-shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            ))}

          {activeTab === "addresses" &&
            (addresses.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="No saved addresses"
                description="Addresses you enter at checkout will be saved here for next time."
                actionLabel="Browse Products"
                actionHref="/categories"
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {addresses.map((address) => (
                  <li
                    key={address.id}
                    className="bg-surface border border-border-base rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">{address.fullName}</p>
                      {address.isDefault && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-surface-sunken text-slate-700">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      {address.addressLine1}
                      {address.addressLine2 && `, ${address.addressLine2}`}
                      <br />
                      {address.city}, {address.state} — {address.pincode}
                    </p>
                  </li>
                ))}
              </ul>
            ))}

          {activeTab === "profile" && (
            <div className="space-y-4">
              <div className="bg-surface border border-border-base rounded-lg p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
                  Account Details
                </h2>
                <dl className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <dt className="text-xs text-muted">Full Name</dt>
                      <dd className="text-sm text-slate-900">{user.name ?? "—"}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <dt className="text-xs text-muted">Email Address</dt>
                      <dd className="text-sm text-slate-900">{user.email ?? "—"}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <dt className="text-xs text-muted">Phone Number</dt>
                      <dd className="text-sm text-slate-900">{user.phone ?? "—"}</dd>
                    </div>
                  </div>
                </dl>
              </div>

              <SignOutButton />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
