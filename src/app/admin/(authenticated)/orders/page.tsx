"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getOrders } from "./actions";
import {
  Search,
  ShoppingBag,
  Loader2,
  AlertCircle,
  Eye,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  deliveryZone: string;
  createdAt: Date;
  user: {
    name: string | null;
    email: string | null;
  };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    const res = await getOrders();
    if (res.success && res.orders) {
      setOrders(res.orders as any);
    } else {
      setError(res.error || "Failed to load orders");
    }
    setLoading(false);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]";
      case "CAPTURED":
        return "bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]";
      case "COD_CONFIRMED":
        return "bg-[#F3E8FF] text-[#6B21A8] border-[#E9D5FF]";
      case "FULFILLED":
        return "bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]";
      case "DELIVERED":
        return "bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]";
      case "CANCELLED":
        return "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]";
      case "REFUNDED":
        return "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.user.name && order.user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (order.user.email && order.user.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" || order.status === statusFilter;

    const matchesPayment =
      paymentFilter === "ALL" || order.paymentMethod === paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  return (
    <div className="font-sans space-y-6">
      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-[6px] flex items-center gap-2">
          <AlertCircle size={18} />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      {/* Toolbar / Filters */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center gap-4 justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-405" />
          <input
            type="text"
            placeholder="Search by order ID, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] pl-9 pr-3 py-2 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#EA580C] focus:ring-0 font-sans"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-1.5 text-xs font-semibold text-[#475569] focus:outline-none focus:border-[#EA580C] cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CAPTURED">Paid (Captured)</option>
            <option value="COD_CONFIRMED">COD Confirmed</option>
            <option value="FULFILLED">Shipped (Fulfilled)</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-1.5 text-xs font-semibold text-[#475569] focus:outline-none focus:border-[#EA580C] cursor-pointer"
          >
            <option value="ALL">All Payments</option>
            <option value="RAZORPAY">Razorpay</option>
            <option value="COD">Cash on Delivery</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 size={32} className="animate-spin text-[#EA580C]" />
          <span>Loading orders...</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-450">
          <ShoppingBag size={48} className="mx-auto text-slate-350 mb-3" />
          <p className="text-sm font-semibold text-[#0F172A]">No orders found</p>
          <p className="text-xs text-slate-500 mt-1">Orders placed by storefront clients will show here.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden border border-[#E2E8F0]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#475569] tracking-wider uppercase">
                  <th className="px-6 py-3.5">Order ID</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">Payment</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] bg-white">
                {filteredOrders.map((order) => {
                  const dateStr = new Date(order.createdAt).toLocaleDateString(
                    "en-IN",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  );

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Order ID */}
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-xs font-mono font-bold text-[#0F172A] hover:text-[#EA580C] hover:underline"
                        >
                          #{order.id.slice(0, 8)}...
                        </Link>
                      </td>

                      {/* Customer */}
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-[#0F172A]">
                          {order.user.name || "Unknown Customer"}
                        </p>
                        <p className="text-[10px] text-[#64748B] truncate max-w-xs">
                          {order.user.email || "No Email"}
                        </p>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {dateStr}
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-4 text-xs font-bold text-[#EA580C]">
                        {formatINR(order.totalAmount)}
                      </td>

                      {/* Payment Method */}
                      <td className="px-6 py-4">
                        <span className="text-[10px] bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] px-2 py-0.5 rounded-[4px] font-bold">
                          {order.paymentMethod}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                            order.status
                          )}`}
                        >
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="p-1.5 rounded-[4px] border border-[#E2E8F0] hover:border-[#EA580C]/35 text-[#475569] hover:text-[#0F172A] transition-colors inline-flex items-center gap-1.5 text-xs font-semibold"
                          title="View Order Details"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
