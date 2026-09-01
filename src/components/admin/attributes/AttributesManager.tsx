"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import PageHeader from "@/components/admin/ui/PageHeader";
import DataTable, { ColumnDef } from "@/components/admin/ui/DataTable";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { toast } from "@/components/admin/ui/Toast";
import AttributeDrawer from "./AttributeDrawer";
import {
  Tag,
  Plus,
  Download,
  Filter,
  Layers,
  Palette,
  Sliders,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import {
  getAttributes,
  deleteAttribute,
  bulkDeleteAttributes,
  bulkToggleAttributes,
  toggleAttributeStatus,
} from "@/app/admin/(authenticated)/attributes/actions";

interface AttributeRow {
  id: string;
  name: string;
  code: string;
  inputType: string;
  isVariantDefining: boolean;
  description: string | null;
  usesSwatches: boolean;
  isActive: boolean;
  valuesCount: number;
  categoriesCount: number;
  productsCount: number;
  previewValues: Array<{
    id: string;
    label: string;
    code: string;
    swatchHex: string | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export default function AttributesManager() {
  const [attributes, setAttributes] = useState<AttributeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [variantFilter, setVariantFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Drawer modal
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedAttributeId, setSelectedAttributeId] = useState<string | null>(null);

  // Delete Confirm Dialog
  const [deleteTarget, setDeleteTarget] = useState<AttributeRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAttributes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAttributes({
        search,
        type: typeFilter,
        isVariantDefining: variantFilter,
        isActive: statusFilter,
      });

      if (res.ok && res.data) {
        setAttributes(res.data as any);
      } else {
        setError("Failed to load attributes.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load attributes.");
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, variantFilter, statusFilter]);

  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  const variantCount = useMemo(
    () => attributes.filter((a) => a.isVariantDefining).length,
    [attributes]
  );

  // Handle single delete
  async function handleConfirmDelete() {
    if (!deleteTarget) return;

    setIsDeleting(true);
    const res = await deleteAttribute(deleteTarget.id);
    setIsDeleting(false);

    if (res.ok) {
      toast.success("Attribute Deleted", res.message || `'${deleteTarget.name}' deleted.`);
      setDeleteTarget(null);
      fetchAttributes();
    } else {
      toast.error(
        "Cannot Delete",
        res.error || "This attribute is currently in use by products."
      );
    }
  }

  // Handle single status toggle
  async function handleToggleStatus(attr: AttributeRow) {
    const next = !attr.isActive;
    await toggleAttributeStatus(attr.id, next);
    toast.success(
      next ? "Attribute Activated" : "Attribute Deactivated",
      `'${attr.name}' is now ${next ? "active" : "inactive"}.`
    );
    fetchAttributes();
  }

  // Handle bulk delete
  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected attribute(s)? In-use attributes will be protected.`)) {
      return;
    }

    const res = await bulkDeleteAttributes(selectedIds);
    if (res.ok) {
      toast.info("Bulk Deletion Finished", res.message);
      setSelectedIds([]);
      fetchAttributes();
    } else {
      toast.error("Error", "Failed to delete selected attributes.");
    }
  }

  // Handle bulk activate/deactivate
  async function handleBulkStatus(isActive: boolean) {
    if (selectedIds.length === 0) return;
    await bulkToggleAttributes(selectedIds, isActive);
    toast.success("Updated", `${selectedIds.length} attributes updated.`);
    setSelectedIds([]);
    fetchAttributes();
  }

  // Handle CSV Export
  function handleExportCsv() {
    window.open("/api/admin/export?type=attributes", "_blank");
  }

  const columns: ColumnDef<AttributeRow>[] = [
    {
      id: "name",
      header: "Name & Code",
      sortable: true,
      cell: (row) => (
        <div
          className="cursor-pointer group"
          onClick={() => {
            setSelectedAttributeId(row.id);
            setIsDrawerOpen(true);
          }}
        >
          <div className="font-bold text-admin-fg text-xs group-hover:text-brand-orange-600 transition-colors">
            {row.name}
          </div>
          <div className="font-mono text-[11px] text-admin-fg-muted mt-0.5">
            {row.code}
          </div>
        </div>
      ),
    },
    {
      id: "inputType",
      header: "Type",
      sortable: true,
      cell: (row) => {
        let label = "Select";
        let colorClass = "bg-blue-50 text-blue-700 border-blue-200";

        if (row.inputType === "MULTI_SELECT") {
          label = "Multi-Select";
          colorClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
        } else if (row.inputType === "TEXT") {
          label = "Text";
          colorClass = "bg-slate-100 text-slate-700 border-slate-200";
        } else if (row.inputType === "NUMBER") {
          label = "Number";
          colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        } else if (row.inputType === "BOOLEAN") {
          label = "Yes / No";
          colorClass = "bg-amber-50 text-amber-700 border-amber-200";
        }

        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
            {label}
          </span>
        );
      },
    },
    {
      id: "variant",
      header: "Variant?",
      sortable: true,
      cell: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            row.isVariantDefining
              ? "bg-violet-100 text-violet-800 border border-violet-200"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}
        >
          {row.isVariantDefining ? "Variant" : "Info"}
        </span>
      ),
    },
    {
      id: "values",
      header: "Values",
      cell: (row) => {
        if (row.inputType !== "SINGLE_SELECT" && row.inputType !== "MULTI_SELECT") {
          return <span className="text-xs text-slate-400">—</span>;
        }

        return (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-admin-fg">
              {row.valuesCount} value{row.valuesCount === 1 ? "" : "s"}
            </span>
            {row.previewValues.length > 0 && (
              <div className="flex items-center -space-x-1 ml-1">
                {row.previewValues.slice(0, 4).map((v) => (
                  <div
                    key={v.id}
                    className="w-3.5 h-3.5 rounded-full border border-white shadow-xs"
                    style={{ backgroundColor: v.swatchHex || "#CBD5E1" }}
                    title={v.label}
                  />
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "categoriesCount",
      header: "Categories",
      sortable: true,
      cell: (row) => (
        <span className="text-xs text-admin-fg">
          {row.categoriesCount} {row.categoriesCount === 1 ? "category" : "categories"}
        </span>
      ),
    },
    {
      id: "productsCount",
      header: "Products",
      sortable: true,
      align: "right",
      cell: (row) => (
        <span className="font-mono text-xs text-admin-fg font-semibold">
          {row.productsCount}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (row) => (
        <StatusBadge
          status={row.isActive ? "ACTIVE" : "INACTIVE"}
          showDot={true}
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedAttributeId(row.id);
              setIsDrawerOpen(true);
            }}
            className="p-1.5 text-slate-500 hover:text-brand-orange-600 hover:bg-slate-100 rounded transition-colors"
            title="Edit Attribute"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete Attribute"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attributes"
        subtitle={`${attributes.length} attributes · ${variantCount} variant-defining`}
        primaryAction={{
          label: "Add Attribute",
          icon: Plus,
          onClick: () => {
            setSelectedAttributeId(null);
            setIsDrawerOpen(true);
          },
        }}
        secondaryAction={{
          label: "Export CSV",
          icon: Download,
          onClick: handleExportCsv,
        }}
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-admin-border rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search attributes by name or code…"
              className="input-base text-xs w-full h-9 pl-3 pr-8"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-base text-xs h-9 px-2.5 bg-white border-admin-border"
          >
            <option value="ALL">All Types</option>
            <option value="SINGLE_SELECT">Single Select</option>
            <option value="MULTI_SELECT">Multi Select</option>
            <option value="TEXT">Text</option>
            <option value="NUMBER">Number</option>
            <option value="BOOLEAN">Yes / No</option>
          </select>

          {/* Variant Filter */}
          <select
            value={variantFilter}
            onChange={(e) => setVariantFilter(e.target.value)}
            className="input-base text-xs h-9 px-2.5 bg-white border-admin-border"
          >
            <option value="all">All Roles</option>
            <option value="true">Variant-Defining Only</option>
            <option value="false">Informational Only</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-base text-xs h-9 px-2.5 bg-white border-admin-border"
          >
            <option value="all">All Status</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>

        {(search || typeFilter !== "ALL" || variantFilter !== "all" || statusFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setTypeFilter("ALL");
              setVariantFilter("all");
              setStatusFilter("all");
            }}
            className="text-xs text-brand-orange-600 font-semibold hover:underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Attributes DataTable */}
      <DataTable
        tableId="admin_attributes_table"
        columns={columns}
        data={attributes}
        keyExtractor={(item) => item.id}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={[
          {
            label: "Activate",
            onClick: () => handleBulkStatus(true),
          },
          {
            label: "Deactivate",
            onClick: () => handleBulkStatus(false),
          },
          {
            label: "Delete",
            variant: "danger",
            onClick: handleBulkDelete,
          },
        ]}
        isLoading={loading}
        error={error}
        onRetry={fetchAttributes}
        emptyTitle="No attributes yet"
        emptyDescription="Attributes define how your products vary — like Blade Sweep, Colour, or Voltage. Create one to start configuring categories."
        emptyActionLabel="Add Attribute"
        onEmptyAction={() => {
          setSelectedAttributeId(null);
          setIsDrawerOpen(true);
        }}
      />

      {/* Attribute Create/Edit Drawer */}
      <AttributeDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        attributeId={selectedAttributeId}
        onSaved={fetchAttributes}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete '${deleteTarget?.name}'?`}
        message={
          deleteTarget && deleteTarget.productsCount > 0
            ? `'${deleteTarget.name}' is currently used by ${deleteTarget.productsCount} product(s) and cannot be deleted. Would you like to deactivate it instead?`
            : `Are you sure you want to delete '${deleteTarget?.name}'? This action cannot be undone.`
        }
        confirmLabel={deleteTarget && deleteTarget.productsCount > 0 ? "Deactivate Instead" : "Delete Attribute"}
        variant={deleteTarget && deleteTarget.productsCount > 0 ? "warning" : "danger"}
        isLoading={isDeleting}
        onConfirm={
          deleteTarget && deleteTarget.productsCount > 0
            ? () => {
                handleToggleStatus(deleteTarget);
                setDeleteTarget(null);
              }
            : handleConfirmDelete
        }
      />
    </div>
  );
}
