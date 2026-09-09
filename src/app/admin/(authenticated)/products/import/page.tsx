"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Check,
  RotateCcw,
  FileText,
  Clock,
  ExternalLink,
} from "lucide-react";
import { toast } from "@/components/admin/ui/Toast";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import {
  validateImportData,
  commitProductImport,
  getRecentImportBatches,
  revertImportBatch,
} from "./actions";

export default function ProductImportPage() {
  const router = useRouter();

  // Wizard step: 1 (Upload), 2 (Validate), 3 (Confirm & Run)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Validation output
  const [validationResult, setValidationResult] = useState<{
    summary: {
      totalRows: number;
      createCount: number;
      updateCount: number;
      errorCount: number;
      warningCount: number;
      canProceed: boolean;
    };
    rows: any[];
  } | null>(null);

  // Import completion state
  const [importResult, setImportResult] = useState<{
    batchId: string;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
  } | null>(null);

  // Recent batches & Rollback
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  const [rollbackBatchId, setRollbackBatchId] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRecentBatches();
  }, []);

  const loadRecentBatches = async () => {
    const res = await getRecentImportBatches();
    if (res.success && res.batches) {
      setRecentBatches(res.batches);
    }
  };

  // ─── SIMPLE CSV PARSER ──────────────────────────────────────────────────
  const parseCSV = (text: string): any[] => {
    const lines = text.split(/\r\n|\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return [];

    // Parse header
    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().replace(/^["']|["']$/g, ""));

    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      // Regex handling commas inside quotes
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      const line = lines[i];

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim().replace(/^["']|["']$/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^["']|["']$/g, ""));

      if (values.some((v) => v.length > 0)) {
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || "";
        });
        rows.push(rowObj);
      }
    }
    return rows;
  };

  // ─── FILE UPLOAD & VALIDATION (STEP 1 -> 2) ─────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith(".csv")) {
      toast.error("Invalid File Type", "Please upload a valid .csv file.");
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      toast.error("File Too Large", "Maximum file size is 10MB (approx 5,000 rows).");
      return;
    }

    setFile(selected);
    setIsValidating(true);

    try {
      const text = await selected.text();
      const parsedRows = parseCSV(text);

      if (parsedRows.length === 0) {
        toast.error("Empty File", "The CSV file does not contain any data rows.");
        setIsValidating(false);
        return;
      }

      const res = await validateImportData(parsedRows);
      if (res.success && res.summary) {
        setValidationResult({
          summary: res.summary,
          rows: res.rows || [],
        });
        setStep(2);
      } else {
        toast.error("Validation Failed", res.error || "Could not validate file.");
      }
    } catch (err: any) {
      toast.error("File Parsing Error", err.message || "Failed to process CSV file.");
    } finally {
      setIsValidating(false);
    }
  };

  // ─── DOWNLOAD ERROR ROWS (STEP 2) ────────────────────────────────────────
  const handleDownloadErrorRows = () => {
    if (!validationResult) return;
    const errorRows = validationResult.rows.filter((r) => r.errors.length > 0);
    if (errorRows.length === 0) return;

    const headers = [
      "Row",
      "Title",
      "SKU",
      "Category",
      "Brand",
      "Price",
      "MRP",
      "Stock",
      "Errors",
    ];
    const csvContent = [
      headers.join(","),
      ...errorRows.map((r) =>
        [
          r.rowNumber,
          `"${(r.title || "").replace(/"/g, '""')}"`,
          `"${(r.sku || "").replace(/"/g, '""')}"`,
          `"${(r.category || "").replace(/"/g, '""')}"`,
          `"${(r.brand || "").replace(/"/g, '""')}"`,
          r.price,
          r.mrp,
          r.stock,
          `"${r.errors.join("; ").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `import-errors-${file?.name || "batch"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── COMMIT IMPORT (STEP 2 -> 3) ─────────────────────────────────────────
  const handleCommitImport = async () => {
    if (!validationResult || !file) return;

    setIsImporting(true);
    try {
      const res = await commitProductImport(validationResult.rows, file.name);
      if (res.success && res.batchId) {
        setImportResult({
          batchId: res.batchId,
          createdCount: res.createdCount || 0,
          updatedCount: res.updatedCount || 0,
          skippedCount: res.skippedCount || 0,
        });
        setStep(3);
        toast.success(
          "Import Successful!",
          `Imported ${res.createdCount} new products, updated ${res.updatedCount} existing.`
        );
        loadRecentBatches();
      } else {
        toast.error("Import Failed", res.error || "Could not write to database.");
      }
    } catch (err: any) {
      toast.error("Import Error", err.message || "Failed to commit import batch.");
    } finally {
      setIsImporting(false);
    }
  };

  // ─── 24-HOUR ROLLBACK ACTION ─────────────────────────────────────────────
  const handleRollback = async () => {
    if (!rollbackBatchId) return;

    setIsRollingBack(true);
    try {
      const res = await revertImportBatch(rollbackBatchId);
      if (res.success) {
        toast.success("Import Reverted", "All products created by this batch were safely deleted and previous variant values restored.");
        loadRecentBatches();
      } else {
        toast.error("Rollback Blocked", res.error || "Could not revert import batch.");
      }
    } catch (err: any) {
      toast.error("Error", "Failed to revert import batch.");
    } finally {
      setIsRollingBack(false);
      setRollbackBatchId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--text-xs)] text-[var(--color-fg-muted)] mb-1">
            <Link href="/admin/products" className="hover:underline">
              Products
            </Link>
            <span>/</span>
            <span>Bulk CSV Import</span>
          </div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--color-fg)]">
            Import Products from CSV
          </h1>
          <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)] mt-1">
            Upload new inventory or update existing catalog listings via structured CSV.
          </p>
        </div>

        <a
          href="/api/admin/export?type=products-template"
          className="h-9 px-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-fg)] text-[var(--text-xs)] font-medium flex items-center gap-1.5 transition-colors"
        >
          <Download size={14} /> Download Sample Template
        </a>
      </div>

      {/* 3-Step Wizard Navigation Stepper */}
      <div className="grid grid-cols-3 gap-2 border-b border-[var(--color-border)] pb-4 text-[var(--text-xs)]">
        {[
          { stepNum: 1, title: "1. Upload File", subtitle: "Select .csv up to 5,000 rows" },
          { stepNum: 2, title: "2. Map & Validate", subtitle: "Check errors & SKU matches" },
          { stepNum: 3, title: "3. Confirm & Run", subtitle: "Import with 24h rollback" },
        ].map((s) => (
          <div
            key={s.stepNum}
            className={`p-3 rounded-[var(--radius-md)] border transition-colors ${
              step === s.stepNum
                ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/40 font-bold"
                : step > s.stepNum
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-transparent text-[var(--color-fg-muted)] opacity-60"
            }`}
          >
            <div className="flex items-center gap-2">
              {step > s.stepNum ? (
                <CheckCircle2 size={16} className="text-green-600" />
              ) : (
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                    step === s.stepNum
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface-sunken)]"
                  }`}
                >
                  {s.stepNum}
                </span>
              )}
              <span className="text-[var(--text-sm)]">{s.title}</span>
            </div>
            <span className="text-[11px] text-[var(--color-fg-muted)] block mt-0.5 ml-7 font-normal">
              {s.subtitle}
            </span>
          </div>
        ))}
      </div>

      {/* ─── STEP 1: FILE UPLOAD ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] rounded-[var(--radius-lg)] p-12 text-center cursor-pointer transition-colors space-y-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center mx-auto">
              <Upload size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-[var(--text-sm)] font-bold text-[var(--color-fg)]">
                Click to upload or drag & drop CSV file
              </p>
              <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)]">
                Accepts UTF-8 formatted CSV files up to 10MB (max 5,000 rows).
              </p>
            </div>
            {isValidating && (
              <div className="flex items-center justify-center gap-2 text-[var(--color-primary)] text-[var(--text-xs)] font-medium pt-2">
                <Loader2 size={15} className="animate-spin" />
                Validating CSV rows & checking database SKUs...
              </div>
            )}
          </div>

          {/* Template Guidelines Card */}
          <div className="p-5 rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] space-y-3 text-[var(--text-xs)]">
            <h3 className="font-bold text-[var(--color-fg)] flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-[var(--color-primary)]" />
              CSV Format Specifications
            </h3>
            <ul className="space-y-1.5 text-[var(--color-fg-muted)] list-disc pl-5">
              <li>
                <strong>Required columns:</strong> Title, SKU, Category, Selling Price.
              </li>
              <li>
                <strong>Optional columns:</strong> Brand, MRP, Stock, Unit, HSN, Weight, Short Description, Description.
              </li>
              <li>
                <strong>Existing SKUs:</strong> If an SKU already exists in your catalog, the import will update its price, MRP, and stock rather than creating duplicates.
              </li>
              <li>
                <strong>Publish Safety:</strong> All newly imported listings are created in <strong>DRAFT</strong> status so staff can inspect them before making them live.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ─── STEP 2: PRE-FLIGHT VALIDATION SUMMARY ───────────────────────── */}
      {step === 2 && validationResult && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[var(--text-xs)]">
            <div className="p-4 rounded-[var(--radius-md)] bg-green-50 border border-green-200">
              <span className="text-green-700 font-bold block text-[11px] uppercase">
                New Products
              </span>
              <strong className="text-[var(--text-2xl)] font-bold text-green-900">
                {validationResult.summary.createCount}
              </strong>
              <p className="text-[11px] text-green-700 mt-0.5">Will be created as drafts</p>
            </div>

            <div className="p-4 rounded-[var(--radius-md)] bg-blue-50 border border-blue-200">
              <span className="text-blue-700 font-bold block text-[11px] uppercase">
                Updates
              </span>
              <strong className="text-[var(--text-2xl)] font-bold text-blue-900">
                {validationResult.summary.updateCount}
              </strong>
              <p className="text-[11px] text-blue-700 mt-0.5">Existing SKUs to update</p>
            </div>

            <div className="p-4 rounded-[var(--radius-md)] bg-red-50 border border-red-200">
              <span className="text-red-700 font-bold block text-[11px] uppercase">
                Errors
              </span>
              <strong className="text-[var(--text-2xl)] font-bold text-red-900">
                {validationResult.summary.errorCount}
              </strong>
              <p className="text-[11px] text-red-700 mt-0.5">Invalid rows to be skipped</p>
            </div>

            <div className="p-4 rounded-[var(--radius-md)] bg-amber-50 border border-amber-200">
              <span className="text-amber-700 font-bold block text-[11px] uppercase">
                Warnings
              </span>
              <strong className="text-[var(--text-2xl)] font-bold text-amber-900">
                {validationResult.summary.warningCount}
              </strong>
              <p className="text-[11px] text-amber-700 mt-0.5">Non-blocking notices</p>
            </div>
          </div>

          {/* Validation Rows Table */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-2xs">
            <div className="p-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)] flex items-center justify-between text-[var(--text-xs)]">
              <span className="font-bold text-[var(--color-fg)]">
                Row Pre-flight Analysis ({validationResult.rows.length} total rows)
              </span>

              {validationResult.summary.errorCount > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadErrorRows}
                  className="px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] font-medium flex items-center gap-1.5 text-red-700"
                >
                  <Download size={13} /> Download Error Rows CSV
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-[var(--text-xs)] border-collapse">
                <thead className="bg-[var(--color-surface-sunken)] text-[var(--color-fg-muted)] border-b border-[var(--color-border)] font-semibold sticky top-0">
                  <tr>
                    <th className="p-3 w-12 text-center">Row</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Title & SKU</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3">Issues / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {validationResult.rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={
                        row.errors.length > 0
                          ? "bg-red-50/50"
                          : row.action === "UPDATE"
                          ? "bg-blue-50/30"
                          : ""
                      }
                    >
                      <td className="p-3 text-center font-mono text-[var(--color-fg-muted)]">
                        {row.rowNumber}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            row.action === "CREATE"
                              ? "bg-green-100 text-green-800"
                              : row.action === "UPDATE"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {row.action}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-[var(--color-fg)] block">
                          {row.title || "(Untitled)"}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-fg-muted)]">
                          {row.sku || "No SKU"}
                        </span>
                      </td>
                      <td className="p-3 text-[var(--color-fg)]">{row.category}</td>
                      <td className="p-3 text-right font-mono font-medium">
                        ₹{row.price}
                      </td>
                      <td className="p-3">
                        {row.errors.length > 0 ? (
                          <span className="text-red-700 font-medium block">
                            {row.errors.join("; ")}
                          </span>
                        ) : row.warnings.length > 0 ? (
                          <span className="text-amber-700 font-medium block">
                            {row.warnings.join("; ")}
                          </span>
                        ) : (
                          <span className="text-green-700 font-medium flex items-center gap-1">
                            <Check size={13} /> Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border-subtle)]">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--text-sm)] font-medium flex items-center gap-1.5"
            >
              <ArrowLeft size={15} /> Upload Different File
            </button>

            <button
              type="button"
              disabled={!validationResult.summary.canProceed || isImporting}
              onClick={handleCommitImport}
              className="px-5 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[var(--text-sm)] font-bold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Importing Rows...
                </>
              ) : (
                <>
                  <ArrowRight size={16} />
                  Run Import ({validationResult.summary.createCount + validationResult.summary.updateCount} Rows)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: SUCCESS & BATCH CONFIRMATION ─────────────────────────── */}
      {step === 3 && importResult && (
        <div className="space-y-6">
          <div className="p-8 rounded-[var(--radius-lg)] bg-green-50 border border-green-200 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-[var(--text-xl)] font-bold text-green-950">
              Import Completed Successfully!
            </h2>
            <p className="text-[var(--text-xs)] text-green-800 max-w-md mx-auto">
              Processed <strong>{importResult.createdCount} new products</strong> and{" "}
              <strong>{importResult.updatedCount} existing variant updates</strong>.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                href="/admin/products"
                className="px-4 py-2 rounded-[var(--radius-md)] bg-green-700 hover:bg-green-800 text-white text-[var(--text-xs)] font-bold transition-colors"
              >
                View Catalog Listings
              </Link>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setFile(null);
                  setValidationResult(null);
                }}
                className="px-4 py-2 rounded-[var(--radius-md)] border border-green-300 bg-white text-green-900 text-[var(--text-xs)] font-medium hover:bg-green-100/50 transition-colors"
              >
                Import Another File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── RECENT IMPORT BATCHES (WITH 24H ROLLBACK) ────────────────────── */}
      <div className="pt-8 border-t border-[var(--color-border)] space-y-3">
        <h3 className="text-[var(--text-sm)] font-bold text-[var(--color-fg)] flex items-center gap-2">
          <Clock size={16} className="text-[var(--color-fg-muted)]" />
          Recent Import Batches (24-Hour Rollback Window)
        </h3>

        {recentBatches.length === 0 ? (
          <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)]">
            No recent import batches recorded.
          </p>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <table className="w-full text-left text-[var(--text-xs)] border-collapse">
              <thead className="bg-[var(--color-surface-sunken)] text-[var(--color-fg-muted)] border-b border-[var(--color-border)] font-semibold">
                <tr>
                  <th className="p-3">File / Date</th>
                  <th className="p-3 text-right">Created</th>
                  <th className="p-3 text-right">Updated</th>
                  <th className="p-3 text-right">Errors</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {recentBatches.map((batch) => {
                  const hoursSince =
                    (Date.now() - new Date(batch.createdAt).getTime()) / (1000 * 60 * 60);
                  const canRollback = !batch.revertedAt && hoursSince <= 24;

                  return (
                    <tr key={batch.id} className="hover:bg-[var(--color-surface-hover)]">
                      <td className="p-3">
                        <span className="font-semibold text-[var(--color-fg)] block">
                          {batch.filename}
                        </span>
                        <span className="text-[10px] text-[var(--color-fg-muted)]">
                          {new Date(batch.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-green-700 font-bold">
                        +{batch.createdCount}
                      </td>
                      <td className="p-3 text-right font-mono text-blue-700 font-bold">
                        ~{batch.updatedCount}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-700">
                        {batch.skippedCount}
                      </td>
                      <td className="p-3">
                        {batch.revertedAt ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                            Reverted
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800">
                            Applied
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {canRollback && (
                          <button
                            type="button"
                            onClick={() => setRollbackBatchId(batch.id)}
                            className="px-2.5 py-1 rounded text-[11px] font-medium border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-red-50 flex items-center gap-1 ml-auto"
                          >
                            <RotateCcw size={12} /> Rollback
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rollback Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(rollbackBatchId)}
        onClose={() => setRollbackBatchId(null)}
        onConfirm={handleRollback}
        title="Revert This Import Batch?"
        message="All newly created products from this batch will be permanently removed (if not yet ordered) and updated variant prices/stocks will be restored to their previous values. Proceed?"
        confirmLabel="Rollback Batch"
        variant="danger"
      />
    </div>
  );
}
