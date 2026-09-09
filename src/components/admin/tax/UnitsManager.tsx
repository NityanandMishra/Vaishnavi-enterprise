"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Scale,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Check,
  AlertCircle,
  Package,
} from "lucide-react";
import {
  DataTable,
  ColumnDef,
  PageHeader,
  StatusBadge,
  Modal,
  ConfirmDialog,
  useToast,
  EmptyState,
} from "@/components/admin/ui";
import {
  createUnitAction,
  updateUnitAction,
  deleteUnitAction,
  restoreDefaultUnitsAction,
} from "@/app/admin/(authenticated)/units/actions";

export interface UnitItem extends Record<string, any> {
  id: string;
  name: string;
  symbol: string;
  unitType: "COUNT" | "WEIGHT" | "VOLUME" | "LENGTH" | "AREA" | string;
  decimalPrecision: number;
  isActive: boolean;
  isSystem: boolean;
  productCount: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

const UNIT_TYPES = [
  { id: "COUNT", label: "Count" },
  { id: "WEIGHT", label: "Weight" },
  { id: "VOLUME", label: "Volume" },
  { id: "LENGTH", label: "Length" },
  { id: "AREA", label: "Area" },
];

export default function UnitsManager({ initialUnits }: { initialUnits: UnitItem[] }) {
  const [units, setUnits] = useState<UnitItem[]>(initialUnits);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formSymbol, setFormSymbol] = useState("");
  const [formType, setFormType] = useState<any>("COUNT");
  const [formPrecision, setFormPrecision] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete dialog
  const [deletingUnit, setDeletingUnit] = useState<UnitItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const toast = useToast();

