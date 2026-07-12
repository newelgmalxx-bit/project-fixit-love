import { Link } from "@tanstack/react-router";
import { MapPin, Star, Heart, Store } from "lucide-react";
import type { Offer } from "@/data/offers";
import { useFavorite } from "@/hooks/useFavorite";
import { useLang } from "@/i18n/LanguageProvider";
import { SarIcon } from "@/components/ui/SarIcon";

export function OfferCard({ offer }: { offer: Offer }) {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { fav: saved, toggle } = useFavorite(String(offer.id));

  // Backend now embeds vendor mini fields on every offer response
  // (vendorName/vendorAddress/rating/reviewsCount + displayAddress/branch/hasMultipleBranches).
  // We rely only on those — no per-card GET /partners/:id or GET /reviews calls.
  const vendorName = offer.vendor?.name || "";
  const displayAddress =
    (offer as any).displayAddress ||
    offer.vendor?.address ||
    offer.vendor?.city ||
    "";
  const hasMultipleBranches = Boolean((offer as any).hasMultipleBranches);
  const branchesCount = Number((offer as any).branchesCount || 0);
  const vendorRating = Number(offer.vendor?.rating || 0);
  const vendorReviews = Number(offer.vendor?.reviewsCount || 0);

  const offerTitle = lang === "en" ? ((offer as any).titleEn || offer.title) : (offer.title || (offer as any).titleEn || "");
  const currency = L("ر.س", "SAR");

  return (
    <Link
      to="/offers/$offerId"
      params={{ offerId: offer.id }}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/15"
    >
      {/* Image */}
      <div className="relative aspect-[16/11] overflow-hidden bg-muted">
        <img
          src={offer.image}
          alt={offerTitle}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }}
            aria-label={L("حفظ العرض", "Save offer")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md backdrop-blur transition hover:scale-110 hover:text-[#E0254D]"
          >
            <Heart className={`h-4 w-4 transition ${saved ? "fill-[#E0254D] text-[#E0254D]" : ""}`} />
          </button>

          <span className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#E0254D] shadow" dir={dir}>
            {L(`توفير ${Math.max(0, offer.priceBefore - offer.priceAfter)} ر.س`, `Save ${Math.max(0, offer.priceBefore - offer.priceAfter)} SAR`)}
          </span>

        </div>
      </div>

      {/* Price + discount strip */}
      <div className="flex items-start justify-between gap-2 px-5 pt-4">
        <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-3 py-1 text-[11px] font-extrabold text-white shadow">
          -{offer.discountPercent}%
        </span>
        <div className="flex flex-col items-end">
          <div className="flex items-baseline gap-1.5" dir="ltr">
            <span className="text-[13px] font-semibold text-slate-400 line-through">
              {offer.priceBefore}
            </span>
            <span className="text-xl font-black bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] bg-clip-text text-transparent">
              {offer.priceAfter}
            </span>
            {lang === "en" ? (
              <span className="text-xs font-bold text-[#E0254D]">{currency}</span>
            ) : (
              <SarIcon className="h-[0.8em] text-[#E0254D]" />
            )}
          </div>
          <span className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            {L("شامل الضريبة", "VAT included")}
          </span>
        </div>
      </div>

      <div className="mx-5 my-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Body */}
      <div className="flex flex-1 flex-col px-5 pb-5">
        <h3 className="line-clamp-2 text-base font-extrabold leading-snug text-foreground transition-colors group-hover:text-primary">
          {offerTitle}
        </h3>

        {vendorName && (
          <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-foreground/85" dir={dir}>
            <Store className="h-4 w-4 shrink-0 text-[#3F2A6B]" />
            <span className="truncate">{vendorName}</span>
          </div>
        )}

        {displayAddress && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" dir={dir}>
            <MapPin className="h-4 w-4 text-[#E0254D]" />
            <span className="font-semibold">{displayAddress}</span>
            {hasMultipleBranches && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                {branchesCount > 1
                  ? L(`+ ${branchesCount - 1} فروع أخرى`, `+ ${branchesCount - 1} more branches`)
                  : L("متاح في عدة فروع", "Multiple branches")}
              </span>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center gap-1 text-xs" dir={dir}>
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-extrabold text-foreground">{vendorRating > 0 ? vendorRating.toFixed(1) : "0.0"}</span>
          <span className="text-muted-foreground">({vendorReviews} {L("تعليق", "reviews")})</span>
        </div>


        <span
          className="mt-auto block w-full rounded-2xl bg-foreground px-5 py-3.5 text-center text-sm font-extrabold text-background transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-[#3F2A6B] group-hover:to-[#E0254D]"
        >
          {L("احجز الآن", "Book now")}
        </span>
      </div>
    </Link>
  );
}
