"use client";

import { useState, useEffect } from "react";
import {
  getImages,
  uploadImage,
  deleteImage,
} from "./actions";
import {
  Image as ImageIcon,
  Copy,
  Trash2,
  Search,
  Upload,
  Loader2,
  Check,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface MediaImage {
  id: string;
  url: string;
  filename: string;
  size: number;
  alt: string | null;
  createdAt: Date;
  usedCount: number;
}

export default function ImagesPage() {
  const [images, setImages] = useState<MediaImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUsed, setFilterUsed] = useState<"ALL" | "USED" | "UNUSED">("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    const res = await getImages();
    if (res.success && res.images) {
      setImages(res.images as any);
    } else {
      setError(res.error || "Failed to load images");
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setAltText(file.name.split(".")[0].replace(/[-_]/g, " "));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("alt", altText);

    const res = await uploadImage(formData);
    if (res.success) {
      setSuccessMsg("Image uploaded successfully!");
      setSelectedFile(null);
      setAltText("");
      // Reset file input
      const fileInput = document.getElementById("file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      fetchImages();
    } else {
      setError(res.error || "Upload failed");
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    setError(null);
    setSuccessMsg(null);
    const res = await deleteImage(id);
    if (res.success) {
      setSuccessMsg("Image deleted successfully!");
      fetchImages();
    } else {
      setError(res.error || "Failed to delete image");
    }
  };

  const copyToClipboard = (url: string, id: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredImages = images.filter((img) => {
    const matchesSearch =
      img.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (img.alt && img.alt.toLowerCase().includes(searchQuery.toLowerCase()));

    if (filterUsed === "USED") {
      return matchesSearch && img.usedCount > 0;
    }
    if (filterUsed === "UNUSED") {
      return matchesSearch && img.usedCount === 0;
    }
    return matchesSearch;
  });

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Upload Box (Left / Top) ─────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="glass-card p-5 sticky top-24">
            <h3 className="text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-3 mb-4 flex items-center gap-2">
              <Upload size={18} className="text-[#EA580C]" />
              Upload New Image
            </h3>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-[#E2E8F0] hover:border-[#EA580C]/40 bg-[#F8FAFC] rounded-[6px] p-6 text-center cursor-pointer transition-colors relative">
                <input
                  type="file"
                  id="file-input"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  required
                />
                <div className="flex flex-col items-center gap-2 text-[#64748B]">
                  <ImageIcon size={32} className="text-slate-400 mb-1" />
                  {selectedFile ? (
                    <span className="text-sm text-[#EA580C] font-bold truncate max-w-xs block px-2">
                      {selectedFile.name}
                    </span>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-[#0F172A]">Click or drag image to upload</span>
                      <span className="text-xs text-slate-500">Supports PNG, JPG, JPEG, WEBP, SVG</span>
                    </>
                  )}
                </div>
              </div>

              {selectedFile && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-[#475569] font-bold">
                      Alt Text / Label (for SEO)
                    </label>
                    <input
                      type="text"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      placeholder="e.g. Copper house wire roll"
                      className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#EA580C] focus:ring-0 font-sans"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold py-2.5 px-4 rounded-[4px] text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Upload File
                      </>
                    )}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>

        {/* ── Image Gallery (Right / Bottom) ─────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5">
            {/* Filters Header */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-[#E2E8F0] pb-4 mb-4">
              {/* Search */}
              <div className="relative w-full md:max-w-xs">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by filename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] pl-9 pr-3 py-2 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#EA580C] focus:ring-0"
                />
              </div>

              {/* Usage Filter Pills */}
              <div className="flex gap-1.5 self-stretch md:self-auto bg-[#F8FAFC] p-1 rounded-[6px] border border-[#E2E8F0]">
                {(["ALL", "USED", "UNUSED"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setFilterUsed(filter)}
                    className={`px-3 py-1.5 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                      filterUsed === filter
                        ? "bg-[#0F172A] text-white"
                        : "text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100"
                    }`}
                  >
                    {filter === "ALL" ? "All" : filter === "USED" ? "In Use" : "Unused"}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid display */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                <Loader2 size={32} className="animate-spin text-[#EA580C]" />
                <span>Loading media...</span>
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <ImageIcon size={48} className="mx-auto text-slate-350 mb-3" />
                <p className="text-sm font-semibold text-[#0F172A]">No images found</p>
                <p className="text-xs text-slate-500 mt-1">Try expanding your search or upload new files.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filteredImages.map((img) => (
                  <div
                    key={img.id}
                    className="group border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#EA580C]/40 rounded-[8px] overflow-hidden flex flex-col transition-all duration-200"
                  >
                    {/* Image Box */}
                    <div className="aspect-video w-full bg-white flex items-center justify-center relative overflow-hidden flex-shrink-0 border-b border-[#E2E8F0]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.alt || img.filename}
                        className="object-contain w-full h-full p-2 group-hover:scale-105 transition-transform duration-300"
                      />
                      {img.usedCount > 0 ? (
                        <span className="absolute top-2 left-2 text-[9px] font-bold bg-[#E0F2FE] border border-[#BAE6FD] text-[#0369A1] px-1.5 py-0.5 rounded-[4px]">
                          Used ({img.usedCount})
                        </span>
                      ) : (
                        <span className="absolute top-2 left-2 text-[9px] font-bold bg-[#F1F5F9] border border-[#E2E8F0] text-[#475569] px-1.5 py-0.5 rounded-[4px]">
                          Unused
                        </span>
                      )}
                    </div>

                    {/* Metadata & Controls */}
                    <div className="p-3 flex-1 flex flex-col justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#0F172A] truncate" title={img.filename}>
                          {img.filename}
                        </p>
                        <p className="text-[10px] text-[#64748B] mt-0.5 truncate">
                          Alt: {img.alt || "None"}
                        </p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">
                          {formatSize(img.size)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 border-t border-[#E2E8F0] pt-2 mt-1">
                        <button
                          onClick={() => copyToClipboard(img.url, img.id)}
                          className="flex-1 py-1 px-2 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#EA580C]/35 text-[#475569] hover:text-[#0F172A] flex items-center justify-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer"
                          title="Copy relative image URL to clipboard"
                        >
                          {copiedId === img.id ? (
                            <>
                              <Check size={11} className="text-[#16A34A]" />
                              <span className="text-[#16A34A]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy URL</span>
                            </>
                          )}
                        </button>
                        <a
                          href={img.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 px-1.5 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#EA580C]/35 text-[#475569] hover:text-[#0F172A] flex items-center justify-center transition-colors"
                          title="Open image in new tab"
                        >
                          <ExternalLink size={11} />
                        </a>
                        <button
                          onClick={() => handleDelete(img.id)}
                          disabled={img.usedCount > 0}
                          className={`p-1 px-1.5 rounded-[4px] border flex items-center justify-center transition-all ${
                            img.usedCount > 0
                              ? "bg-slate-100 border-slate-200 text-slate-350 cursor-not-allowed"
                              : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 cursor-pointer"
                          }`}
                          title={img.usedCount > 0 ? "Cannot delete image in use" : "Delete image"}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
