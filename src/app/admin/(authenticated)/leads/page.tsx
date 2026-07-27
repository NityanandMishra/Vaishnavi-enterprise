"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getLeads } from "./actions";
import {
  Search,
  MessageSquare,
  Eye,
  Loader2,
  AlertCircle,
  Calendar,
} from "lucide-react";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  pincode: string | null;
  productId: string | null;
  productName: string;
  status: string;
  followupDate: Date | null;
  createdAt: Date;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    const res = await getLeads();
    if (res.success && res.leads) {
      setLeads(res.leads as any);
    } else {
      setError(res.error || "Failed to load leads");
    }
    setLoading(false);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "NEW":
        return "bg-orange-50 text-orange-800 border-orange-105";
      case "CONTACTED":
        return "bg-amber-50 text-amber-800 border-amber-100";
      case "QUOTED":
        return "bg-blue-50 text-blue-800 border-blue-100";
      case "CLOSED_WON":
        return "bg-emerald-50 text-emerald-800 border-emerald-100";
      case "CLOSED_LOST":
        return "bg-rose-50 text-rose-800 border-rose-100";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const isFollowupOverdue = (date: Date | null) => {
    if (!date) return false;
    const now = new Date();
    const fDate = new Date(date);
    now.setHours(0, 0, 0, 0);
    fDate.setHours(0, 0, 0, 0);
    return fDate.getTime() <= now.getTime();
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery) ||
      (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      lead.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.city && lead.city.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
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
            placeholder="Search leads by name, phone..."
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
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUOTED">Quoted</option>
            <option value="CLOSED_WON">Converted (Closed Won)</option>
            <option value="CLOSED_LOST">Lost (Closed Lost)</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 size={32} className="animate-spin text-[#EA580C]" />
          <span>Loading inquiries...</span>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-450">
          <MessageSquare size={48} className="mx-auto text-slate-350 mb-3" />
          <p className="text-sm font-semibold text-[#0F172A]">No inquiries found</p>
          <p className="text-xs text-slate-500 mt-1">Callback requests placed on custom-mode products will show here.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden border border-[#E2E8F0]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#475569] tracking-wider uppercase">
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Phone / Email</th>
                  <th className="px-6 py-3.5">Inquiry Source</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Followup Date</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] bg-white">
                {filteredLeads.map((lead) => {
                  const dateStr = new Date(lead.createdAt).toLocaleDateString(
                    "en-IN",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }
                  );

                  let followupStr = "No follow-up";
                  let isOverdue = false;
                  if (lead.followupDate) {
                    followupStr = new Date(lead.followupDate).toLocaleDateString(
                      "en-IN",
                      {
                        day: "numeric",
                        month: "short",
                      }
                    );
                    isOverdue = isFollowupOverdue(lead.followupDate) && lead.status !== "CLOSED_WON" && lead.status !== "CLOSED_LOST";
                  }

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Customer Name */}
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-[#0F172A]">
                          {lead.name}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                          Rec: {dateStr}
                        </p>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4">
                        <p className="text-xs font-mono font-semibold text-[#0f172a]">
                          {lead.phone}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[150px]">
                          {lead.email || "No Email"}
                        </p>
                      </td>

                      {/* Product Inquiry Source */}
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-[#0F172A] truncate max-w-xs" title={lead.productName}>
                          {lead.productName}
                        </p>
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4">
                        <p className="text-xs text-[#0f172a] font-medium">
                          {lead.city || "Unknown City"}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">
                          Pin: {lead.pincode || "N/A"}
                        </p>
                      </td>

                      {/* Follow-up Date */}
                      <td className="px-6 py-4">
                        {lead.followupDate ? (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] flex items-center gap-1.5 w-fit border ${
                              isOverdue
                                ? "bg-rose-50 border-rose-200 text-rose-700 font-bold"
                                : "bg-[#F8FAFC] border-[#E2E8F0] text-[#475569]"
                            }`}
                          >
                            <Calendar size={10} />
                            {followupStr}
                            {isOverdue && <span className="text-[8px] uppercase font-extrabold">(Alert)</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                            lead.status
                          )}`}
                        >
                          {lead.status.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Action View */}
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/leads/${lead.id}`}
                          className="p-1.5 rounded-[4px] border border-[#E2E8F0] hover:border-[#EA580C]/35 text-[#475569] hover:text-[#0F172A] transition-colors inline-flex items-center gap-1.5 text-xs font-semibold"
                          title="View Inquiry Details"
                        >
                          <Eye size={12} />
                          <span>Detail</span>
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
