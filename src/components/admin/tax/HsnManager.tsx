"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Download,
  AlertTriangle,
  Layers,
  Calendar,
  Clock,
  ExternalLink,
  ChevronDown,
  Info,
  CheckCircle2,
  XCircle,
  History,
  Search,
} from "lucide-react";
import {
  DataTable,
  ColumnDef,
  PageHeader,
  StatusBadge,
  Drawer,
  Modal,
  ConfirmDialog,
  useToast,
  EmptyState,
} from "@/components/admin/ui";
import {
  createHsnAction,
  updateHsnMetadataAction,
  createRateVersionAction,
  deleteHsnAction,
} from "@/app/admin/(authenticated)/tax/actions";

export interface HsnPriceSlabItem {
  id?: string;
  minPrice: number;
  maxPrice?: number | null;
  gstRate: number;
}

export interface HsnRateVersionItem {
  id: string;
  gstRate?: number | null;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
  createdBy?: string | null;
  createdAt?: string | Date;
  slabs?: HsnPriceSlabItem[];
}

export interface HsnItem extends Record<string, any> {
  id: string;
  code: string;
  description: string;
  rateType: "FLAT" | "SLAB" | string;
  cessRate?: number | null;
  isActive: boolean;
  activeRateVersion?: HsnRateVersionItem | null;
  futureVersion?: HsnRateVersionItem | null;
  rateDisplay: string;
  futureRateDisplay?: string | null;
  slabs?: HsnPriceSlabItem[];
  categoriesCount: number;
  productsCount: number;
  rateVersions?: HsnRateVersionItem[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

const STANDARD_RATES = [0, 0.25, 3, 5, 12, 18, 28];

export default function HsnManager({
  initialHsns,
  unmappedCount = 0,
  sellerStateName = "Maharashtra",
}: {
  initialHsns: HsnItem[];
  unmappedCount?: number;
  sellerStateName?: string;
}) {
  const [hsns, setHsns] = useState<HsnItem[]>(initialHsns);
  const [search, setSearch] = useState("");
  const [rateTypeFilter, setRateTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingHsn, setEditingHsn] = useState<HsnItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Form states
  const [formCode, setFormCode] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formRateType, setFormRateType] = useState<"FLAT" | "SLAB">("FLAT");
  const [formGstRate, setFormGstRate] = useState(18);
  const [formCessRate, setFormCessRate] = useState<number | "">("");
  const [formEffectiveFrom, setFormEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [formActive, setFormActive] = useState(true);

  // Slab builder rows: [{ minPrice: 0, maxPrice: 1000, gstRate: 5 }, { minPrice: 1000.01, maxPrice: null, gstRate: 12 }]
  const [slabs, setSlabs] = useState<
    Array<{ minPrice: number; maxPrice: number | null; gstRate: number }>
  >([
    { minPrice: 0, maxPrice: 1000, gstRate: 5 },
    { minPrice: 1000.01, maxPrice: null, gstRate: 12 },
  ]);

  // Rate versioning on edit
  const [isAddingNewVersion, setIsAddingNewVersion] = useState(false);
  const [versionEffectiveFrom, setVersionEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // CSV Import Modal (TAX-09)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Delete dialog
  const [deletingHsn, setDeletingHsn] = useState<HsnItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Slab popover preview
  const [hoveredSlabHsnId, setHoveredSlabHsnId] = useState<string | null>(null);

  const toast = useToast();

  const totalMapped = useMemo(
    () => hsns.reduce((acc, h) => acc + (h.categoriesCount > 0 ? 1 : 0), 0),
    [hsns]
  );

  const filteredHsns = useMemo(() => {
    return hsns.filter((h) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches =
          h.code.toLowerCase().includes(q) || h.description.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (rateTypeFilter !== "ALL" && h.rateType !== rateTypeFilter) return false;
      if (statusFilter === "ACTIVE" && !h.isActive) return false;
      if (statusFilter === "INACTIVE" && !h.isActive) return false;
      return true;
    });
  }, [hsns, search, rateTypeFilter, statusFilter]);

  function handleOpenCreate() {
    setEditingHsn(null);
    setFormCode("");
    setFormDesc("");
    setFormRateType("FLAT");
    setFormGstRate(18);
    setFormCessRate("");
    setFormEffectiveFrom(new Date().toISOString().slice(0, 10));
    setFormActive(true);
    setSlabs([
      { minPrice: 0, maxPrice: 1000, gstRate: 5 },
      { minPrice: 1000.01, maxPrice: null, gstRate: 12 },
    ]);
    setIsAddingNewVersion(false);
    setDrawerError(null);
    setIsDrawerOpen(true);
  }

  function handleOpenEdit(hsn: HsnItem) {
    setEditingHsn(hsn);
    setFormCode(hsn.code);
    setFormDesc(hsn.description);
    setFormRateType(hsn.rateType as any);
    setFormGstRate(hsn.activeRateVersion?.gstRate ?? 18);
    setFormCessRate(hsn.cessRate ? Number(hsn.cessRate) : "");
    setFormActive(hsn.isActive);
    setFormEffectiveFrom(
      hsn.activeRateVersion?.effectiveFrom
        ? new Date(hsn.activeRateVersion.effectiveFrom).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    if (hsn.rateType === "SLAB" && hsn.slabs && hsn.slabs.length > 0) {
      setSlabs(
        hsn.slabs.map((s) => ({
          minPrice: s.minPrice,
          maxPrice: s.maxPrice ?? null,
          gstRate: s.gstRate,
        }))
      );
    } else {
      setSlabs([
        { minPrice: 0, maxPrice: 1000, gstRate: 5 },
        { minPrice: 1000.01, maxPrice: null, gstRate: 12 },
      ]);
    }
    setIsAddingNewVersion(false);
    setVersionEffectiveFrom(new Date().toISOString().slice(0, 10));
    setDrawerError(null);
    setIsDrawerOpen(true);
  }

  // Slab manipulation
  function handleAddSlab() {
    setSlabs((prev) => {
      const lastIndex = prev.length - 1;
      const prevLast = prev[lastIndex];
      const newUpper = (prevLast.minPrice + 1000);
      const updatedPrev = {
        ...prevLast,
        maxPrice: newUpper,
      };
      const newRow = {
        minPrice: Number((newUpper + 0.01).toFixed(2)),
        maxPrice: null,
        gstRate: 18,
      };
      return [...prev.slice(0, lastIndex), updatedPrev, newRow];
    });
  }

  function handleUpdateSlabMaxPrice(index: number, val: number) {
    setSlabs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], maxPrice: val };
      // Auto-update chained next slab minPrice (TAX-03: Gaps are structurally impossible)
      if (index + 1 < next.length) {
        next[index + 1] = {
          ...next[index + 1],
          minPrice: Number((val + 0.01).toFixed(2)),
        };
      }
      return next;
    });
  }

  function handleUpdateSlabRate(index: number, rate: number) {
    setSlabs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], gstRate: rate };
      return next;
    });
  }

  function handleRemoveSlab(index: number) {
    if (slabs.length <= 2) {
      toast.error(
        "Cannot remove slab",
        "A price slab structure requires at least 2 slabs."
      );
      return;
    }
    setSlabs((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      // Ensure the new last slab has null maxPrice
      const last = filtered.length - 1;
      filtered[last] = { ...filtered[last], maxPrice: null };
      return filtered;
    });
  }

  // Live split preview calculations for ₹1,000 item (TAX-02)
  const flatPreview = useMemo(() => {
    const rate = Number(formGstRate) || 0;
    const igst = 1000 * (rate / 100);
    const cgst = igst / 2;
    const sgst = igst / 2;
    return { cgst, sgst, igst };
  }, [formGstRate]);

  // Back-dated warning check
  const isBackdated = useMemo(() => {
    const targetDate = isAddingNewVersion
      ? new Date(versionEffectiveFrom)
      : new Date(formEffectiveFrom);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return targetDate < today;
  }, [isAddingNewVersion, versionEffectiveFrom, formEffectiveFrom]);

  async function handleSaveHsn(e: React.FormEvent) {
    e.preventDefault();
    setDrawerError(null);

    // Validate Code
    const trimmedCode = formCode.trim();
    if (!/^\d+$/.test(trimmedCode)) {
      setDrawerError("HSN code must contain digits only");
      return;
    }
    if (![4, 6, 8].includes(trimmedCode.length)) {
      setDrawerError(`HSN code must be 4, 6 or 8 digits. You entered ${trimmedCode.length}.`);
      return;
    }
    if (!formDesc.trim()) {
      setDrawerError("Description is required.");
      return;
    }

    // Validate slabs if SLAB
    if (formRateType === "SLAB") {
      if (slabs.length < 2) {
        setDrawerError("Price slab structure requires at least 2 slabs.");
        return;
      }
      const lastSlab = slabs[slabs.length - 1];
      if (lastSlab.maxPrice !== null && lastSlab.maxPrice !== undefined) {
        setDrawerError("The last slab must have no upper limit, so every price is covered");
        return;
      }
      for (let i = 0; i < slabs.length - 1; i++) {
        if (!slabs[i].maxPrice || slabs[i].maxPrice! <= slabs[i].minPrice) {
          setDrawerError(`Slab ${i + 1} upper bound must be greater than lower bound.`);
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      if (editingHsn) {
        // If adding a new version (TAX-07)
        if (isAddingNewVersion) {
          const res = await createRateVersionAction(editingHsn.id, {
            rateType: formRateType,
            gstRate: formRateType === "FLAT" ? formGstRate : null,
            effectiveFrom: versionEffectiveFrom,
            slabs: formRateType === "SLAB" ? slabs : undefined,
          });

          if (!res.ok) {
            setDrawerError(res.error || "Failed to create rate version.");
            return;
          }
          toast.success(
            "New Rate Version Created",
            `Rate version effective from ${versionEffectiveFrom} saved.`
          );
        }

        // Update metadata
        const metaRes = await updateHsnMetadataAction(editingHsn.id, {
          description: formDesc.trim(),
          cessRate: formCessRate === "" ? 0 : Number(formCessRate),
          isActive: formActive,
        });

        if (!metaRes.ok) {
          setDrawerError(metaRes.error || "Failed to update HSN.");
          return;
        }

        toast.success(
          "HSN Code Saved",
          `HSN ${formCode} updated successfully.`
        );
        window.location.reload();
      } else {
        const res = await createHsnAction({
          code: trimmedCode,
          description: formDesc.trim(),
          rateType: formRateType,
          gstRate: formRateType === "FLAT" ? formGstRate : undefined,
          cessRate: formCessRate === "" ? 0 : Number(formCessRate),
          effectiveFrom: formEffectiveFrom,
          isActive: formActive,
          slabs: formRateType === "SLAB" ? slabs : undefined,
        });

        if (!res.ok) {
          setDrawerError(res.error || "Failed to create HSN code.");
          return;
        }

        toast.success(
          "HSN Code Created",
          `HSN ${trimmedCode} is now active.`
        );
        window.location.reload();
      }
    } catch (err: any) {
      setDrawerError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingHsn) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await deleteHsnAction(deletingHsn.id);
      if (!res.ok) {
        setDeleteError(res.error || "Failed to delete HSN.");
        return;
      }

      setHsns((prev) => prev.filter((h) => h.id !== deletingHsn.id));
      toast.success("HSN Deleted", res.message);
      setDeletingHsn(null);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete HSN.");
    } finally {
      setIsDeleting(false);
    }
  }

  // CSV Import parsing
  async function handleParseCsv() {
    if (!csvText.trim()) return;
    setIsParsing(true);

    try {
      const lines = csvText.trim().split("\n");
      const rows: any[] = [];
      let startIdx = 0;

      // Check header
      const firstLine = lines[0].toLowerCase();
      if (firstLine.includes("code") && firstLine.includes("rate")) {
        startIdx = 1;
      }

      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
        if (parts.length >= 2) {
          rows.push({
            code: parts[0],
            description: parts[1] || `HSN ${parts[0]} Item`,
            rate: parts[2] ? parts[2].replace("%", "") : "18",
          });
        }
      }

      const res = await fetch("/api/admin/hsn/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, action: "PREVIEW" }),
      });

      const data = await res.json();
      if (data.ok) {
        setImportPreview(data.preview);
      } else {
        toast.error("Parse Error", data.error);
      }
    } catch (err: any) {
      toast.error("Parse Error", err.message);
    } finally {
      setIsParsing(false);
    }
  }

  async function handleCommitImport() {
    if (!importPreview) return;
    setIsCommitting(true);

    try {
      const validRows = importPreview.filter((r) => r.isValid);
      const res = await fetch("/api/admin/hsn/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows, action: "COMMIT" }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success("Import Complete", data.message);
        setIsImportModalOpen(false);
        window.location.reload();
      } else {
        toast.error("Import Failed", data.error);
      }
    } catch (err: any) {
      toast.error("Import Failed", err.message);
    } finally {
      setIsCommitting(false);
    }
  }

  const columns: ColumnDef<HsnItem>[] = [
    {
      id: "code",
      header: "CODE",
      accessorKey: "code",
      sortable: true,
      cell: (row) => (
        <code className="font-mono font-bold text-[var(--text-sm)] text-[var(--blue-700)]">
          {row.code}
        </code>
      ),
    },
    {
      id: "description",
      header: "DESCRIPTION",
      accessorKey: "description",
      cell: (row) => (
        <div className="max-w-md">
          <span className="text-[var(--text-sm)] text-[var(--gray-900)] line-clamp-1">
            {row.description}
          </span>
          {row.cessRate ? (
            <span className="text-[10px] text-[var(--amber-700)] font-medium">
              + {row.cessRate}% CESS
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "rateDisplay",
      header: "GST RATE",
      accessorKey: "rateDisplay",
      cell: (row) => (
        <div className="relative inline-block">
          <div
            className="flex items-center gap-1.5 cursor-default font-medium text-[var(--gray-900)]"
            onMouseEnter={() => row.rateType === "SLAB" && setHoveredSlabHsnId(row.id)}
            onMouseLeave={() => setHoveredSlabHsnId(null)}
          >
            <span>{row.rateDisplay}</span>
            {row.rateType === "SLAB" && (
              <Layers size={13} className="text-[var(--blue-600)] flex-shrink-0" />
            )}
          </div>

          {row.futureRateDisplay && (
            <span className="block text-[10px] font-medium text-[var(--violet-600)]">
              ({row.futureRateDisplay})
            </span>
          )}

          {/* Slabs Hover Popover */}
          {hoveredSlabHsnId === row.id && row.slabs && row.slabs.length > 0 && (
            <div className="absolute left-0 top-full mt-1 z-30 w-64 p-2.5 bg-[var(--gray-900)] text-white rounded-[var(--radius-md)] shadow-lg text-[11px] space-y-1">
              <span className="font-bold text-[var(--gray-300)] uppercase tracking-wider block border-b border-[var(--gray-700)] pb-1">
                Price Slabs Structure
              </span>
              {row.slabs.map((s, idx) => (
                <div key={idx} className="flex justify-between items-center py-0.5">
                  <span className="text-[var(--gray-300)]">
                    {s.maxPrice !== null && s.maxPrice !== undefined
                      ? `₹${s.minPrice.toFixed(2)} – ₹${s.maxPrice.toFixed(2)}`
                      : `Above ₹${s.minPrice.toFixed(2)}`}
                  </span>
                  <span className="font-mono font-bold text-[var(--blue-400)]">
                    {s.gstRate}% GST
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "rateType",
      header: "TYPE",
      accessorKey: "rateType",
      sortable: true,
      cell: (row) => (
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
            row.rateType === "SLAB"
              ? "bg-[var(--violet-50)] text-[var(--violet-700)] border border-[var(--violet-200)]"
              : "bg-[var(--gray-100)] text-[var(--gray-700)]"
          }`}
        >
          {row.rateType === "SLAB" ? "Slab" : "Flat"}
        </span>
      ),
    },
    {
      id: "categoriesCount",
      header: "CATEGORIES",
      accessorKey: "categoriesCount",
      align: "right",
      sortable: true,
      cell: (row) => (
        <Link
          href={`/admin/tax/mapping?hsn=${row.code}`}
          className="font-mono font-medium text-[var(--blue-600)] hover:underline inline-flex items-center gap-1"
          title="View mapped categories"
        >
          {row.categoriesCount}
        </Link>
      ),
    },
    {
      id: "isActive",
      header: "STATUS",
      accessorKey: "isActive",
      cell: (row) => (
        <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} />
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 text-[var(--gray-500)] hover:text-[var(--blue-600)] hover:bg-[var(--gray-100)] rounded transition-colors"
            title="Edit HSN code and rate history"
            aria-label="Edit HSN code"
          >
            <Edit2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setDeletingHsn(row);
            }}
            className="p-1.5 text-[var(--gray-500)] hover:text-[var(--red-600)] hover:bg-[var(--red-50)] rounded transition-colors"
            title="Delete HSN code"
            aria-label="Delete HSN code"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="HSN Codes & GST Rates"
        subtitle={`${hsns.length} codes · ${totalMapped} mapped to categories`}
        primaryAction={{
          label: "Add HSN Code",
          icon: Plus,
          onClick: handleOpenCreate,
        }}
        overflowActions={[
          {
            label: "Import from CSV",
            icon: Upload,
            onClick: () => {
              setCsvText("");
              setImportPreview(null);
              setIsImportModalOpen(true);
            },
          },
          {
            label: "Export HSN Directory",
            icon: Download,
            onClick: () => {
              window.open("/api/admin/hsn/export", "_blank");
            },
          },
        ]}
      />

      {/* ALERT STRIP (conditional, most valuable pixel per PRD B.3) */}
      {unmappedCount > 0 && (
        <div className="p-3.5 bg-[var(--amber-50)] border-l-4 border-[var(--amber-500)] text-[var(--amber-900)] rounded-r-[var(--radius-md)] flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-[var(--amber-600)] flex-shrink-0" />
            <span className="text-[var(--text-sm)] font-medium">
              {unmappedCount} {unmappedCount === 1 ? "category has" : "categories have"} no HSN
              mapping. Products in {unmappedCount === 1 ? "it" : "them"} cannot be invoiced.
            </span>
          </div>
          <Link
            href="/admin/tax/mapping"
            className="text-[var(--text-xs)] font-bold text-[var(--amber-800)] hover:text-[var(--amber-950)] hover:underline flex items-center gap-1"
          >
            Review unmapped categories →
          </Link>
        </div>
      )}

      {/* Toolbar / Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--color-surface)] p-3 rounded-[var(--radius-lg)] border border-[var(--gray-200)] shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gray-400)]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or description..."
              className="w-full pl-9 pr-3 py-1.5 text-[var(--text-sm)] bg-[var(--gray-50)] border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-500)]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={rateTypeFilter}
              onChange={(e) => setRateTypeFilter(e.target.value)}
              className="py-1.5 px-2.5 text-[var(--text-xs)] bg-white border border-[var(--gray-300)] rounded-[var(--radius-md)] text-[var(--gray-700)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-500)]"
            >
              <option value="ALL">Rate structure (All)</option>
              <option value="FLAT">Flat Rate</option>
              <option value="SLAB">Price Slabs</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-2.5 text-[var(--text-xs)] bg-white border border-[var(--gray-300)] rounded-[var(--radius-md)] text-[var(--gray-700)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-500)]"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      {hsns.length === 0 ? (
        <EmptyState
          title="No HSN codes defined"
          description="HSN codes and GST rates are required to calculate tax on products."
          actionLabel="Add HSN Code"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--gray-200)] shadow-sm overflow-hidden">
          <DataTable
            tableId="admin-hsn-table"
            data={filteredHsns}
            columns={columns}
            keyExtractor={(h) => h.id}
            emptyTitle="No HSN codes match your search criteria."
          />
        </div>
      )}

      {/* DRAWER: Add / Edit HSN (640px) */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingHsn ? `Edit HSN: ${editingHsn.code}` : "Add HSN Code"}
        width="wide"
      >
        <form onSubmit={handleSaveHsn} className="space-y-5 p-6 overflow-y-auto">
          {drawerError && (
            <div className="p-3 bg-[var(--red-50)] border border-[var(--red-200)] text-[var(--red-700)] rounded-[var(--radius-md)] text-[var(--text-sm)] flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{drawerError}</span>
            </div>
          )}

          {/* HSN Code */}
          <div>
            <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
              HSN Code <span className="text-[var(--red-500)]">*</span>
            </label>
            <input
              type="text"
              required
              disabled={Boolean(editingHsn)}
              value={formCode}
              onChange={(e) => setFormCode(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 6109 or 8517"
              className="w-full px-3 py-2 font-mono text-[var(--text-sm)] border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)] disabled:bg-[var(--gray-100)] disabled:text-[var(--gray-500)]"
            />
            <p className="text-[11px] text-[var(--gray-500)] mt-1">
              4, 6 or 8 numeric digits. 6 digits minimum is required for B2B invoices above ₹5 crore turnover.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
              Description <span className="text-[var(--red-500)]">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Official CBIC HSN directory description..."
              className="w-full px-3 py-2 text-[var(--text-sm)] border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)]"
            />
          </div>

          {/* Rate Structure Selector */}
          <div className="p-3.5 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-[var(--radius-lg)] space-y-2">
            <span className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider">
              Rate Structure
            </span>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`p-3 border rounded-[var(--radius-md)] cursor-pointer flex flex-col gap-1 transition-all ${
                  formRateType === "FLAT"
                    ? "bg-white border-[var(--blue-600)] ring-1 ring-[var(--blue-600)]"
                    : "bg-white border-[var(--gray-300)] hover:bg-[var(--gray-50)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rateStructure"
                    checked={formRateType === "FLAT"}
                    onChange={() => setFormRateType("FLAT")}
                    className="text-[var(--blue-600)] focus:ring-[var(--blue-500)]"
                  />
                  <span className="text-[var(--text-sm)] font-bold text-[var(--gray-900)]">
                    Flat rate
                  </span>
                </div>
                <span className="text-[11px] text-[var(--gray-500)] ml-5">
                  One GST rate regardless of per-unit price
                </span>
              </label>

              <label
                className={`p-3 border rounded-[var(--radius-md)] cursor-pointer flex flex-col gap-1 transition-all ${
                  formRateType === "SLAB"
                    ? "bg-white border-[var(--blue-600)] ring-1 ring-[var(--blue-600)]"
                    : "bg-white border-[var(--gray-300)] hover:bg-[var(--gray-50)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rateStructure"
                    checked={formRateType === "SLAB"}
                    onChange={() => setFormRateType("SLAB")}
                    className="text-[var(--blue-600)] focus:ring-[var(--blue-500)]"
                  />
                  <span className="text-[var(--text-sm)] font-bold text-[var(--gray-900)]">
                    Price slabs
                  </span>
                </div>
                <span className="text-[11px] text-[var(--gray-500)] ml-5">
                  Rate depends on per-unit price (apparel & footwear)
                </span>
              </label>
            </div>
          </div>

          {/* IF FLAT: Rate selector + live preview */}
          {formRateType === "FLAT" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
                  GST Rate <span className="text-[var(--red-500)]">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {STANDARD_RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormGstRate(r)}
                      className={`px-3 py-1.5 border rounded-[var(--radius-md)] text-[var(--text-sm)] font-mono font-medium transition-all ${
                        formGstRate === r
                          ? "bg-[var(--blue-50)] border-[var(--blue-600)] text-[var(--blue-700)] font-bold shadow-sm"
                          : "bg-white border-[var(--gray-300)] text-[var(--gray-700)] hover:bg-[var(--gray-50)]"
                      }`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Strip (TAX-02) */}
              <div className="p-3 bg-[var(--blue-50)] border border-[var(--blue-200)] rounded-[var(--radius-md)] text-[var(--text-xs)] text-[var(--blue-900)] space-y-1">
                <span className="font-bold block">Live GST Split Preview (on ₹1,000 item):</span>
                <p>
                  → CGST ₹{flatPreview.cgst.toFixed(2)} + SGST ₹{flatPreview.sgst.toFixed(2)}{" "}
                  <span className="font-semibold">(in {sellerStateName})</span>
                </p>
                <p>
                  → IGST ₹{flatPreview.igst.toFixed(2)}{" "}
                  <span className="font-semibold">(outside {sellerStateName})</span>
                </p>
              </div>
            </div>
          )}

          {/* IF SLABS: Slab builder */}
          {formRateType === "SLAB" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider">
                  Contiguous Price Slabs
                </label>
                <button
                  type="button"
                  onClick={handleAddSlab}
                  className="text-[var(--text-xs)] font-bold text-[var(--blue-600)] hover:underline flex items-center gap-1"
                >
                  <Plus size={13} /> Add slab
                </button>
              </div>

              <div className="space-y-2 border border-[var(--gray-200)] rounded-[var(--radius-lg)] p-3 bg-white">
                {slabs.map((slab, index) => {
                  const isLast = index === slabs.length - 1;

                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-[var(--radius-md)]"
                    >
                      <span className="text-[var(--text-xs)] text-[var(--gray-500)] whitespace-nowrap">
                        From ₹
                      </span>
                      <input
                        type="number"
                        readOnly
                        value={slab.minPrice}
                        className="w-20 px-2 py-1 text-[var(--text-xs)] font-mono bg-[var(--gray-100)] border border-[var(--gray-300)] rounded text-[var(--gray-600)] cursor-not-allowed"
                        title="'From' auto-chains from previous slab's 'To'"
                      />

                      <span className="text-[var(--text-xs)] text-[var(--gray-500)] whitespace-nowrap">
                        To ₹
                      </span>
                      {isLast ? (
                        <span className="w-24 px-2 py-1 text-[var(--text-xs)] font-mono font-medium text-[var(--gray-500)] bg-[var(--gray-100)] border border-[var(--gray-300)] rounded text-center">
                          No limit
                        </span>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          value={slab.maxPrice ?? ""}
                          onChange={(e) =>
                            handleUpdateSlabMaxPrice(index, parseFloat(e.target.value) || 0)
                          }
                          className="w-24 px-2 py-1 text-[var(--text-xs)] font-mono bg-white border border-[var(--gray-300)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--blue-500)]"
                        />
                      )}

                      <span className="text-[var(--text-xs)] text-[var(--gray-500)] ml-1">
                        Rate
                      </span>
                      <select
                        value={slab.gstRate}
                        onChange={(e) => handleUpdateSlabRate(index, parseFloat(e.target.value))}
                        className="py-1 px-2 text-[var(--text-xs)] font-mono bg-white border border-[var(--gray-300)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--blue-500)]"
                      >
                        {STANDARD_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </select>

                      {slabs.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSlab(index)}
                          className="p-1 text-[var(--gray-400)] hover:text-[var(--red-600)] rounded ml-auto"
                          title="Remove slab"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}

                <p className="text-[11px] text-[var(--gray-500)] pt-1">
                  The slab is chosen by the per-unit price after discount, not by the order total (TR-03).
                  Lower bounds auto-fill from previous upper bounds to prevent gaps.
                </p>
              </div>
            </div>
          )}

          {/* Optional CESS Rate */}
          <div>
            <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
              CESS Rate % (Optional)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formCessRate}
              onChange={(e) =>
                setFormCessRate(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)
              }
              placeholder="0.00"
              className="w-32 px-3 py-2 font-mono text-[var(--text-sm)] border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)]"
            />
            <p className="text-[11px] text-[var(--gray-500)] mt-1">
              Additional cess percentage if applicable. Leave blank for most goods.
            </p>
          </div>

          {/* Effective From Date */}
          {!editingHsn && (
            <div>
              <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
                Effective From <span className="text-[var(--red-500)]">*</span>
              </label>
              <input
                type="date"
                required
                value={formEffectiveFrom}
                onChange={(e) => setFormEffectiveFrom(e.target.value)}
                className="px-3 py-2 text-[var(--text-sm)] border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)]"
              />
            </div>
          )}

          {/* EDIT MODE: Rate History & Versioning (TAX-07) */}
          {editingHsn && (
            <div className="pt-4 border-t border-[var(--gray-200)] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-sm)] font-bold text-[var(--gray-900)] flex items-center gap-1.5">
                  <History size={16} className="text-[var(--blue-600)]" />
                  Rate Version History
                </span>
                {!isAddingNewVersion && (
                  <button
                    type="button"
                    onClick={() => setIsAddingNewVersion(true)}
                    className="text-[var(--text-xs)] font-bold text-[var(--blue-600)] hover:underline flex items-center gap-1"
                  >
                    <Plus size={13} /> Update rate from new date
                  </button>
                )}
              </div>

              {isAddingNewVersion && (
                <div className="p-3 bg-[var(--blue-50)] border border-[var(--blue-200)] rounded-[var(--radius-md)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-xs)] font-bold text-[var(--blue-900)]">
                      New Rate Effective Date:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewVersion(false)}
                      className="text-[var(--text-xs)] text-[var(--gray-500)] hover:text-[var(--gray-800)]"
                    >
                      Cancel new version
                    </button>
                  </div>
                  <input
                    type="date"
                    required
                    value={versionEffectiveFrom}
                    onChange={(e) => setVersionEffectiveFrom(e.target.value)}
                    className="px-3 py-1.5 text-[var(--text-sm)] bg-white border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)]"
                  />
                  <p className="text-[11px] text-[var(--blue-800)]">
                    Changing the rate creates a new version. Existing orders placed before this date keep their original rate.
                  </p>
                </div>
              )}

              {/* Back-dated warning alert (TAX-07) */}
              {isBackdated && (
                <div className="p-3 bg-[var(--amber-50)] border border-[var(--amber-200)] text-[var(--amber-900)] rounded-[var(--radius-md)] text-[var(--text-xs)] flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-[var(--amber-600)]" />
                  <span>
                    Back-dating a rate does not change orders already placed. It only affects orders placed from now on.
                  </span>
                </div>
              )}

              {/* Rate Versions List */}
              <div className="space-y-1.5">
                {(editingHsn.rateVersions || []).map((ver, idx) => {
                  const isCurrent = !ver.effectiveTo;
                  const fromDate = new Date(ver.effectiveFrom).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  const toDate = ver.effectiveTo
                    ? new Date(ver.effectiveTo).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "current";

                  let rateStr = "";
                  if (ver.slabs && ver.slabs.length > 0) {
                    const unique = Array.from(new Set(ver.slabs.map((s) => `${s.gstRate}%`)));
                    rateStr = unique.join(" / ") + " (Slab)";
                  } else {
                    rateStr = `${ver.gstRate}%`;
                  }

                  return (
                    <div
                      key={ver.id}
                      className="flex items-center justify-between p-2.5 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-[var(--radius-md)] text-[var(--text-xs)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[var(--gray-900)]">
                          {rateStr}
                        </span>
                        <span className="text-[var(--gray-500)]">
                          {fromDate} {ver.effectiveTo ? `– ${toDate}` : "onwards"}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--green-100)] text-[var(--green-800)]">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-[var(--gray-400)] text-[11px]">
                        by {ver.createdBy || "System"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Status */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--gray-200)]">
            <div>
              <span className="text-[var(--text-sm)] font-medium text-[var(--gray-800)]">
                Active Status
              </span>
              <p className="text-[11px] text-[var(--gray-500)]">
                Deactivated HSN codes cannot be mapped to categories
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formActive}
              onClick={() => setFormActive(!formActive)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                formActive ? "bg-[var(--blue-600)]" : "bg-[var(--gray-300)]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formActive ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Drawer Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--gray-200)] sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--gray-700)] hover:bg-[var(--gray-100)] rounded-[var(--radius-md)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-[var(--text-sm)] font-medium text-white bg-[var(--blue-600)] hover:bg-[var(--blue-700)] rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingHsn ? "Save HSN Code" : "Create HSN Code"}
            </button>
          </div>
        </form>
      </Drawer>

      {/* CSV Import Modal (TAX-09) */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import HSN Codes from CSV"
        className="max-w-2xl"
      >
        <div className="space-y-4 pt-2">
          {!importPreview ? (
            <div className="space-y-3">
              <p className="text-[var(--text-xs)] text-[var(--gray-600)]">
                Paste CSV data with columns:{" "}
                <code className="font-mono bg-[var(--gray-100)] px-1 rounded">
                  code, description, rate
                </code>
              </p>
              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`code,description,rate\n8504,Electrical inverters,18\n8544,Copper wire,18\n6109,T-shirts,5`}
                className="w-full font-mono text-[var(--text-xs)] p-3 border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--gray-700)] hover:bg-[var(--gray-100)] rounded-[var(--radius-md)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleParseCsv}
                  disabled={!csvText.trim() || isParsing}
                  className="px-4 py-2 text-[var(--text-sm)] font-medium text-white bg-[var(--blue-600)] hover:bg-[var(--blue-700)] rounded-[var(--radius-md)] disabled:opacity-50"
                >
                  {isParsing ? "Parsing..." : "Preview Validation"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[var(--text-xs)]">
                <span className="font-medium text-[var(--gray-700)]">
                  Found {importPreview.length} rows (
                  <span className="text-[var(--green-700)] font-bold">
                    {importPreview.filter((r) => r.isValid).length} valid
                  </span>
                  ,{" "}
                  <span className="text-[var(--red-700)] font-bold">
                    {importPreview.filter((r) => !r.isValid).length} errors
                  </span>
                  )
                </span>
                <button
                  type="button"
                  onClick={() => setImportPreview(null)}
                  className="text-[var(--blue-600)] hover:underline"
                >
                  Back to edit
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto border border-[var(--gray-200)] rounded-[var(--radius-md)]">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[var(--gray-100)] text-[var(--gray-700)] font-bold sticky top-0">
                    <tr>
                      <th className="p-2">Row</th>
                      <th className="p-2">Code</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Rate</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--gray-200)]">
                    {importPreview.map((r, i) => (
                      <tr
                        key={i}
                        className={r.isValid ? "bg-white" : "bg-[var(--red-50)] text-[var(--red-900)]"}
                      >
                        <td className="p-2 font-mono">{r.rowNumber}</td>
                        <td className="p-2 font-mono font-bold">{r.code}</td>
                        <td className="p-2 truncate max-w-[200px]">{r.description}</td>
                        <td className="p-2 font-mono">{r.rate}%</td>
                        <td className="p-2">
                          {r.isValid ? (
                            <span className="text-[var(--green-700)] font-bold flex items-center gap-1">
                              <CheckCircle2 size={12} /> Valid
                            </span>
                          ) : (
                            <span className="text-[var(--red-600)] flex items-center gap-1">
                              <XCircle size={12} /> {r.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--gray-700)] hover:bg-[var(--gray-100)] rounded-[var(--radius-md)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={
                    importPreview.filter((r) => r.isValid).length === 0 || isCommitting
                  }
                  className="px-4 py-2 text-[var(--text-sm)] font-medium text-white bg-[var(--blue-600)] hover:bg-[var(--blue-700)] rounded-[var(--radius-md)] disabled:opacity-50"
                >
                  {isCommitting
                    ? "Importing..."
                    : `Import ${importPreview.filter((r) => r.isValid).length} Valid Codes`}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingHsn)}
        onClose={() => {
          setDeletingHsn(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
        title={`Delete HSN ${deletingHsn?.code}?`}
        description={
          deleteError
            ? deleteError
            : `Are you sure you want to delete HSN code '${deletingHsn?.code}'?`
        }
        confirmLabel={deleteError ? "Close" : "Delete HSN Code"}
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
