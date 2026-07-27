"use client";

import { useState, useEffect } from "react";
import {
  getBrands,
  getLogoImages,
  createBrand,
  updateBrand,
  deleteBrand,
} from "./actions";
import {
  Plus,
  Search,
  Tag,
  Edit,
  Trash2,
  X,
  Loader2,
  Check,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";

interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoId: string | null;
  logo: {
    url: string;
    filename: string;
  } | null;
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

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [images, setImages] = useState<MediaImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLogoId, setFormLogoId] = useState<string | null>(null);
  const [showLogoSelector, setShowLogoSelector] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBrands();
    fetchLogoImages();
  }, []);

  const fetchBrands = async () => {
    setLoading(true);
    setError(null);
    const res = await getBrands();
    if (res.success && res.brands) {
      setBrands(res.brands as any);
    } else {
      setError(res.error || "Failed to load brands");
    }
    setLoading(false);
  };

  const fetchLogoImages = async () => {
    const res = await getLogoImages();
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
    if (!editingBrand) {
      setFormSlug(slugify(name));
    }
  };

  const handleOpenCreate = () => {
    setEditingBrand(null);
    setFormName("");
    setFormSlug("");
    setFormDesc("");
    setFormLogoId(null);
    setShowLogoSelector(false);
    setError(null);
    setSuccessMsg(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormName(brand.name);
    setFormSlug(brand.slug);
    setFormDesc(brand.description || "");
    setFormLogoId(brand.logoId);
    setShowLogoSelector(false);
    setError(null);
    setSuccessMsg(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      name: formName,
      slug: formSlug,
      description: formDesc,
      logoId: formLogoId,
    };

    let res;
    if (editingBrand) {
      res = await updateBrand(editingBrand.id, payload as any);
    } else {
      res = await createBrand(payload as any);
    }

    if (res.success) {
      setSuccessMsg(
        editingBrand
          ? "Brand updated successfully!"
          : "Brand created successfully!"
      );
      setModalOpen(false);
      fetchBrands();
    } else {
      setError(res.error || "Save failed");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this brand?")) return;

    setError(null);
    setSuccessMsg(null);
    const res = await deleteBrand(id);
    if (res.success) {
      setSuccessMsg("Brand deleted successfully!");
      fetchBrands();
    } else {
      setError(res.error || "Failed to delete brand");
    }
  };

  const filteredBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    brand.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (brand.description && brand.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="font-sans space-y-6">
      {/* Top action section */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white py-2.5 px-4 rounded-[4px] font-semibold text-sm cursor-pointer transition-colors"
        >
          <Plus size={16} />
          Create Brand
        </button>
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

      {/* Toolbar */}
      <div className="glass-card p-4 flex items-center justify-between">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search brands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] pl-9 pr-3 py-2 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#EA580C] focus:ring-0"
          />
        </div>
        <div className="text-xs text-[#64748B] font-semibold">
          Total: {filteredBrands.length} brands
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 size={32} className="animate-spin text-[#EA580C]" />
          <span>Loading brands...</span>
        </div>
      ) : filteredBrands.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-450">
          <Tag size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-[#0F172A]">No brands found</p>
          <p className="text-xs text-slate-500 mt-1">Try starting by creating a new brand.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBrands.map((brand) => (
            <div
              key={brand.id}
              className="glass-card p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-4 mb-4">
                  {/* Logo Preview */}
                  <div className="w-12 h-12 rounded-[6px] bg-[#F8FAFC] flex items-center justify-center overflow-hidden border border-[#E2E8F0] flex-shrink-0">
                    {brand.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brand.logo.url}
                        alt={brand.name}
                        className="object-contain w-full h-full p-1"
                      />
                    ) : (
                      <Tag size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-sans font-bold text-[#0F172A] text-base leading-tight">
                      {brand.name}
                    </h3>
                    <p className="text-xs text-[#EA580C] font-bold font-mono mt-0.5">
                      /{brand.slug}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#64748B] line-clamp-2 h-8 leading-relaxed">
                  {brand.description || "No description provided."}
                </p>
              </div>

              <div className="border-t border-[#E2E8F0] pt-4 mt-4 flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded-[4px]">
                  {brand._count.products} products
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEdit(brand)}
                    className="p-1.5 rounded-[4px] border border-[#E2E8F0] hover:border-[#EA580C]/35 text-[#475569] hover:text-[#0F172A] transition-colors cursor-pointer"
                    title="Edit Brand"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(brand.id)}
                    disabled={brand._count.products > 0}
                    className={`p-1.5 rounded-[4px] border transition-colors ${
                      brand._count.products > 0
                        ? "bg-slate-100 border-slate-200 text-slate-350 cursor-not-allowed"
                        : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 cursor-pointer"
                    }`}
                    title={brand._count.products > 0 ? "Cannot delete brand in use" : "Delete Brand"}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create/Edit Modal ───────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="font-sans font-bold text-[#0F172A] text-lg">
                {editingBrand ? "Edit Brand" : "Create Brand"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-[#0F172A] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="text-xs text-[#475569] font-bold">Brand Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={handleNameChange}
                  placeholder="e.g. Orient Electric"
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C] focus:ring-0"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#475569] font-bold">Slug</label>
                <input
                  type="text"
                  required
                  value={formSlug}
                  onChange={(e) => setFormSlug(slugify(e.target.value))}
                  placeholder="e.g. orient-electric"
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C] focus:ring-0 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#475569] font-bold">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Tell us about this brand..."
                  rows={3}
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C] focus:ring-0"
                />
              </div>

              {/* Logo Select */}
              <div className="space-y-2">
                <label className="text-xs text-[#475569] font-bold block">Brand Logo</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {formLogoId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={images.find((i) => i.id === formLogoId)?.url || ""}
                        alt="Logo Preview"
                        className="object-contain w-full h-full p-1"
                      />
                    ) : (
                      <ImageIcon size={20} className="text-slate-350" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLogoSelector(!showLogoSelector)}
                    className="py-1.5 px-3 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#EA580C]/40 text-xs font-semibold text-[#475569] hover:text-[#0F172A] transition-colors cursor-pointer"
                  >
                    {formLogoId ? "Change Logo" : "Choose Logo"}
                  </button>
                  {formLogoId && (
                    <button
                      type="button"
                      onClick={() => setFormLogoId(null)}
                      className="text-xs text-rose-600 font-semibold hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Logo Selector Panel */}
                {showLogoSelector && (
                  <div className="border border-[#E2E8F0] bg-[#F8FAFC] rounded-[6px] p-3 max-h-48 overflow-y-auto">
                    {images.length === 0 ? (
                      <p className="text-center py-4 text-xs text-slate-500">
                        No logo images found. Upload them in the Media Library first.
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {images.map((img) => (
                          <div
                            key={img.id}
                            onClick={() => {
                              setFormLogoId(img.id);
                              setShowLogoSelector(false);
                            }}
                            className={`aspect-square bg-white border rounded-[6px] overflow-hidden flex items-center justify-center p-1 cursor-pointer hover:border-[#EA580C] transition-colors ${
                              formLogoId === img.id
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
                  onClick={() => setModalOpen(false)}
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
                    "Save Brand"
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
