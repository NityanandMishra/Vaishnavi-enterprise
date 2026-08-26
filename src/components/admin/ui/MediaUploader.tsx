"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { UploadCloud, X, Star, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadedMediaItem {
  id: string;
  url: string;
  filename: string;
  size: number;
  width?: number;
  height?: number;
  isMain?: boolean;
}

interface MediaUploaderProps {
  items: UploadedMediaItem[];
  onChange: (items: UploadedMediaItem[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  minDimensions?: { width: number; height: number };
  accept?: string;
  className?: string;
}

export default function MediaUploader({
  items,
  onChange,
  maxFiles = 10,
  maxSizeMB = 5, // Max 5MB per Spec 00 (6.7)
  minDimensions = { width: 800, height: 800 }, // Min 800x800px per Spec 00 (6.7)
  accept = "image/jpeg,image/png,image/webp",
  className,
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate single image file
  async function validateAndReadImage(file: File): Promise<UploadedMediaItem> {
    // 1. File Type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error(`"${file.name}" is not a supported format (JPG, PNG, WebP only).`);
    }

    // 2. Max Size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new Error(`"${file.name}" exceeds the ${maxSizeMB}MB file size limit.`);
    }

    // 3. Minimum Dimensions
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new window.Image();
        img.onload = () => {
          if (img.width < minDimensions.width || img.height < minDimensions.height) {
            reject(
              new Error(
                `"${file.name}" is ${img.width}×${img.height}px. Minimum required is ${minDimensions.width}×${minDimensions.height}px.`
              )
            );
          } else {
            resolve({
              id: Math.random().toString(36).substring(2, 9),
              url: dataUrl,
              filename: file.name,
              size: file.size,
              width: img.width,
              height: img.height,
              isMain: items.length === 0, // First item is primary
            });
          }
        };
        img.onerror = () => reject(new Error(`Failed to decode image "${file.name}".`));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error(`Failed to read "${file.name}".`));
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(files: FileList | File[]) {
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const fileArray = Array.from(files);
      if (items.length + fileArray.length > maxFiles) {
        throw new Error(`You can upload a maximum of ${maxFiles} images.`);
      }

      const newItems: UploadedMediaItem[] = [];
      for (const file of fileArray) {
        const validated = await validateAndReadImage(file);
        newItems.push(validated);
      }

      const updated = [...items, ...newItems];
      // Ensure exactly one is marked as main
      if (updated.length > 0 && !updated.some((i) => i.isMain)) {
        updated[0].isMain = true;
      }

      onChange(updated);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process uploaded images.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSetMain(id: string) {
    const updated = items.map((item) => ({
      ...item,
      isMain: item.id === id,
    }));
    // Reorder so main image sits first as primary
    const mainItem = updated.find((i) => i.id === id);
    const otherItems = updated.filter((i) => i.id !== id);
    if (mainItem) {
      onChange([mainItem, ...otherItems]);
    } else {
      onChange(updated);
    }
  }

  function handleRemove(id: string) {
    const remaining = items.filter((item) => item.id !== id);
    if (remaining.length > 0 && !remaining.some((i) => i.isMain)) {
      remaining[0].isMain = true;
    }
    onChange(remaining);
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-[var(--radius-lg)] p-6 text-center cursor-pointer transition-colors bg-[var(--color-surface)]",
          isDragging
            ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
            : "border-[var(--color-border-strong)] hover:border-[var(--color-fg-muted)]"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center mx-auto mb-3 text-[var(--color-primary)]">
          {isProcessing ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <UploadCloud size={24} />
          )}
        </div>

        <p className="text-[var(--text-sm)] font-medium text-[var(--color-fg)]">
          Click to upload or drag and drop
        </p>
        <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)] mt-1">
          JPG, PNG, WebP · Max {maxSizeMB}MB · Min {minDimensions.width}×{minDimensions.height}px
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <p className="text-[var(--text-xs)] text-[var(--color-danger)] flex items-center gap-1.5 font-medium">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{errorMessage}</span>
        </p>
      )}

      {/* Image Grid with Primary Badge & Reordering */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={cn(
                "relative group aspect-square rounded-[var(--radius-md)] border overflow-hidden bg-[var(--color-surface-sunken)] transition-shadow",
                item.isMain
                  ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]"
                  : "border-[var(--color-border)]"
              )}
            >
              <Image
                src={item.url}
                alt={item.filename}
                fill
                className="object-cover"
                sizes="140px"
              />

              {/* Main Badge */}
              {item.isMain ? (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] text-white text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                  <Star size={10} fill="currentColor" /> Primary
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetMain(item.id)}
                  className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 bg-slate-900/75 hover:bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded-[var(--radius-sm)] transition-opacity"
                >
                  Set Primary
                </button>
              )}

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                aria-label={`Remove ${item.filename}`}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/75 hover:bg-[var(--color-danger)] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
              >
                <X size={12} />
              </button>

              {/* File Info Overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent p-2 text-white text-[11px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="truncate font-mono">{item.filename}</p>
                {item.width && item.height && (
                  <p className="text-[10px] text-slate-300 font-mono">
                    {item.width}×{item.height}px
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
