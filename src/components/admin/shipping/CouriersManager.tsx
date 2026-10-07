"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/admin/ui/Toast";
import {
  Truck,
  Plus,
  Upload,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  Shield,
  Edit2,
  Power,
  ChevronRight,
} from "lucide-react";
import Drawer from "@/components/admin/ui/Drawer";

interface CourierItem {
  id: string;
  name: string;
  code: string;
  integrationMode: "API" | "MANUAL";
  supportsCod: boolean;
  supportsReverse: boolean;
  priority: number;
  isActive: boolean;
  serviceablePincodeCount?: number;
  lastHealthCheck?: string | null;
  lastHealthStatus?: "OK" | "FAILED" | null;
  lastFailedAt?: string | null;
}

export default function CouriersManager() {
  const { addToast } = useToast();

  const [couriers, setCouriers] = useState<CourierItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / Add Courier Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<CourierItem | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [integrationMode, setIntegrationMode] = useState<"API" | "MANUAL">("API");
  const [supportsCod, setSupportsCod] = useState(true);
  const [supportsReverse, setSupportsReverse] = useState(true);
  const [priority, setPriority] = useState(1);
  const [isActive, setIsActive] = useState(true);

  // Serviceability upload state
  const [csvContent, setCsvContent] = useState("");
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [uploadResult, setUploadResult] = useState<any | null>(null);

  useEffect(() => {
    fetchCouriers();
  }, []);

  async function fetchCouriers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/couriers");
      if (res.ok) {
        const data = await res.json();
        setCouriers(data.couriers || []);
      }
    } catch (e) {
      console.error(e);
      addToast("Failed to fetch couriers", "error");
    } finally {
      setLoading(false);
    }
  }

  function openCreateDrawer() {
    setEditingCourier(null);
    setName("");
    setCode("");
    setIntegrationMode("API");
    setSupportsCod(true);
    setSupportsReverse(true);
    setPriority(couriers.length + 1);
    setIsActive(true);
    setCsvContent("");
    setUploadResult(null);
    setIsDrawerOpen(true);
  }

  function openEditDrawer(courier: CourierItem) {
    setEditingCourier(courier);
    setName(courier.name);
    setCode(courier.code);
    setIntegrationMode(courier.integrationMode);
    setSupportsCod(courier.supportsCod);
    setSupportsReverse(courier.supportsReverse);
    setPriority(courier.priority);
    setIsActive(courier.isActive);
    setCsvContent("");
    setUploadResult(null);
    setIsDrawerOpen(true);
  }

  async function handleSaveCourier(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      addToast("Name and code are required", "error");
      return;
    }

    try {
      const url = editingCourier
        ? `/api/admin/couriers/${editingCourier.id}`
        : `/api/admin/couriers`;
      const method = editingCourier ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          integrationMode,
          supportsCod,
          supportsReverse,
          priority,
          isActive,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save courier");
      }

      addToast(
        editingCourier ? `Courier '${name}' updated!` : `Courier '${name}' created!`,
        "success"
      );
      setIsDrawerOpen(false);
      fetchCouriers();
    } catch (err: any) {
      addToast(err.message, "error");
    }
  }

  async function handleUploadServiceability() {
    if (!editingCourier) return;
    if (!csvContent.trim()) {
      addToast("Please paste CSV data or choose a file", "error");
      return;
    }

    setUploadingCsv(true);
    try {
      const res = await fetch(`/api/admin/couriers/${editingCourier.id}/serviceability`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: csvContent.trim(),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload serviceability");
      }

      setUploadResult(data);
      addToast(
        `Successfully imported ${data.importedCount} serviceable pincodes!`,
        "success"
      );
      fetchCouriers();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setUploadingCsv(false);
    }
  }

  function downloadCsvTemplate() {
    const csv = "pincode,supportsCod,transitDays\n400001,true,2\n400002,true,2\n560001,true,3\n110001,false,4";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "courier-serviceability-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--gray-900)] dark:text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" /> Courier Partners
          </h1>
          <p className="text-xs text-[var(--gray-500)] mt-1">
            Configure shipping partners, API integration modes, and serviceable delivery pincodes.
          </p>
        </div>

        <button
          onClick={openCreateDrawer}
          className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add Courier
        </button>
      </div>

      {/* TABLE */}
      <div className="border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-xl overflow-hidden bg-white dark:bg-[var(--gray-900)] shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--gray-50)] dark:bg-[var(--gray-800)] border-b border-[var(--gray-200)] dark:border-[var(--gray-700)] text-[var(--gray-500)] uppercase font-semibold">
              <th className="p-3">Courier</th>
              <th className="p-3">Code</th>
              <th className="p-3">Mode</th>
              <th className="p-3">COD</th>
              <th className="p-3">Reverse</th>
              <th className="p-3">Pincodes</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--gray-200)] dark:divide-[var(--gray-700)]">
            {loading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  Loading couriers...
                </td>
              </tr>
            ) : couriers.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  No couriers registered. Add one using the button above.
                </td>
              </tr>
            ) : (
              couriers.map((c) => {
                const isApi = c.integrationMode === "API";
                const hasFailed = c.lastHealthStatus === "FAILED";

                return (
                  <tr
                    key={c.id}
                    className="hover:bg-[var(--gray-50)] dark:hover:bg-[var(--gray-800)]/60 cursor-pointer"
                    onClick={() => openEditDrawer(c)}
                  >
                    <td className="p-3">
                      <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        {c.name}
                        {isApi && (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              hasFailed ? "bg-red-500" : "bg-emerald-500"
                            }`}
                            title={hasFailed ? "Last API call failed" : "API Connected & Healthy"}
                          />
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {isApi ? (
                          hasFailed ? (
                            <span className="text-red-500">Last failed recently</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">API Active</span>
                          )
                        ) : (
                          "Manual Dispatch"
                        )}
                      </div>
                    </td>

                    <td className="p-3 font-mono font-bold text-gray-700 dark:text-gray-300">
                      {c.code}
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                        {c.integrationMode}
                      </span>
                    </td>

                    <td className="p-3">
                      {c.supportsCod ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      )}
                    </td>

                    <td className="p-3">
                      {c.supportsReverse ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      )}
                    </td>

                    <td className="p-3 font-mono">
                      {c.serviceablePincodeCount !== undefined
                        ? c.serviceablePincodeCount.toLocaleString()
                        : "Active"}
                    </td>

                    <td className="p-3 font-bold">{c.priority}</td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          c.isActive
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEditDrawer(c)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-blue-600"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* COURIER DRAWER */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingCourier ? `Edit Courier · ${editingCourier.name}` : "Add Courier Partner"}
        width="wide"
      >
        <form onSubmit={handleSaveCourier} className="space-y-6 pb-20 text-sm">
          {/* GENERAL INFO */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gray-500)]">
              Courier Partner Details
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium block mb-1">Courier Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Delhivery"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-[var(--gray-800)]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Code (Unique) *</label>
                <input
                  type="text"
                  placeholder="e.g. DLV"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase bg-white dark:bg-[var(--gray-800)]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium block mb-1">Integration Mode</label>
                <select
                  value={integrationMode}
                  onChange={(e: any) => setIntegrationMode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-[var(--gray-800)]"
                >
                  <option value="API">API Integration</option>
                  <option value="MANUAL">Manual Dispatch</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Priority Order</label>
                <input
                  type="number"
                  min={1}
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-[var(--gray-800)]"
                />
              </div>
            </div>

            {/* FR-10: CREDENTIALS NEVER EXPOSED IN ADMIN UI */}
            {integrationMode === "API" && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 border rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>API Credentials:</span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                    Configured via environment
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">SEC-05 Compliant</span>
              </div>
            )}

            <div className="flex gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                <input
                  type="checkbox"
                  checked={supportsCod}
                  onChange={(e) => setSupportsCod(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Supports Cash on Delivery (COD)
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                <input
                  type="checkbox"
                  checked={supportsReverse}
                  onChange={(e) => setSupportsReverse(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Supports Reverse Logistics (RTO)
              </label>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Active (Offered for new shipments)
              </label>
            </div>
          </div>

          {/* SERVICEABILITY CSV UPLOAD (IF EDITING) */}
          {editingCourier && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gray-500)] flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Serviceable Pincodes
                </h3>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3 h-3" /> Download Template CSV
                </button>
              </div>

              <div>
                <textarea
                  rows={4}
                  placeholder={`pincode,supportsCod,transitDays\n400001,true,2\n400002,true,2`}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-xs bg-white dark:bg-[var(--gray-800)]"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Paste CSV lines or upload file. 6-digit pincodes validated; invalid rows reported without blocking valid ones.
                </p>
              </div>

              <button
                type="button"
                disabled={uploadingCsv || !csvContent.trim()}
                onClick={handleUploadServiceability}
                className="px-4 py-2 text-xs font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50"
              >
                {uploadingCsv ? "Importing Pincodes..." : "Import Serviceability CSV"}
              </button>

              {uploadResult && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 rounded-lg text-xs space-y-1 text-emerald-900 dark:text-emerald-200">
                  <div>
                    Imported <strong>{uploadResult.importedCount}</strong> serviceable pincodes for {editingCourier.name}.
                  </div>
                  {uploadResult.invalidCount > 0 && (
                    <div className="text-rose-600 dark:text-rose-400">
                      {uploadResult.invalidCount} invalid rows were skipped.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* DRAWER FOOTER */}
          <div className="fixed bottom-0 right-0 w-[640px] p-4 bg-white dark:bg-[var(--gray-900)] border-t border-[var(--gray-200)] dark:border-[var(--gray-700)] flex justify-end gap-3 z-10">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="px-4 py-2 text-xs font-medium border rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              {editingCourier ? "Save Courier" : "Create Courier"}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
