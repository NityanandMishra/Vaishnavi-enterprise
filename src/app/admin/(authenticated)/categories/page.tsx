"use client";

import { useState, useEffect } from "react";
import { z } from "zod";
import {
  getCategories,
  getCategoryImages,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./actions";
import {
  Plus,
  FolderTree,
  Edit,
  Trash2,
  X,
  Loader2,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Folder,
  ChevronRight,
} from "lucide-react";

// ── Zod Schemas ────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").min(2, "Name must be at least 2 characters"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters/numbers separated by hyphens"),
  description: z.string().optional(),
  sortOrder: z.number().int("Sort order must be a whole number").min(0, "Sort order must be 0 or more"),
  // parentId validation is handled separately based on isSubcategory context
});

const subcategorySchema = categorySchema.extend({
  parentId: z.string().min(1, "Please select a parent category"),
});

type FieldErrors = Partial<Record<"name" | "slug" | "description" | "sortOrder" | "parentId", string>>;

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageId: string | null;
  defaultCheckoutMode: string;
  sortOrder: number;
  parentId: string | null;
  image: {
    url: string;
    filename: string;
  } | null;
  parent: {
    id: string;
    name: string;
  } | null;
  children: {
    id: string;
    name: string;
  }[];
  _count: {
    products: number;
  };
}

