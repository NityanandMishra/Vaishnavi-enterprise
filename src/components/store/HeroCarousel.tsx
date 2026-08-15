"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Car,
  Sun,
  Fan,
  BatteryCharging,
  Cable,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HERO_SLIDES, type HeroSlide } from "@/lib/hero-slides";

/** Standard editorial-carousel dwell. Long enough to read the blurb. */
const SLIDE_MS = 6000;

const ICONS: Record<HeroSlide["icon"], LucideIcon> = {
  car: Car,
  sun: Sun,
  fan: Fan,
  battery: BatteryCharging,
  cable: Cable,
};

/** Fine dot grid, inlined so the backdrop needs no network request. */
const DOT_GRID =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ccircle cx='1.5' cy='1.5' r='1.5' fill='%23ffffff' fill-opacity='0.07'/%3E%3C/svg%3E\")";

export default function HeroCarousel() {
  const slides = HERO_SLIDES;
  const count = slides.length;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count]
  );

  // Auto-advance. Deliberately NOT paused by hovering the section as a whole —
  // the hero sits under the visitor's cursor by default, so a section-wide
  // hover trap left the carousel permanently frozen on slide one.
  useEffect(() => {
    if (paused || reducedMotion || count < 2) return;
    const t = window.setTimeout(() => go(index + 1), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, reducedMotion, count, go]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /** Spread onto interactive elements only: arrows, tabs, and the slide CTA. */
  const holdProps = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
    touchStartX.current = null;
  }

  const autoplaying = !paused && !reducedMotion && count > 1;

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured categories"
      tabIndex={0}
      onKeyDown={onKeyDown}
      // Focus anywhere inside holds the carousel, so keyboard users are never
      // moved off the control they are on.
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative bg-surface-inverse overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange-500 focus-visible:ring-inset"
    >
      <div className="relative min-h-[460px] sm:min-h-[500px] lg:min-h-[580px]">
        {slides.map((slide, i) => {
          const Icon = ICONS[slide.icon];
          const active = i === index;
          const showPhoto = slide.image && !failedImages[slide.key];

          return (
            <div
              key={slide.key}
              aria-hidden={!active}
              className={cn(
                "absolute inset-0 transition-opacity duration-[900ms] ease-out",
                active ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              {/* Layer 1 — photograph, when one has been supplied */}
              {showPhoto && (
                <div className="absolute inset-0 overflow-hidden">
                  <div
                    key={`${slide.key}-${index}`}
                    className={cn("absolute inset-0", active && !reducedMotion && "hero-kenburns")}
                    style={{ ["--hero-duration" as string]: `${SLIDE_MS + 1400}ms` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.image!}
                      alt=""
                      onError={() =>
                        setFailedImages((f) => ({ ...f, [slide.key]: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Layer 2 — base wash. Carries the slide on its own when there
                  is no photograph, and deepens the scrim when there is. */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(ellipse 80% 70% at 78% 18%, ${slide.accent.from}, transparent 62%), radial-gradient(ellipse 70% 80% at 8% 92%, ${slide.accent.to}, transparent 60%), linear-gradient(120deg, rgba(11,17,32,0.92) 0%, rgba(11,17,32,0.62) 45%, rgba(11,17,32,0.88) 100%)`,
                }}
              />

              {/* Layer 3 — dot grid, for texture at large sizes */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ backgroundImage: DOT_GRID, backgroundSize: "32px 32px" }}
              />

              {/* Layer 4 — diagonal light sweep */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(104deg, transparent 38%, rgba(255,255,255,0.055) 50%, transparent 62%)",
                }}
              />

              {/* Layer 5 — ghosted category glyph, the subject when photoless */}
              {!showPhoto && (
                <Icon
                  aria-hidden
                  strokeWidth={0.75}
                  className="absolute right-[-4rem] lg:right-[-2rem] top-1/2 -translate-y-1/2 w-[300px] h-[300px] lg:w-[460px] lg:h-[460px] text-white/[0.06]"
                />
              )}

              {/* Layer 6 — vignette, to seat the type */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse 120% 90% at 50% 50%, transparent 45%, rgba(3,7,18,0.55) 100%)",
                }}
              />

              <div className="relative h-full max-w-content mx-auto px-4 sm:px-12 lg:px-20 flex items-center py-16 lg:py-24">
                <div className={cn("max-w-2xl", active && "hero-rise")}>
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] mb-5",
                      slide.accent.chip
                    )}
                  >
                    <Icon size={15} />
                    {slide.eyebrow}
                  </span>

                  <h1 className="text-[28px] leading-[1.12] sm:text-4xl lg:text-[54px] lg:leading-[1.06] font-bold text-white mb-5 [text-wrap:balance]">
                    {slide.title}
                  </h1>

                  <p className="text-base lg:text-lg text-slate-300/90 mb-8 max-w-lg leading-relaxed">
                    {slide.description}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href={slide.href}
                      tabIndex={active ? 0 : -1}
                      {...holdProps}
                      className="inline-flex items-center justify-center gap-2 min-h-[52px] px-8 rounded-md bg-brand-orange-600 text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-black/20 hover:bg-brand-orange-500 transition-colors"
                    >
                      {slide.ctaLabel} <ArrowRight size={18} />
                    </Link>
                    <Link
                      href="/categories"
                      tabIndex={active ? 0 : -1}
                      {...holdProps}
                      className="inline-flex items-center justify-center min-h-[52px] px-8 rounded-md bg-white/10 border border-white/20 text-white font-bold text-sm uppercase tracking-wide backdrop-blur-sm hover:bg-white/20 transition-colors"
                    >
                      All Categories
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Edge arrows, vertically centred over the slide */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              {...holdProps}
              aria-label="Previous slide"
              className="absolute left-2 lg:left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 lg:w-12 lg:h-12 rounded-full flex items-center justify-center bg-black/25 border border-white/15 text-white/80 backdrop-blur-sm hover:bg-black/45 hover:text-white transition-colors"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              {...holdProps}
              aria-label="Next slide"
              className="absolute right-2 lg:right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 lg:w-12 lg:h-12 rounded-full flex items-center justify-center bg-black/25 border border-white/15 text-white/80 backdrop-blur-sm hover:bg-black/45 hover:text-white transition-colors"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        Slide {index + 1} of {count}: {slides[index].title}
      </p>

      {count > 1 && (
        <div className="relative z-10 border-t border-white/10 bg-black/30 backdrop-blur-sm">
          <div className="max-w-content mx-auto px-4 lg:px-8 flex items-stretch gap-1 overflow-x-auto no-scrollbar">
            {slides.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                onClick={() => go(i)}
                {...holdProps}
                aria-label={`Show ${slide.eyebrow}`}
                aria-current={i === index}
                className={cn(
                  "group relative flex-shrink-0 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition-colors",
                  i === index ? "text-white" : "text-slate-400 hover:text-slate-200"
                )}
              >
                {slide.eyebrow}
                <span
                  aria-hidden
                  className="absolute left-0 right-0 bottom-0 h-[2px] overflow-hidden bg-white/10"
                >
                  {i === index && (
                    <span
                      key={`bar-${index}-${paused}-${reducedMotion}`}
                      className="block h-full bg-brand-orange-500"
                      style={{
                        animation: autoplaying
                          ? `heroProgress ${SLIDE_MS}ms linear forwards`
                          : undefined,
                        width: autoplaying ? undefined : "100%",
                      }}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
