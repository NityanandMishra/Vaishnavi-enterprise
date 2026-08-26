"use client";

import React, { useState, useTransition } from "react";
import {
  Star,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  X,
  Loader2,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { submitProductReview } from "@/app/(store)/actions";

export interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  isVerifiedPurchase: boolean;
  createdAt: Date | string;
  user: {
    name: string | null;
  };
}

export default function ProductReviews({
  productId,
  productTitle,
  reviews,
  isLoggedIn = false,
}: {
  productId: string;
  productTitle: string;
  reviews: ReviewItem[];
  isLoggedIn?: boolean;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successSubmitted, setSuccessSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Ratings calculation
  const totalReviews = reviews.length;
  const avgRating =
    totalReviews > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
      : "5.0";

  // Count per star
  const starCounts = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
    return { star, count, pct };
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("rating", selectedRating.toString());
    formData.set("title", reviewTitle);
    formData.set("comment", reviewComment);

    startTransition(async () => {
      const res = await submitProductReview(null, formData);
      if (res.ok) {
        setSuccessSubmitted(true);
        setTimeout(() => {
          setIsModalOpen(false);
          setSuccessSubmitted(false);
          setReviewTitle("");
          setReviewComment("");
        }, 1500);
      } else {
        setFormError(res.error || "Failed to submit review.");
      }
    });
  }

  return (
    <div className="bg-surface border border-border-base rounded-lg p-6 lg:p-8 mt-8 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap border-b border-border-base pb-6 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Customer Reviews & Ratings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified ratings and feedback from customers across India
          </p>
        </div>

        {isLoggedIn ? (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <MessageSquare size={15} />
            <span>Write a Review</span>
          </button>
        ) : (
          <a
            href={`/auth/login?callbackUrl=/products/${productId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <span>Sign In to Review</span>
          </a>
        )}
      </div>

      {/* Ratings Overview Bar */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-8 items-center border-b border-border-base pb-8 mb-8">
        <div className="text-center md:text-left">
          <div className="text-5xl font-black text-slate-900 tracking-tight flex items-baseline justify-center md:justify-start gap-1">
            <span>{avgRating}</span>
            <span className="text-xl font-bold text-slate-400">/ 5</span>
          </div>
          <div className="flex items-center justify-center md:justify-start gap-1 my-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={18}
                className={cn(
                  i < Math.round(Number(avgRating))
                    ? "fill-amber-400 text-amber-400"
                    : "fill-slate-100 text-slate-300"
                )}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Based on {totalReviews} {totalReviews === 1 ? "customer review" : "customer reviews"}
          </p>
        </div>

        {/* Star Rating Breakdown Bars */}
        <div className="space-y-2">
          {starCounts.map(({ star, count, pct }) => (
            <div key={star} className="flex items-center gap-3 text-xs">
              <span className="w-8 font-semibold text-slate-600 font-mono text-right">
                {star} ★
              </span>
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-12 text-slate-400 font-mono text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm font-semibold text-slate-900">No reviews yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Be the first customer to share your experience with this product!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-base">
          {reviews.map((review) => {
            const author = review.user?.name || "Customer";
            const dateStr = new Date(review.createdAt).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div key={review.id} className="py-6 first:pt-0 last:pb-0 space-y-2">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={cn(
                            i < review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "fill-slate-100 text-slate-300"
                          )}
                        />
                      ))}
                    </div>

                    <span className="text-xs font-bold text-slate-900">{author}</span>

                    {review.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        <CheckCircle2 size={11} /> Verified Buyer
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">{dateStr}</span>
                </div>

                {review.title && (
                  <h4 className="text-sm font-bold text-slate-900">{review.title}</h4>
                )}

                <p className="text-xs text-slate-600 leading-relaxed">{review.comment}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Write a Review Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="relative w-full max-w-lg bg-surface rounded-lg shadow-xl border border-border-base overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-border-base">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Write a Review</h3>
                <p className="text-[11px] text-slate-500 truncate max-w-sm">
                  {productTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            {successSubmitted ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 size={36} className="text-emerald-600 mx-auto" />
                <h4 className="text-base font-bold text-slate-900">Review Submitted!</h4>
                <p className="text-xs text-slate-600">
                  Thank you for rating this product. Your review is now live.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Interactive Star Picker */}
                <div>
                  <label className="block font-semibold text-slate-800 mb-1.5">
                    Your Overall Rating <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const starValue = i + 1;
                      const isFilled =
                        hoverRating !== null ? starValue <= hoverRating : starValue <= selectedRating;

                      return (
                        <button
                          key={i}
                          type="button"
                          onMouseEnter={() => setHoverRating(starValue)}
                          onMouseLeave={() => setHoverRating(null)}
                          onClick={() => setSelectedRating(starValue)}
                          aria-label={`Rate ${starValue} stars`}
                          className="p-1 focus:outline-none transition-transform hover:scale-110"
                        >
                          <Star
                            size={26}
                            className={cn(
                              isFilled
                                ? "fill-amber-400 text-amber-400"
                                : "fill-slate-100 text-slate-300"
                            )}
                          />
                        </button>
                      );
                    })}
                    <span className="font-bold text-slate-900 font-mono text-sm ml-2">
                      {hoverRating || selectedRating} / 5 Stars
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Review Headline (Optional)
                  </label>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="e.g. Excellent build quality, highly recommended!"
                    className="w-full h-9 px-3 rounded border border-border-base text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Detailed Review <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Describe how the product performs, ease of installation, power savings, etc."
                    className="w-full p-3 rounded border border-border-base text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange-600 resize-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-base">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="h-9 px-4 rounded border border-border-base text-slate-700 hover:bg-slate-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !reviewComment.trim()}
                    className="h-9 px-5 rounded bg-brand-orange-600 hover:bg-brand-orange-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isPending && <Loader2 size={13} className="animate-spin" />}
                    <span>Submit Review</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