interface MediaImage {
  id: string;
  url: string;
  filename: string;
  alt: string | null;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<MediaImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Column Selection State
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formImageId, setFormImageId] = useState<string | null>(null);
  const [formParentId, setFormParentId] = useState<string>("");
  const [formCheckoutMode, setFormCheckoutMode] = useState("BUY");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [saving, setSaving] = useState(false);

  // Zod field errors (per-field) + modal-level server error
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchCategoryImages();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    const res = await getCategories();
    if (res.success && res.categories) {
      const allCats = res.categories as any[];
      setCategories(allCats);

      // Auto-select first parent category if none selected
      const parents = allCats.filter((c) => !c.parentId);
      if (parents.length > 0) {
        setSelectedParentId((prev) => prev || parents[0].id);
      }
    } else {
      setError(res.error || "Failed to load categories");
    }
    setLoading(false);
  };

  const fetchCategoryImages = async () => {
    const res = await getCategoryImages();
    if (res.success && res.images) {
      setImages(res.images as any);
    }
  };

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormName(name);
    if (!editingCategory) {
      setFormSlug(slugify(name));
    }
    // Clear name error on change
    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
  };

  const resetForm = () => {
    setFormName("");
    setFormSlug("");
    setFormDesc("");
    setFormImageId(null);
    setFormCheckoutMode("BUY");
    setFormSortOrder(0);
    setShowImageSelector(false);
    setFieldErrors({});
    setFormError(null);
    setError(null);
    setSuccessMsg(null);
  };

  const handleOpenCreateParent = () => {
    setEditingCategory(null);
    resetForm();
    setFormParentId(""); // empty = top-level/parent category
    setModalOpen(true);
  };

  const handleOpenCreateSub = () => {
    setEditingCategory(null);
    resetForm();
    // Default to "no category selected" — user must pick explicitly
    setFormParentId("");
    setModalOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormSlug(category.slug);
    setFormDesc(category.description || "");
    setFormImageId(category.imageId);
    setFormParentId(category.parentId || "");
    setFormCheckoutMode(category.defaultCheckoutMode);
    setFormSortOrder(category.sortOrder);
    setShowImageSelector(false);
    setFieldErrors({});
    setError(null);
    setSuccessMsg(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setFieldErrors({});
    setFormError(null);
  };

  // Determine if the current form is for a subcategory.
  // When creating: isSubcategory = opened via "Add Sub-category" button,
  // detected by checking if we arrived from handleOpenCreateSub vs handleOpenCreateParent.
  // We use a separate flag for this since formParentId can be "" for both.
  const [isSubcategoryForm, setIsSubcategoryForm] = useState(false);

  const handleOpenCreateParentWithFlag = () => {
    setIsSubcategoryForm(false);
    handleOpenCreateParent();
  };

  const handleOpenCreateSubWithFlag = () => {
    setIsSubcategoryForm(true);
    handleOpenCreateSub();
  };

  const handleOpenEditWithFlag = (category: Category) => {
    setIsSubcategoryForm(!!category.parentId);
    handleOpenEdit(category);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Run Zod validation
    const dataToValidate = {
      name: formName,
      slug: formSlug,
      description: formDesc || undefined,
      sortOrder: formSortOrder,
      ...(isSubcategoryForm ? { parentId: formParentId } : {}),
    };

    const schema = isSubcategoryForm ? subcategorySchema : categorySchema;
    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (field && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      name: formName,
      slug: formSlug,
      description: formDesc,
      imageId: formImageId,
      parentId: formParentId || null,
      defaultCheckoutMode: formCheckoutMode,
      sortOrder: Number(formSortOrder),
    };

    let res;
    if (editingCategory) {
      res = await updateCategory(editingCategory.id, payload as any);
    } else {
      res = await createCategory(payload as any);
    }

    if (res.success) {
      setSuccessMsg(
        editingCategory
          ? (isSubcategoryForm ? "Subcategory updated successfully!" : "Category updated successfully!")
          : (isSubcategoryForm ? "Subcategory created successfully!" : "Category created successfully!")
      );
      setModalOpen(false);

      // Keep track of parent to auto-select
      const savedParentId = payload.parentId || (res as any).category?.id;
      if (savedParentId) {
        setSelectedParentId(savedParentId);
      }

      fetchCategories();
    } else {
      // Route server errors into the modal, not the page banner
      const errMsg = res.error || "Save failed";
      const lowerErr = errMsg.toLowerCase();
      if (lowerErr.includes("slug")) {
        setFieldErrors((prev) => ({ ...prev, slug: errMsg }));
      } else if (lowerErr.includes("name")) {
        setFieldErrors((prev) => ({ ...prev, name: errMsg }));
      } else {
        setFormError(errMsg);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    setError(null);
    setSuccessMsg(null);
    const res = await deleteCategory(id);
    if (res.success) {
      setSuccessMsg("Category deleted successfully!");

      // Auto-fallback selection if parent is deleted
      if (id === selectedParentId) {
        const remainingParents = parentCategories.filter((c) => c.id !== id);
        setSelectedParentId(remainingParents.length > 0 ? remainingParents[0].id : null);
      }

      fetchCategories();
    } else {
      setError(res.error || "Failed to delete category");
    }
  };

  // Lists
  const parentCategories = categories.filter((c) => !c.parentId);
  const selectedParent = categories.find((c) => c.id === selectedParentId);
  const subCategories = selectedParent
    ? categories.filter((c) => c.parentId === selectedParent.id)
    : [];

  const parentOptions = categories.filter(
    (c) => !c.parentId && (!editingCategory || c.id !== editingCategory.id)
  );

  // Helper: field error class
  const fieldClass = (hasError: boolean) =>
    `w-full bg-white border rounded-[6px] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:ring-0 ${
      hasError
        ? "border-rose-400 focus:border-rose-500"
        : "border-[#cbd5e1] focus:border-[#EA580C]"
    }`;

  return (
    <div className="font-sans space-y-6">
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 size={32} className="animate-spin text-[#EA580C]" />
          <span>Loading categories...</span>
        </div>
      ) : categories.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-450">
          <FolderTree size={48} className="mx-auto text-slate-350 mb-3" />
          <p className="text-sm font-semibold text-[#0F172A]">No categories found</p>
          <p className="text-xs text-slate-500 mt-1">Get started by creating your first category.</p>
          <div className="mt-4">
            <button
              onClick={handleOpenCreateParentWithFlag}
              className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white py-2.5 px-4 rounded-[4px] font-semibold text-sm cursor-pointer transition-colors"
            >
              <Plus size={16} />
              Create Category
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top description & main action */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <p className="text-[#64748B] text-sm font-medium">
                Manage parent categories and their respective sub-items.
              </p>
            </div>
            <button
              onClick={handleOpenCreateParentWithFlag}
              className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white py-2.5 px-4 rounded-[4px] font-semibold text-sm cursor-pointer transition-colors"
            >
              <Plus size={16} />
              New Parent Category
            </button>
          </div>

          {/* Two Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
            {/* Left Column: Parent list */}
            <div className="glass-card overflow-hidden border border-[#E2E8F0]">
              <div className="padding py-3.5 px-5 flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <span className="text-xs font-bold text-[#334155] uppercase tracking-wider">Parent Categories</span>
                <span className="bg-[#E2E8F0] text-[#334155] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {parentCategories.length} TOTAL
                </span>
              </div>

              <div className="divide-y divide-[#F1F5F9]">
                {parentCategories.map((cat) => {
                  const isSelected = cat.id === selectedParentId;
                  const catSubCount = categories.filter((c) => c.parentId === cat.id).length;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedParentId(cat.id)}
                      className={`flex items-center gap-3 p-4 cursor-pointer transition-all hover:bg-slate-50 relative group ${
                        isSelected
                          ? "bg-[#FFF7ED] border-l-4 border-[#EA580C] pl-3"
                          : ""
                      }`}
                    >
                      <div className="w-9 h-9 rounded-[6px] bg-[#F1F5F9] flex items-center justify-center flex-shrink-0 text-[#0F172A]">
                        {cat.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cat.image.url} alt={cat.name} className="object-contain w-full h-full p-1" />
                        ) : (
                          <Folder size={18} className="text-[#0F172A]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-[#0F172A] truncate">{cat.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-[8px] font-extrabold px-1 py-0.2 rounded border uppercase tracking-wider ${
                              cat.defaultCheckoutMode === "BUY"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-blue-50 text-blue-700 border-blue-100"
                            }`}
                          >
                            {cat.defaultCheckoutMode}
                          </span>
                          <span className="text-[10px] font-semibold text-[#94A3B8]">
                            {catSubCount} sub-items
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditWithFlag(cat);
                          }}
                          className="p-1 text-slate-400 hover:text-[#0F172A] hover:bg-slate-100 rounded-[4px] transition-colors"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(cat.id);
                          }}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-[4px] transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                        {isSelected && <ChevronRight size={16} className="text-[#EA580C]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Sub-categories list */}
            {selectedParent ? (
              <div className="glass-card p-6 border border-[#E2E8F0]">
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4 mb-6">
                  <div>
                    <p className="text-xs text-[#94A3B8] font-bold">
                      Parent Category <span className="text-[#EA580C] font-extrabold">› {selectedParent.name}</span>
                    </p>
                    <h4 className="text-lg font-bold text-[#0F172A] mt-1">Sub-categories</h4>
                  </div>
                  <button
                    onClick={handleOpenCreateSubWithFlag}
                    className="inline-flex items-center gap-1.5 border border-[#EA580C] text-[#EA580C] hover:bg-[#FFF7ED] py-2 px-4 rounded-[4px] font-bold text-xs cursor-pointer transition-colors"
                  >
                    <Plus size={14} />
                    Add Sub-category
                  </button>
                </div>

                {/* Sub Categories Grid */}
                {subCategories.length === 0 ? (
                  <div className="text-center py-12 text-[#64748B]">
                    <Folder className="mx-auto text-slate-200 mb-3" size={40} />
                    <p className="text-sm font-semibold">No sub-categories in this parent</p>
                    <p className="text-xs text-slate-400 mt-0.5">Click &quot;Add Sub-category&quot; to list products under this section.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {subCategories.map((sub) => (
                      <div
                        key={sub.id}
                        className="bg-white border border-[#E2E8F0] rounded-[8px] overflow-hidden flex flex-col justify-between"
                      >
                        <div className="relative height h-[130px] bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-center overflow-hidden">
                          <span
                            className={`absolute top-2.5 left-2.5 z-10 text-[8px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                              sub.defaultCheckoutMode === "BUY"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-blue-50 text-blue-700 border-blue-100"
                            }`}
                          >
                            {sub.defaultCheckoutMode}
                          </span>
                          {sub.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={sub.image.url} alt={sub.name} className="object-contain w-full h-full p-2" />
                          ) : (
                            <Folder size={32} className="text-slate-300" />
                          )}
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <p className="font-bold text-sm text-[#0F172A]">{sub.name}</p>
                            <p className="text-xs text-slate-500 mt-1 font-semibold">
                              {sub._count.products} products in catalog
                            </p>
                          </div>

                          <div className="flex gap-2 border-t border-slate-100 pt-3 mt-3 justify-end">
                            <button
                              onClick={() => handleOpenEditWithFlag(sub)}
                              className="p-1.5 rounded-[4px] border border-[#E2E8F0] hover:border-[#EA580C]/35 text-[#475569] hover:text-[#0F172A] transition-colors"
                              title="Edit"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(sub.id)}
                              disabled={sub._count.products > 0}
                              className={`p-1.5 rounded-[4px] border transition-colors ${
                                sub._count.products > 0
                                  ? "bg-slate-100 border-slate-200 text-slate-350 cursor-not-allowed"
                                  : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                              }`}
                              title={sub._count.products > 0 ? "In use by products" : "Delete"}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-card p-12 text-center text-slate-400">
                Please select a parent category to configure sub-items.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create/Edit Modal ───────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E2E8F0] flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <h3 className="font-sans font-bold text-[#0F172A] text-lg">
                  {editingCategory
                    ? (isSubcategoryForm ? "Edit Subcategory" : "Edit Category")
                    : (isSubcategoryForm ? "Create Subcategory" : "Create Category")}
                </h3>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-[#0F172A] cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider mt-0.5">
                {isSubcategoryForm
                  ? `Catalog › Categories › ${selectedParent?.name || "Parent"} › ${editingCategory ? "Edit" : "New"} Subcategory`
                  : `Catalog › Categories › ${editingCategory ? "Edit" : "New"} Category`
                }
              </p>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} noValidate className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Modal-level server error (slug duplicate, DB constraint, etc.) */}
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2.5 rounded-[6px] flex items-center gap-2 text-sm">
                  <AlertCircle size={15} />
                  <span className="font-semibold">{formError}</span>
                </div>
              )}

              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs text-[#475569] font-bold">
                  {isSubcategoryForm ? "Subcategory Name" : "Category Name"}
                  <span className="text-rose-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={handleNameChange}
                  onBlur={() => {
                    if (!formName.trim()) setFieldErrors((p) => ({ ...p, name: "Name is required" }));
                  }}
                  placeholder={isSubcategoryForm ? "e.g. Off-Grid Inverters" : "e.g. Solar Panels"}
                  className={fieldClass(!!fieldErrors.name)}
                />
                {fieldErrors.name && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> {fieldErrors.name}
                  </p>
                )}
              </div>

              {/* Slug */}
              <div className="space-y-1">
                <label className="text-xs text-[#475569] font-bold">
                  Slug <span className="text-rose-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => {
                    setFormSlug(slugify(e.target.value));
                    if (fieldErrors.slug) setFieldErrors((p) => ({ ...p, slug: undefined }));
                  }}
                  placeholder={isSubcategoryForm ? "e.g. off-grid-inverters" : "e.g. solar-panels"}
                  className={`${fieldClass(!!fieldErrors.slug)} font-mono`}
                />
                {fieldErrors.slug && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> {fieldErrors.slug}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs text-[#475569] font-bold">
                  {isSubcategoryForm ? "Subcategory Description" : "Description"}
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder={
                    isSubcategoryForm
                      ? "Brief description of products in this subcategory..."
                      : "Brief description of products in this category..."
                  }
                  rows={3}
                  className={fieldClass(!!fieldErrors.description)}
                />
                {fieldErrors.description && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> {fieldErrors.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Default Mode */}
                <div className="space-y-1">
                  <label className="text-xs text-[#475569] font-bold">Default Mode</label>
                  <select
                    value={formCheckoutMode}
                    onChange={(e) => setFormCheckoutMode(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C]"
                  >
                    <option value="BUY">BUY (E-Commerce)</option>
                    <option value="INQUIRE">INQUIRE (Lead Inquiries)</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div className="space-y-1">
                  <label className="text-xs text-[#475569] font-bold">Sort Order</label>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => {
                      setFormSortOrder(Number(e.target.value));
                      if (fieldErrors.sortOrder) setFieldErrors((p) => ({ ...p, sortOrder: undefined }));
                    }}
                    className={fieldClass(!!fieldErrors.sortOrder)}
                  />
                  {fieldErrors.sortOrder && (
                    <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle size={11} /> {fieldErrors.sortOrder}
                    </p>
                  )}
                </div>
              </div>

              {/* Parent Category — shown for subcategory forms OR edit of any item */}
              {(isSubcategoryForm || editingCategory) && (
                <div className="space-y-1">
                  <label className="text-xs text-[#475569] font-bold">
                    {isSubcategoryForm ? (
                      <>
                        Parent Category{" "}
                        <span className="text-rose-500 ml-0.5">*</span>
                      </>
                    ) : (
                      "Parent Category (leave blank for top-level)"
                    )}
                  </label>
                  <select
                    value={formParentId}
                    onChange={(e) => {
                      setFormParentId(e.target.value);
                      if (fieldErrors.parentId) setFieldErrors((p) => ({ ...p, parentId: undefined }));
                    }}
                    className={fieldClass(!!fieldErrors.parentId)}
                  >
                    {/* Default: no selection required for subcategory forms */}
                    <option value="">
                      {isSubcategoryForm ? "— No Category Selected —" : "None (Top-Level Category)"}
                    </option>
                    {parentOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.parentId && (
                    <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle size={11} /> {fieldErrors.parentId}
                    </p>
                  )}
                </div>
              )}

              {/* Banner Image Select */}
              <div className="space-y-2">
                <label className="text-xs text-[#475569] font-bold block">
                  {isSubcategoryForm ? "Subcategory Banner Image" : "Category Banner Image"}
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {formImageId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={images.find((i) => i.id === formImageId)?.url || ""}
                        alt="Banner Preview"
                        className="object-contain w-full h-full p-1"
                      />
                    ) : (
                      <ImageIcon size={20} className="text-slate-355" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowImageSelector(!showImageSelector)}
                    className="py-1.5 px-3 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#EA580C]/40 text-xs font-bold text-[#475569] hover:text-[#0F172A] transition-colors cursor-pointer"
                  >
                    {formImageId ? "Change Banner" : "Choose Banner"}
                  </button>
                  {formImageId && (
                    <button
                      type="button"
                      onClick={() => setFormImageId(null)}
                      className="text-xs text-rose-600 font-semibold hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Banner Image Selector Panel */}
                {showImageSelector && (
                  <div className="border border-[#E2E8F0] bg-[#F8FAFC] rounded-[6px] p-3 max-h-48 overflow-y-auto">
                    {images.length === 0 ? (
                      <p className="text-center py-4 text-xs text-slate-500">
                        No images found in the Media Library. Upload them there first.
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {images.map((img) => (
                          <div
                            key={img.id}
                            onClick={() => {
                              setFormImageId(img.id);
                              setShowImageSelector(false);
                            }}
                            className={`aspect-square bg-white border rounded-[6px] overflow-hidden flex items-center justify-center p-1 cursor-pointer hover:border-[#EA580C] transition-colors ${
                              formImageId === img.id
                                ? "border-[#EA580C] ring-1 ring-[#EA580C]"
                                : "border-[#E2E8F0]"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt={img.alt || img.filename}
                              className="object-contain w-full h-full"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-white border border-[#cbd5e1] hover:border-slate-400 text-[#475569] font-semibold py-2.5 px-4 rounded-[4px] text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold py-2.5 px-4 rounded-[4px] text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    isSubcategoryForm ? "Save Subcategory" : "Save Category"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