  const totalInUse = useMemo(
    () => units.filter((u) => u.productCount > 0).length,
    [units]
  );

  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches =
          u.name.toLowerCase().includes(q) || u.symbol.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (typeFilter !== "ALL" && u.unitType !== typeFilter) return false;
      if (statusFilter === "ACTIVE" && !u.isActive) return false;
      if (statusFilter === "INACTIVE" && u.isActive) return false;
      return true;
    });
  }, [units, search, typeFilter, statusFilter]);

  function handleOpenCreate() {
    setEditingUnit(null);
    setFormName("");
    setFormSymbol("");
    setFormType("COUNT");
    setFormPrecision(0);
    setFormActive(true);
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(unit: UnitItem) {
    setEditingUnit(unit);
    setFormName(unit.name);
    setFormSymbol(unit.symbol);
    setFormType(unit.unitType);
    setFormPrecision(unit.decimalPrecision);
    setFormActive(unit.isActive);
    setFormError(null);
    setIsModalOpen(true);
  }

  // Live precision preview string (TAX-01)
  const precisionPreviewExample = useMemo(() => {
    const sym = formSymbol.trim() || "unit";
    switch (formPrecision) {
      case 0:
        return `12 ${sym}`;
      case 1:
        return `1.5 ${sym}`;
      case 2:
        return `1.50 ${sym}`;
      case 3:
        return `0.250 ${sym}`;
      default:
        return `1 ${sym}`;
    }
  }, [formPrecision, formSymbol]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError("Unit name is required.");
      return;
    }
    if (!formSymbol.trim()) {
      setFormError("Unit symbol is required.");
      return;
    }
    if (formSymbol.trim().length > 8) {
      setFormError("Unit symbol cannot exceed 8 characters.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingUnit) {
        const res = await updateUnitAction(editingUnit.id, {
          name: formName.trim(),
          symbol: formSymbol.trim(),
          unitType: formType,
          decimalPrecision: formPrecision,
          isActive: formActive,
        });

        if (!res.ok) {
          setFormError(res.error || "Failed to update unit.");
          return;
        }

        setUnits((prev) =>
          prev.map((u) => (u.id === editingUnit.id ? { ...u, ...res.data! } : u))
        );
        toast.success("Unit Updated", `'${formName}' has been saved.`);
        setIsModalOpen(false);
      } else {
        const res = await createUnitAction({
          name: formName.trim(),
          symbol: formSymbol.trim(),
          unitType: formType,
          decimalPrecision: formPrecision,
          isActive: formActive,
        });

        if (!res.ok) {
          setFormError(res.error || "Failed to create unit.");
          return;
        }

        setUnits((prev) => [
          ...prev,
          {
            ...res.data!,
            productCount: 0,
          },
        ]);
        toast.success("Unit Created", `'${formName}' is now available.`);
        setIsModalOpen(false);
      }
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingUnit) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await deleteUnitAction(deletingUnit.id);
      if (!res.ok) {
        setDeleteError(res.error || "Failed to delete unit.");
        return;
      }

      setUnits((prev) => prev.filter((u) => u.id !== deletingUnit.id));
      toast.success("Unit Deleted", res.message);
      setDeletingUnit(null);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete unit.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRestoreDefaults() {
    setIsRestoring(true);
    try {
      const res = await restoreDefaultUnitsAction();
      if (res.ok) {
        toast.success("Defaults Restored", `Restored ${res.restoredCount} default units.`);
        // Reload units
        window.location.reload();
      }
    } catch (err: any) {
      toast.error("Restore Failed", err.message);
    } finally {
      setIsRestoring(false);
    }
  }

  const columns: ColumnDef<UnitItem>[] = [
    {
      id: "name",
      header: "NAME",
      accessorKey: "name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--gray-900)]">{row.name}</span>
          {row.isSystem && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--gray-100)] text-[var(--gray-600)] border border-[var(--gray-200)]">
              System
            </span>
          )}
        </div>
      ),
    },
    {
      id: "symbol",
      header: "SYMBOL",
      accessorKey: "symbol",
      cell: (row) => (
        <code className="font-mono text-[var(--text-xs)] px-1.5 py-0.5 bg-[var(--gray-100)] text-[var(--blue-700)] rounded">
          {row.symbol}
        </code>
      ),
    },
    {
      id: "unitType",
      header: "TYPE",
      accessorKey: "unitType",
      sortable: true,
      cell: (row) => (
        <span className="capitalize text-[var(--text-sm)] text-[var(--gray-700)]">
          {row.unitType.toLowerCase()}
        </span>
      ),
    },
    {
      id: "decimalPrecision",
      header: "PRECISION",
      accessorKey: "decimalPrecision",
      cell: (row) => (
        <span className="text-[var(--text-sm)] text-[var(--gray-700)]">
          {row.decimalPrecision} {row.decimalPrecision === 1 ? "decimal" : "decimals"}
        </span>
      ),
    },
    {
      id: "productCount",
      header: "PRODUCTS",
      accessorKey: "productCount",
      align: "right",
      sortable: true,
      cell: (row) => (
        <Link
          href={`/admin/products?unit=${encodeURIComponent(row.name)}`}
          className="font-mono font-medium text-[var(--blue-600)] hover:underline inline-flex items-center gap-1"
        >
          {row.productCount.toLocaleString()}
        </Link>
      ),
    },
    {
      id: "isActive",
      header: "STATUS",
      accessorKey: "isActive",
      cell: (row) => (
        <StatusBadge
          status={row.isActive ? "ACTIVE" : "INACTIVE"}
        />
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
            title="Edit unit"
            aria-label="Edit unit"
          >
            <Edit2 size={15} />
          </button>
          {!row.isSystem ? (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setDeletingUnit(row);
              }}
              className="p-1.5 text-[var(--gray-500)] hover:text-[var(--red-600)] hover:bg-[var(--red-50)] rounded transition-colors"
              title="Delete unit"
              aria-label="Delete unit"
            >
              <Trash2 size={15} />
            </button>
          ) : (
            <span
              className="p-1.5 text-[var(--gray-300)] cursor-not-allowed inline-block"
              title="System units cannot be deleted"
            >
              <Trash2 size={15} />
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Units & Measures"
        subtitle={`${units.length} units · ${totalInUse} in use`}
        primaryAction={{
          label: "Add Unit",
          icon: Plus,
          onClick: handleOpenCreate,
        }}
      />

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
              placeholder="Search units or symbols..."
              className="w-full pl-9 pr-3 py-1.5 text-[var(--text-sm)] bg-[var(--gray-50)] border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-500)] focus:border-[var(--blue-500)]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-[var(--gray-500)]" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="py-1.5 px-2.5 text-[var(--text-xs)] bg-white border border-[var(--gray-300)] rounded-[var(--radius-md)] text-[var(--gray-700)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-500)]"
            >
              <option value="ALL">All Types</option>
              {UNIT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
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

        {units.length === 0 && (
          <button
            type="button"
            onClick={handleRestoreDefaults}
            disabled={isRestoring}
            className="text-[var(--text-xs)] font-medium text-[var(--blue-600)] hover:underline flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={isRestoring ? "animate-spin" : ""} />
            Restore default units
          </button>
        )}
      </div>

      {/* Main Table */}
      {units.length === 0 ? (
        <EmptyState
          title="No units defined"
          description="Products need a unit of measure before they can be sold."
          actionLabel="Add Unit"
          onAction={handleOpenCreate}
          secondaryLabel="Restore default units"
          onSecondary={handleRestoreDefaults}
        />
      ) : (
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--gray-200)] shadow-sm overflow-hidden">
          <DataTable
            tableId="admin-units-table"
            data={filteredUnits}
            columns={columns}
            keyExtractor={(u) => u.id}
            emptyTitle="No units match the selected filters."
          />
        </div>
      )}

      {/* Modal: Add / Edit Unit (480px) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUnit ? `Edit Unit: ${editingUnit.name}` : "Add Unit of Measure"}
        className="max-w-[480px]"
      >
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 bg-[var(--red-50)] border border-[var(--red-200)] text-[var(--red-700)] rounded-[var(--radius-md)] text-[var(--text-sm)] flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
              Name <span className="text-[var(--red-500)]">*</span>
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Kilogram or Piece"
              className="w-full px-3 py-2 text-[var(--text-sm)] border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)]"
            />
          </div>

          {/* Symbol */}
          <div>
            <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
              Symbol <span className="text-[var(--red-500)]">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={8}
              value={formSymbol}
              onChange={(e) => setFormSymbol(e.target.value)}
              placeholder="e.g. kg, pcs, m"
              className="w-full px-3 py-2 font-mono text-[var(--text-sm)] border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)]"
            />
            <p className="text-[11px] text-[var(--gray-500)] mt-1">
              Shown next to quantities, e.g. <span className="font-mono font-medium">2 kg</span> or{" "}
              <span className="font-mono font-medium">12 pcs</span>
            </p>
          </div>

          {/* Type Segmented Control */}
          <div>
            <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1.5">
              Type <span className="text-[var(--red-500)]">*</span>
            </label>
            <div className="grid grid-cols-5 gap-1 bg-[var(--gray-100)] p-1 rounded-[var(--radius-md)]">
              {UNIT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFormType(t.id)}
                  className={`py-1.5 text-center text-[var(--text-xs)] font-medium rounded transition-all ${
                    formType === t.id
                      ? "bg-white text-[var(--gray-900)] shadow-sm font-semibold"
                      : "text-[var(--gray-600)] hover:text-[var(--gray-900)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Precision Stepper 0–3 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider">
                Decimal Precision <span className="text-[var(--red-500)]">*</span>
              </label>
              <span className="font-mono text-[var(--text-sm)] font-semibold text-[var(--blue-700)]">
                {formPrecision} {formPrecision === 1 ? "decimal" : "decimals"}
              </span>
            </div>

            {editingUnit && editingUnit.productCount > 0 ? (
              <div className="p-2.5 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-[var(--radius-md)] text-[var(--text-xs)] text-[var(--gray-600)]">
                Precision is locked at{" "}
                <span className="font-bold">{editingUnit.decimalPrecision}</span>. Precision
                cannot be changed while{" "}
                <span className="font-semibold text-[var(--gray-900)]">
                  {editingUnit.productCount}
                </span>{" "}
                products use this unit.
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  {[0, 1, 2, 3].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormPrecision(num)}
                      className={`flex-1 py-1.5 border rounded-[var(--radius-md)] text-[var(--text-xs)] font-mono font-medium transition-all ${
                        formPrecision === num
                          ? "bg-[var(--blue-50)] border-[var(--blue-600)] text-[var(--blue-700)] font-bold shadow-sm"
                          : "bg-white border-[var(--gray-300)] text-[var(--gray-700)] hover:bg-[var(--gray-50)]"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--gray-500)] mt-1">
                  Decimal places allowed when entering quantity. 0 rejects fractional values.
                </p>
              </div>
            )}

            {/* Live Precision Example Strip */}
            <div className="mt-2.5 p-2 bg-[var(--blue-50)] border border-[var(--blue-100)] rounded-[var(--radius-md)] flex items-center justify-between">
              <span className="text-[11px] text-[var(--blue-800)] font-medium">
                Live format preview:
              </span>
              <span className="font-mono text-[var(--text-xs)] font-bold text-[var(--blue-900)]">
                {precisionPreviewExample}
              </span>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--gray-200)]">
            <div>
              <span className="text-[var(--text-sm)] font-medium text-[var(--gray-800)]">
                Active Status
              </span>
              <p className="text-[11px] text-[var(--gray-500)]">
                Inactive units are hidden from new product creation
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

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--gray-200)]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--gray-700)] hover:bg-[var(--gray-100)] rounded-[var(--radius-md)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-[var(--text-sm)] font-medium text-white bg-[var(--blue-600)] hover:bg-[var(--blue-700)] rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingUnit ? "Save Changes" : "Save Unit"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingUnit)}
        onClose={() => {
          setDeletingUnit(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
        title={`Delete '${deletingUnit?.name}'?`}
        description={
          deleteError
            ? deleteError
            : `Are you sure you want to delete unit '${deletingUnit?.name}'? This action cannot be undone.`
        }
        confirmLabel={deleteError ? "Close" : "Delete Unit"}
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
