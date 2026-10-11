import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import {
  Package,
  MapPin,
  User,
  ChevronRight,
  Mail,
  Phone,
  Heart,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Truck,
  FileText,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import { cn, formatINR } from "@/lib/utils";
import EmptyState from "@/components/store/EmptyState";
import AddressManager from "@/components/store/AddressManager";
import ProfileManager from "@/components/store/ProfileManager";

export const metadata: Metadata = { title: "My Account — Vaishnavi Enterprises" };

const TABS = [
  { value: "orders", label: "Order History", icon: Package },
  { value: "transactions", label: "Transactions", icon: CreditCard },
  { value: "addresses", label: "Addresses", icon: MapPin },
  { value: "profile", label: "Profile", icon: User },
] as const;

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning border-warning/20",
  CONFIRMED: "bg-success/10 text-success border-success/20",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  PACKED: "bg-purple-50 text-purple-700 border-purple-200",
  SHIPPED: "bg-surface-sunken text-slate-700 border-slate-300",
  DELIVERED: "bg-success/10 text-success border-success/20",
  CANCELLED: "bg-danger/10 text-danger border-danger/20",
  RETURNED: "bg-slate-200 text-slate-700 border-slate-300",
  CAPTURED: "bg-success/10 text-success border-success/20",
  COD_CONFIRMED: "bg-success/10 text-success border-success/20",
  FULFILLED: "bg-surface-sunken text-slate-700 border-slate-300",
  REFUNDED: "bg-slate-200 text-slate-700 border-slate-300",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { tab?: string; filter?: string; txnFilter?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/auth/login?callbackUrl=/account");

  const activeTab = TABS.some((t) => t.value === searchParams.tab)
    ? (searchParams.tab as string)
    : "orders";

  const orderFilter = searchParams.filter || "all";
  const txnFilter = searchParams.txnFilter || "all";

  const [user, orders, addresses, wishlistCount, transactions] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          select: {
            id: true,
            productName: true,
            variantTitle: true,
            quantity: true,
            price: true,
          },
        },
        shipments: {
          select: { id: true, status: true, awbNumber: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true },
        },
      },
    }),
    prisma.address.findMany({ where: { userId }, orderBy: { isDefault: "desc" } }),
    prisma.wishlistItem.count({ where: { userId } }),
    prisma.paymentTransaction.findMany({
      where: {
        order: { userId },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) redirect("/auth/login?callbackUrl=/account");

  // Filter Orders for the Orders Tab
  const activeStatuses = [
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "PACKED",
    "SHIPPED",
    "CAPTURED",
    "COD_CONFIRMED",
    "FULFILLED",
  ];
  const deliveredStatuses = ["DELIVERED"];
  const cancelledStatuses = ["CANCELLED"];
  const returnedStatuses = ["RETURNED", "RETURN_REQUESTED", "REFUNDED"];

  const activeOrdersCount = orders.filter((o) => activeStatuses.includes(o.status)).length;
  const deliveredOrdersCount = orders.filter((o) => deliveredStatuses.includes(o.status)).length;
  const cancelledOrdersCount = orders.filter((o) => cancelledStatuses.includes(o.status)).length;
  const returnedOrdersCount = orders.filter((o) => returnedStatuses.includes(o.status)).length;

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === "active") return activeStatuses.includes(o.status);
    if (orderFilter === "delivered") return deliveredStatuses.includes(o.status);
    if (orderFilter === "cancelled") return cancelledStatuses.includes(o.status);
    if (orderFilter === "returned") return returnedStatuses.includes(o.status);
    return true; // "all"
  });

  // Filter Transactions for the Transactions Tab
  const successfulTxnCount = transactions.filter((t) =>
    ["PAID", "SUCCESS", "CAPTURED"].includes(t.status)
  ).length;
  const failedTxnCount = transactions.filter((t) => t.status === "FAILED").length;
  const pendingTxnCount = transactions.filter((t) =>
    ["PENDING", "REFUNDED"].includes(t.status)
  ).length;

  const filteredTransactions = transactions.filter((t) => {
    if (txnFilter === "successful") return ["PAID", "SUCCESS", "CAPTURED"].includes(t.status);
    if (txnFilter === "failed") return t.status === "FAILED";
    if (txnFilter === "pending") return ["PENDING", "REFUNDED"].includes(t.status);
    return true; // "all"
  });

  return (
    <div className="wrap pt-6 pb-16">
      {/* Profile summary header */}
      <div className="bg-surface border border-border-base rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shadow-xs">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <User size={28} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
              {user.name || "Trade Customer"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 truncate">{user.email}</p>
            {user.phone && (
              <p className="text-xs text-slate-500 font-mono mt-0.5">{user.phone}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-border-base">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">
            {orders.length} {orders.length === 1 ? "Order" : "Orders"}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">
            {transactions.length} {transactions.length === 1 ? "Transaction" : "Transactions"}
          </span>
          <Link
            href="/wishlist"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200 hover:text-brand-orange-600 hover:border-brand-orange-200 transition-colors"
          >
            <Heart size={12} className="text-rose-500" /> {wishlistCount} Saved
          </Link>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:items-start">
        {/* Navigation Rail — horizontal scroll on mobile, sticky vertical rail on desktop */}
        <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar border-b lg:border-b-0 border-border-base mb-6 lg:mb-0 lg:sticky lg:top-24">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.value;
            return (
              <Link
                key={tab.value}
                href={`/account?tab=${tab.value}`}
                className={cn(
                  "flex-shrink-0 min-h-[46px] flex items-center gap-2.5 px-4 text-xs font-semibold uppercase tracking-wider transition-colors lg:rounded-lg",
                  isCurrent
                    ? "text-slate-900 border-b-2 lg:border-b-0 border-slate-900 lg:bg-white lg:border lg:border-slate-200 lg:shadow-xs"
                    : "text-slate-500 hover:text-slate-900 lg:hover:bg-slate-100/60"
                )}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
          <Link
            href="/wishlist"
            className="flex-shrink-0 min-h-[46px] flex items-center gap-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-900 lg:hover:bg-slate-100/60 lg:rounded-lg transition-colors"
          >
            <Heart size={16} />
            <span>Saved Wishlist</span>
          </Link>
        </nav>

        {/* ── Main Tab Content ── */}
        <div className="min-w-0">
          {/* ═══════════════════════════════════════════════════════════════════
              TAB 1: ORDER HISTORY (With Delivered, Returned, Cancelled filters)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              {/* Order Status Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: "all", label: "All Orders", count: orders.length },
                  { id: "active", label: "In Transit / Active", count: activeOrdersCount },
                  { id: "delivered", label: "Delivered", count: deliveredOrdersCount },
                  { id: "cancelled", label: "Cancelled", count: cancelledOrdersCount },
                  { id: "returned", label: "Returned", count: returnedOrdersCount },
                ].map((pill) => {
                  const isActivePill = orderFilter === pill.id;
                  return (
                    <Link
                      key={pill.id}
                      href={`/account?tab=orders&filter=${pill.id}`}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border",
                        isActivePill
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-surface text-slate-600 border-border-base hover:bg-slate-100"
                      )}
                    >
                      <span>{pill.label}</span>
                      <span
                        className={cn(
                          "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                          isActivePill ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                        )}
                      >
                        {pill.count}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {filteredOrders.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title={
                    orderFilter === "all"
                      ? "No orders yet"
                      : `No ${orderFilter} orders found`
                  }
                  description={
                    orderFilter === "all"
                      ? "Once you place an order, live tracking, courier waybills, and invoices will appear here."
                      : `You currently have no orders matching the "${orderFilter}" filter.`
                  }
                  actionLabel={orderFilter === "all" ? "Explore Catalog" : "View All Orders"}
                  actionHref={orderFilter === "all" ? "/categories" : "/account?tab=orders&filter=all"}
                />
              ) : (
                <ul className="space-y-3">
                  {filteredOrders.map((order) => {
                    const orderFormattedNumber =
                      order.orderNumber || `#${order.id.slice(0, 8).toUpperCase()}`;
                    const hasShipment = order.shipments && order.shipments.length > 0;
                    const isDelivered = order.status === "DELIVERED";
                    const isCancelled = order.status === "CANCELLED";

                    return (
                      <li key={order.id}>
                        <div className="bg-surface border border-border-base rounded-xl p-4 sm:p-5 hover:border-slate-300 transition-colors shadow-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-base">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">
                                {orderFormattedNumber}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
                                  STATUS_TONE[order.status] ?? "bg-slate-200 text-slate-700 border-slate-300"
                                )}
                              >
                                {order.status.replace(/_/g, " ")}
                              </span>
                              {order.invoice?.invoiceNumber && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {order.invoice.invoiceNumber}
                                </span>
                              )}
                            </div>

                            <span className="text-base font-bold text-slate-900 font-mono">
                              {formatINR(order.totalAmount)}
                            </span>
                          </div>

                          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                            <div>
                              <p className="text-slate-500">
                                Placed on{" "}
                                <strong className="text-slate-800">
                                  {order.createdAt.toLocaleDateString("en-IN", {
                                    dateStyle: "medium",
                                  })}
                                </strong>{" "}
                                · {order.items.length}{" "}
                                {order.items.length === 1 ? "line item" : "line items"}
                              </p>
                              <p className="text-slate-500 mt-0.5">
                                Payment:{" "}
                                <span className="font-semibold text-slate-700">
                                  {order.paymentMethod === "COD" ? "Cash on Delivery" : "Online / Razorpay"}
                                </span>{" "}
                                ({order.paymentStatus})
                              </p>
                            </div>

                            {/* Item Title Preview */}
                            <div className="text-slate-400 text-[11px] truncate max-w-xs">
                              {order.items.map((i) => i.productName || "Product").join(", ")}
                            </div>
                          </div>

                          {/* Quick Action Links Footer */}
                          <div className="pt-3 border-t border-border-base flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {hasShipment && !isDelivered && !isCancelled && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                  <Truck size={12} /> Courier Tracking Active
                                </span>
                              )}
                              {isDelivered && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                                  <CheckCircle2 size={12} /> Delivered Successfully
                                </span>
                              )}
                              {isCancelled && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                                  <XCircle size={12} /> Cancelled
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Link
                                href={`/account/orders/${order.id}/invoice`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 transition-colors"
                              >
                                <FileText size={13} />
                                <span>GST Invoice</span>
                              </Link>

                              <Link
                                href={`/account/orders/${order.id}`}
                                className="inline-flex items-center gap-1 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded transition-colors"
                              >
                                <span>View Details & Tracking</span>
                                <ChevronRight size={14} />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 2: TRANSACTIONS (Successful & Failed Payment Attempts)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "transactions" && (
            <div className="space-y-4">
              {/* Transactions Header & Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-surface border border-border-base rounded-xl p-4 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total Transactions
                  </p>
                  <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                    {transactions.length}
                  </p>
                </div>
                <div className="bg-surface border border-emerald-200 rounded-xl p-4 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Successful Payments
                  </p>
                  <p className="text-xl font-bold font-mono text-emerald-800 mt-1">
                    {successfulTxnCount}
                  </p>
                </div>
                <div className="bg-surface border border-rose-200 rounded-xl p-4 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                    Failed Attempts
                  </p>
                  <p className="text-xl font-bold font-mono text-rose-800 mt-1">
                    {failedTxnCount}
                  </p>
                </div>
              </div>

              {/* Transaction Filters */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: "all", label: "All Transactions", count: transactions.length },
                  { id: "successful", label: "Successful", count: successfulTxnCount },
                  { id: "failed", label: "Failed Attempts", count: failedTxnCount },
                  { id: "pending", label: "Pending", count: pendingTxnCount },
                ].map((pill) => {
                  const isActive = txnFilter === pill.id;
                  return (
                    <Link
                      key={pill.id}
                      href={`/account?tab=transactions&txnFilter=${pill.id}`}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border",
                        isActive
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-surface text-slate-600 border-border-base hover:bg-slate-100"
                      )}
                    >
                      <span>{pill.label}</span>
                      <span
                        className={cn(
                          "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                          isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                        )}
                      >
                        {pill.count}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {filteredTransactions.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No transaction records"
                  description="All payment attempts, online settlements, and COD records will be logged here."
                  actionLabel="Start Shopping"
                  actionHref="/categories"
                />
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((txn) => {
                    const isSuccess = ["PAID", "SUCCESS", "CAPTURED"].includes(txn.status);
                    const isFailed = txn.status === "FAILED";
                    const isPending = txn.status === "PENDING";

                    return (
                      <div
                        key={txn.id}
                        className={cn(
                          "bg-surface border rounded-xl p-4 sm:p-5 text-xs shadow-xs transition-colors",
                          isSuccess
                            ? "border-emerald-200/80 hover:border-emerald-300"
                            : isFailed
                            ? "border-rose-200/80 hover:border-rose-300"
                            : "border-border-base hover:border-slate-300"
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-base">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 text-sm">
                                {txn.gatewayTransactionId || txn.id.slice(0, 16)}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border flex items-center gap-1",
                                  isSuccess
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : isFailed
                                    ? "bg-rose-50 text-rose-800 border-rose-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                )}
                              >
                                {isSuccess && <CheckCircle2 size={11} />}
                                {isFailed && <XCircle size={11} />}
                                {isPending && <Clock size={11} />}
                                <span>{txn.status}</span>
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 mt-1">
                              {txn.initiatedAt.toLocaleString("en-IN", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}{" "}
                              · Method: <strong>{txn.method}</strong> via{" "}
                              <strong>{txn.gateway}</strong>
                            </p>
                          </div>

                          <div className="sm:text-right">
                            <span className="text-base font-mono font-bold text-slate-900">
                              {formatINR(txn.amountPaise / 100)}
                            </span>
                          </div>
                        </div>

                        {/* Error Message banner if failed */}
                        {isFailed && (
                          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md text-xs flex items-start gap-2">
                            <AlertCircle size={14} className="text-rose-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">Transaction Declined / Failed</p>
                              <p className="text-[11px] text-rose-700 mt-0.5">
                                {txn.gatewayResponseMessage ||
                                  "Payment attempt was declined or timed out. No amount was debited from your account."}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 pt-2 flex items-center justify-between text-xs text-slate-500">
                          {txn.order ? (
                            <Link
                              href={`/account/orders/${txn.order.id}`}
                              className="font-semibold text-slate-800 hover:text-brand-orange-600 transition-colors inline-flex items-center gap-1"
                            >
                              <span>
                                Associated Order: #{txn.order.orderNumber || txn.order.id.slice(0, 8).toUpperCase()}
                              </span>
                              <ChevronRight size={13} />
                            </Link>
                          ) : (
                            <span>Order #{txn.orderId.slice(0, 8)}</span>
                          )}

                          {txn.cardLastFour && (
                            <span className="font-mono text-[11px]">
                              Card ending with ···· {txn.cardLastFour}
                            </span>
                          )}
                          {txn.upiVpaMasked && (
                            <span className="font-mono text-[11px]">
                              VPA: {txn.upiVpaMasked}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 3: ADDRESSES
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "addresses" && <AddressManager addresses={addresses} />}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 4: PROFILE
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "profile" && <ProfileManager user={user} />}
        </div>
      </div>
    </div>
  );
}
