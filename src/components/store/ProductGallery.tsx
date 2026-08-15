"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import StockBadge, { type StockState } from "./StockBadge";

export type GalleryImage = { url: string; alt: string | null };

export default function ProductGallery({
  images,
  title,
  badge,
}: {
  images: GalleryImage[];
  title: string;
  badge?: StockState;
}) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div>
      <div className="relative w-full aspect-square bg-surface border border-border-base rounded-lg overflow-hidden">
        {/* Stays an overlay here — the gallery image is large enough to carry
            it — but the tone is opaque so it holds over any photograph. */}
        {badge && <StockBadge state={badge} className="absolute top-3 left-3 z-10 shadow-sm" />}
        {current ? (
          <Image
            src={current.url}
            alt={current.alt ?? title}
            fill
            priority
            className="object-contain p-4"
            sizes="(max-width: 1024px) 100vw, 560px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={48} className="text-slate-300" />
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1} of ${images.length}`}
              aria-current={i === active}
              className={cn(
                "relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border-2 bg-surface transition-colors",
                i === active ? "border-slate-900" : "border-border-base hover:border-slate-300"
              )}
            >
              <Image
                src={img.url}
                alt=""
                fill
                className="object-contain p-1"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
