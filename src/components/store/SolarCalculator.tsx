"use client";

import React, { useState, useTransition } from "react";
import {
  Sun,
  Zap,
  TrendingDown,
  ShieldCheck,
  Phone,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Award,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { formatINR, ownerWhatsAppUrl } from "@/lib/utils";
import { submitSolarInquiry } from "@/app/(store)/actions";

export default function SolarCalculator() {
  // Input parameters
  const [monthlyBill, setMonthlyBill] = useState<number>(3500);
  const [connectionType, setConnectionType] = useState<"RESIDENTIAL" | "COMMERCIAL">("RESIDENTIAL");
  const [roofArea, setRoofArea] = useState<number>(350); // sq ft

  // Lead capture form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Suriyawan");
  const [pincode, setPincode] = useState("221404");
  const [leadStatus, setLeadStatus] = useState<"IDLE" | "SUCCESS" | "ERROR">("IDLE");
  const [leadError, setLeadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Calculation Logic ──────────────────────────────────────────────────────
  // Average UP electricity tariff ~ ₹7.50 / unit (kWh)
  const tariffPerUnit = connectionType === "RESIDENTIAL" ? 7.5 : 9.0;
  const estimatedMonthlyUnits = Math.round(monthlyBill / tariffPerUnit);
  const estimatedDailyUnits = estimatedMonthlyUnits / 30;

  // 1 kW solar generates ~4 units/day in Uttar Pradesh
  const rawSizeKw = estimatedDailyUnits / 4.0;
  // Sizing rounded to nearest 0.5 kW (minimum 1 kW, max 20 kW for calculator)
  const recommendedKw = Math.max(1, Math.min(20, Math.round(rawSizeKw * 2) / 2));

  // Required rooftop area ~ 80-100 sq ft per kW
  const requiredRoofSqFt = Math.round(recommendedKw * 90);
  const isRoofAdequate = roofArea >= requiredRoofSqFt;

  // Cost estimates: ~₹55,000 - ₹60,000 per kW on-grid setup with Tier-1 bifacial panels & DCR
  const grossCost = recommendedKw * 58000;

  // PM Surya Ghar Muft Bijli Yojana Central Govt Subsidy:
  // 1 kW -> ₹30,000
  // 2 kW -> ₹60,000
  // 3 kW+ -> ₹78,000 (Max subsidy cap for residential)
  let subsidy = 0;
  if (connectionType === "RESIDENTIAL") {
    if (recommendedKw <= 1) {
      subsidy = 30000;
    } else if (recommendedKw <= 2) {
      subsidy = 60000;
    } else {
      subsidy = 78000;
    }
  }

  const netCost = Math.max(0, grossCost - subsidy);
  const monthlySavings = Math.round(recommendedKw * 4 * 30 * tariffPerUnit);
  const annualSavings = monthlySavings * 12;
  const paybackYears = (netCost / annualSavings).toFixed(1);
  const lifetime25YrSavings = annualSavings * 25 - netCost;

  function handleDispatchQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !phone || !pincode) {
      setLeadError("Please fill in your name, mobile number, and pincode.");
      return;
    }
    setLeadError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("phone", phone);
    formData.set("city", city);
    formData.set("pincode", pincode);
    formData.set("interest", "ROOFTOP");
    formData.set("propertyType", connectionType === "RESIDENTIAL" ? "Residential Home" : "Commercial");
    formData.set("monthlyBill", `₹${monthlyBill.toLocaleString("en-IN")}/month`);
    formData.set("roofArea", `${roofArea} sq.ft.`);
    formData.set(
      "notes",
      `Online Solar Estimate: Recommended ${recommendedKw} kW system | Gross: ₹${grossCost.toLocaleString("en-IN")} | PM Subsidy: ₹${subsidy.toLocaleString("en-IN")} | Net: ₹${netCost.toLocaleString("en-IN")} | Est. Annual Savings: ₹${annualSavings.toLocaleString("en-IN")}`
    );

    const quoteSummary = `☀️ *Vaishnavi Enterprises — Solar Rooftop Quote Request*
*Customer:* ${name} (${phone})
*Location:* ${city}, UP — ${pincode}
*Monthly Bill:* ₹${monthlyBill.toLocaleString("en-IN")}
*Recommended Solar:* ${recommendedKw} kW Rooftop System
*Estimated Gross Cost:* ₹${grossCost.toLocaleString("en-IN")}
*PM Surya Ghar Subsidy:* -₹${subsidy.toLocaleString("en-IN")}
*Net Investment:* ₹${netCost.toLocaleString("en-IN")}
*Annual Bill Savings:* ₹${annualSavings.toLocaleString("en-IN")}/yr

Please arrange a site survey and assist with PM Surya Ghar portal subsidy registration.`;

    startTransition(async () => {
      try {
        await submitSolarInquiry(null, formData);
        setLeadStatus("SUCCESS");
        // Open WhatsApp directly with the pre-filled quote
        const waUrl = ownerWhatsAppUrl(quoteSummary);
        window.open(waUrl, "_blank");
      } catch (_) {
        setLeadStatus("ERROR");
        setLeadError("Failed to save enquiry. Opening WhatsApp directly.");
        const waUrl = ownerWhatsAppUrl(quoteSummary);
        window.open(waUrl, "_blank");
      }
    });
  }

  return (
    <div id="calculator" className="bg-white border border-slate-200 shadow-md rounded-xl p-6 lg:p-10">
      <div className="max-w-2xl mx-auto text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider mb-3">
          <Sun size={14} className="text-amber-600 animate-spin-slow" />
          <span>PM Surya Ghar: Muft Bijli Yojana Calculator</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Instant Solar Rooftop Sizing & Subsidy Estimator
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          Calculate your required solar capacity, government subsidy, and 25-year bill savings in
          seconds.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Inputs Column */}
        <div className="lg:col-span-6 space-y-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-3 flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            1. Your Electricity & Roof Details
          </h3>

          {/* Connection Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Property / Connection Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConnectionType("RESIDENTIAL")}
                className={`py-2.5 px-4 rounded-lg text-xs font-bold border transition-all text-center ${
                  connectionType === "RESIDENTIAL"
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                }`}
              >
                Residential (Home)
              </button>
              <button
                type="button"
                onClick={() => setConnectionType("COMMERCIAL")}
                className={`py-2.5 px-4 rounded-lg text-xs font-bold border transition-all text-center ${
                  connectionType === "COMMERCIAL"
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                }`}
              >
                Commercial / Shop
              </button>
            </div>
          </div>

          {/* Monthly Bill Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Average Monthly Electricity Bill
              </label>
              <span className="text-base font-black text-slate-900 font-mono">
                {formatINR(monthlyBill)}
              </span>
            </div>
            <input
              type="range"
              min={1000}
              max={25000}
              step={250}
              value={monthlyBill}
              onChange={(e) => setMonthlyBill(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-orange-600"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
              <span>₹1,000</span>
              <span>₹10,000</span>
              <span>₹25,000+</span>
            </div>
          </div>

          {/* Roof Area Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Available Rooftop Area
              </label>
              <span className="text-base font-black text-slate-900 font-mono">
                {roofArea} sq. ft.
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={2500}
              step={50}
              value={roofArea}
              onChange={(e) => setRoofArea(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-orange-600"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
              <span>100 sq.ft.</span>
              <span>1,200 sq.ft.</span>
              <span>2,500+ sq.ft.</span>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Est. Monthly Consumption:</span>
              <span className="font-bold text-slate-900 font-mono">
                ~{estimatedMonthlyUnits} Units (kWh)
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Required Shadow-Free Roof:</span>
              <span
                className={`font-bold font-mono ${
                  isRoofAdequate ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                ~{requiredRoofSqFt} sq. ft. ({isRoofAdequate ? "Sufficient" : "Tight space"})
              </span>
            </div>
          </div>
        </div>

        {/* Right Sizing Results & WhatsApp Quote */}
        <div className="lg:col-span-6 space-y-6">
          {/* Results Summary Box */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 sm:p-7 rounded-xl shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-amber-400 font-bold">
                  Recommended System Size
                </p>
                <p className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-0.5">
                  {recommendedKw} kW <span className="text-base font-normal text-slate-300">On-Grid</span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
                <Sun size={26} />
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Estimated Gross Cost (Panels + Inverter + GI Structure):</span>
                <span className="font-mono font-medium text-white">{formatINR(grossCost)}</span>
              </div>

              {connectionType === "RESIDENTIAL" && subsidy > 0 && (
                <div className="flex justify-between text-emerald-400 font-bold bg-emerald-950/40 px-2.5 py-1.5 rounded border border-emerald-800/40">
                  <span className="flex items-center gap-1">
                    <Award size={14} /> PM Surya Ghar Central Subsidy:
                  </span>
                  <span className="font-mono">-{formatINR(subsidy)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-700">
                <span>Net Customer Outflow:</span>
                <span className="text-amber-400 font-mono text-base">{formatINR(netCost)}</span>
              </div>
            </div>

            {/* ROI Metrics Cards */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-800/70 p-3 rounded-lg border border-slate-700 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  Annual Electricity Savings
                </p>
                <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                  {formatINR(annualSavings)}/yr
                </p>
              </div>

              <div className="bg-slate-800/70 p-3 rounded-lg border border-slate-700 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  System Payback Period
                </p>
                <p className="text-lg font-black text-amber-400 font-mono mt-0.5">
                  ~{paybackYears} Years
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              💡 Estimated 25-Year Lifetime Savings:{" "}
              <strong className="text-emerald-400">{formatINR(lifetime25YrSavings)}</strong>
            </p>
          </div>

          {/* 1-Click WhatsApp Lead Generator */}
          <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                <MessageCircle size={17} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Get Free On-Site Survey & Subsidy Assistance
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Vaishnavi Enterprises handles DISCOM net-metering & PM Surya Ghar portal
                  registration in Suriyawan and UP.
                </p>
              </div>
            </div>

            {leadStatus === "SUCCESS" ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-2">
                <CheckCircle2 size={28} className="text-emerald-600 mx-auto" />
                <p className="font-bold text-emerald-900 text-sm">Quote Sent to WhatsApp!</p>
                <p className="text-emerald-700 text-xs">
                  Our solar engineer will review your rooftop details and contact you shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleDispatchQuote} className="space-y-3">
                {leadError && (
                  <p className="text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle size={13} /> {leadError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Anand Upadhyay"
                      className="w-full h-9 px-3 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      WhatsApp Mobile <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile"
                      className="w-full h-9 px-3 font-mono rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">City / Village</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full h-9 px-3 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">Pincode</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full h-9 px-3 font-mono rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-whatsapp hover:opacity-90 text-white text-xs font-bold uppercase tracking-wider transition-opacity shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <MessageCircle size={16} />
                  )}
                  <span>Get Free WhatsApp Proposal & Site Survey</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
