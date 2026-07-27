"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getLeadDetails, updateLeadStatus, updateLeadNotes } from "../actions";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Check,
  MessageSquare,
  User,
  Calendar,
  Package,
  ExternalLink,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  pincode: string | null;
  productId: string | null;
  productName: string;
  message: string | null;
  status: string;
  ownerNotes: string | null;
  followupDate: Date | null;
  sourceUrl: string | null;
  createdAt: Date;
  product: {
    title: string;
    basePrice: number;
    isAvailable: boolean;
    images: {
      image: {
        url: string;
      };
    }[];
  } | null;
}

export default function LeadDetailsPage({ params }: { params: { id: string } }) {
  const leadId = params.id;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [status, setStatus] = useState("");
  const [ownerNotes, setOwnerNotes] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    fetchLead();
  }, [leadId]);

  const fetchLead = async () => {
    setLoading(true);
    setError(null);
    const res = await getLeadDetails(leadId);
    if (res.success && res.lead) {
      const l = res.lead as any;
      setLead(l);
      setStatus(l.status);
      setOwnerNotes(l.ownerNotes || "");
      if (l.followupDate) {
        const date = new Date(l.followupDate);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        setFollowupDate(`${yyyy}-${mm}-${dd}`);
      } else {
        setFollowupDate("");
      }
    } else {
      setError(res.error || "Failed to load lead details");
    }
    setLoading(false);
  };

  const handleUpdateStatus = async () => {
    setSavingStatus(true);
    setError(null);
    setSuccessMsg(null);
    const res = await updateLeadStatus(leadId, status);
    if (res.success) {
      setSuccessMsg("Lead status updated successfully!");
      fetchLead();
    } else {
      setError(res.error || "Failed to update status");
    }
    setSavingStatus(false);
  };

  const handleUpdateNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotes(true);
    setError(null);
    setSuccessMsg(null);
    const res = await updateLeadNotes(leadId, {
      followupDate: followupDate || null,
      ownerNotes: ownerNotes || null,
    });
    if (res.success) {
      setSuccessMsg("Follow-up notes updated successfully!");
      fetchLead();
    } else {
      setError(res.error || "Failed to update follow-up logs");
    }
    setSavingNotes(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-2">
        <Loader2 size={32} className="animate-spin text-[#EA580C]" />
        <span>Loading lead information...</span>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="glass-card p-12 text-center text-slate-455 max-w-xl mx-auto">
        <AlertCircle size={40} className="mx-auto text-rose-500 mb-3" />
        <h3 className="font-sans font-bold text-[#0F172A] text-lg">Inquiry Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">This lead record does not exist or has been deleted.</p>
        <Link href="/admin/leads" className="text-[#EA580C] text-xs font-bold hover:underline mt-4 inline-block">
          Back to Leads
        </Link>
      </div>
    );
  }

  const mainProductImage = lead.product?.images.find((img) => img.image)?.image?.url || "";

  return (
    <div className="font-sans space-y-6 max-w-5xl mx-auto">
      {/* Header back button */}
      <div className="flex items-center gap-4 mb-4">
        <Link
          href="/admin/leads"
          className="p-2 rounded-[4px] bg-white border border-[#E2E8F0] text-[#475569] hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <span className="font-mono text-xs font-bold text-[#EA580C] bg-[#FFF7ED] border border-[#FFEDD5] px-2.5 py-0.5 rounded-[4px]">
            #{lead.id}
          </span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-[6px] flex items-center gap-2">
          <AlertCircle size={18} />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-[6px] flex items-center gap-2">
          <Check size={18} />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Client Message & Product Info (Left/Top) ───────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Message Card */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
              <MessageSquare size={18} className="text-[#EA580C]" />
              Client Inquiry Message
            </h3>

            <div className="bg-[#F8FAFC] p-4 rounded-[6px] border border-[#E2E8F0]">
              <p className="text-sm text-[#0F172A] font-medium leading-relaxed whitespace-pre-wrap">
                {lead.message || "No message left. Callback request only."}
              </p>
            </div>

            {lead.sourceUrl && (
              <div className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5 pt-1">
                <span>Inquired From Page:</span>
                <a
                  href={lead.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#EA580C] hover:underline truncate max-w-xs md:max-w-md flex items-center gap-0.5"
                >
                  {lead.sourceUrl}
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>

          {/* Product Attachment Card */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
              <Package size={18} className="text-[#EA580C]" />
              Inquired Product Details
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {mainProductImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mainProductImage} alt={lead.productName} className="object-contain w-full h-full p-1" />
                  ) : (
                    <Package size={24} className="text-slate-350" />
                  )}
                </div>
                <div>
                  <h4 className="font-sans font-bold text-[#0F172A] text-base leading-tight">
                    {lead.productName}
                  </h4>
                  {lead.product ? (
                    <p className="text-xs text-[#EA580C] font-bold mt-1">
                      Base Price: {formatINR(lead.product.basePrice)}
                    </p>
                  ) : (
                    <p className="text-xs text-rose-600 font-bold mt-0.5">
                      This product has been deleted from catalog.
                    </p>
                  )}
                </div>
              </div>

              {lead.productId && lead.product?.isAvailable && (
                <Link
                  href={`/admin/products/${lead.productId}/edit`}
                  className="py-1.5 px-3 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#EA580C]/40 text-xs font-bold text-[#475569] hover:text-[#0F172A] transition-colors flex items-center justify-center gap-1.5 flex-shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  <ExternalLink size={12} />
                  <span>Configure Product</span>
                </Link>
              )}
            </div>
          </div>

          {/* Follow-up Note Taker Form */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
              <Calendar size={18} className="text-[#EA580C]" />
              Staff Follow-up & Callback Action Notes
            </h3>

            <form onSubmit={handleUpdateNotes} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-[#475569] font-bold">Followup Date Calendar Alert</label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFormFollowupDate(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-xs text-[#0f172a] focus:outline-none focus:border-[#EA580C] font-mono max-w-xs cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-[#475569] font-bold">Internal Staff/Owner Call Logs & Progress Notes</label>
                <textarea
                  value={ownerNotes}
                  onChange={(e) => setOwnerNotes(e.target.value)}
                  placeholder="Record calls, pricing quotes, or notes here..."
                  rows={4}
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-xs text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
                />
              </div>

              <button
                type="submit"
                disabled={savingNotes}
                className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white py-2 px-4 rounded-[4px] font-semibold text-xs cursor-pointer transition-colors"
              >
                {savingNotes ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Saving Notes...
                  </>
                ) : (
                  "Save Followup Notes"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── Status & Customer Profile (Right/Bottom) ────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          {/* Status Changer */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3">
              Lead status
            </h3>

            <div className="space-y-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
              >
                <option value="NEW">NEW (Unopened / Fresh lead)</option>
                <option value="CONTACTED">CONTACTED (Followed up / In discussion)</option>
                <option value="QUOTED">QUOTED (Price quote sent)</option>
                <option value="CLOSED_WON">CLOSED WON (Deal booked / Converted)</option>
                <option value="CLOSED_LOST">CLOSED LOST (Lost deal)</option>
              </select>

              <button
                onClick={handleUpdateStatus}
                disabled={savingStatus}
                className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold py-2.5 px-4 rounded-[4px] text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {savingStatus ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Updating Status...
                  </>
                ) : (
                  "Update Status"
                )}
              </button>
            </div>
          </div>

          {/* Customer Profile */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-sans font-bold text-[#0F172A] text-base border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
              <User size={18} className="text-[#EA580C]" />
              Client Profile
            </h3>

            <div className="space-y-3 text-xs font-bold text-[#475569]">
              <div>
                <p className="text-[10px] text-slate-405 uppercase tracking-wide">Client Name</p>
                <p className="text-[#0F172A] mt-0.5 font-bold">{lead.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-405 uppercase tracking-wide">Phone Number</p>
                <p className="text-[#0F172A] font-mono mt-0.5">{lead.phone}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-405 uppercase tracking-wide">Email Address</p>
                <p className="text-[#0F172A] font-mono mt-0.5 truncate">{lead.email || "N/A"}</p>
              </div>
              <div className="border-t border-[#E2E8F0] pt-3 mt-3">
                <p className="text-[10px] text-slate-405 uppercase tracking-wide">Location</p>
                <p className="text-[#0F172A] mt-0.5">
                  {lead.city || "Unknown City"}
                  {lead.pincode ? ` - ${lead.pincode}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function setFormFollowupDate(val: string) {
    setFollowupDate(val);
  }
}
