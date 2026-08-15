"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ImageOff, ChevronLeft, ChevronRight } from "lucide-react";
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
  const touchStartX = useRef<number | null>(null);
  const current = images[active];
  const many = images.length > 1;

  const go = useCallback(
    (next: number) => setActive(((next % images.length) + images.length) % images.length),
    [images.length]
  );

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || !many) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 45) go(active + (dx < 0 ? 1 : -1));
    touchStartX.current = null;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!many) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(active - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(active + 1);
    }
  }

  return (
    <div>
      {/*
        4:3 rather than 1:1. Catalogue photography here is 3:2 landscape, and
        contained inside a square well that left 130px of dead space above and
        below — 36% of the gallery height. 4:3 cuts that to roughly a tenth of
        it while still letting a square studio shot fill the frame vertically,
        so it holds up whichever way a supplier crops their images.
      */}
      <div
        role={many ? "group" : undefined}
        aria-roledescription={many ? "carousel" : undefined}
        aria-label={many ? `${title} images` : undefined}
        tabIndex={many ? 0 : -1}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative w-full aspect-[4/3] bg-surface border border-border-base rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-inset"
      >
        {badge && <StockBadge state={badge} className="absolute top-3 left-3 z-10 shadow-sm" />}

        {current ? (
          <Image
            src={current.url}
            alt={current.alt ?? title}
            fill
            priority
            className="object-contain p-3"
            sizes="(max-width: 1024px) 100vw, 560px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={48} className="text-slate-300" />
          </div>
        )}

        {many && (
          <>
            <button
              type="button"
              onClick={() => go(active - 1)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-white/85 border border-border-base text-slate-700 shadow-sm backdrop-blur-sm hover:bg-white hover:text-slate-900 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-white/85 border border-border-base text-slate-700 shadow-sm backdrop-blur-sm hover:bg-white hover:text-slate-900 transition-colors"
            >
              <ChevronRight size={20} />
            </button>

            <span className="absolute bottom-3 right-3 z-10 text-[11px] font-semibold text-slate-700 bg-white/85 border border-border-base rounded-full px-2.5 py-1 backdrop-blur-sm">
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {many && (
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
              <Image src={img.url} alt="" fill className="object-contain p-1" sizes="80px" />
            </button>
          ))}
        </div>
      )}

      {many && (
        <p className="sr-only" aria-live="polite">
          Image {active + 1} of {images.length}
        </p>
      )}
    </div>
  );
}
