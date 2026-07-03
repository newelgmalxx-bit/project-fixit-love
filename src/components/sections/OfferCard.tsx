import { Link } from "@tanstack/react-router";
import { MapPin, Star, Heart } from "lucide-react";
import type { Offer } from "@/data/offers";
import { usePartner } from "@/hooks/useCatalog";
import { useFavorite } from "@/hooks/useFavorite";
import { useQuery } from "@tanstack/react-query";
import { reviews as reviewsApi } from "@/lib/api/services";
import { useLang } from "@/i18n/LanguageProvider";

// Derive a short numeric offer number from any id (UUIDs or ints).
function shortOfferNumber(id: string): string {
  const digits = String(id).replace(/\D/g, "");
  if (digits.length >= 5) return digits.slice(-5);
  // fall back to a stable 5-digit hash of the raw id
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String(10000 + (h % 90000));
}

export function OfferCard({ offer }: { offer: Offer }) {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { fav: saved, toggle } = useFavorite(String(offer.id));

  const needsPartner = !offer.vendor?.name && Boolean(offer.vendor?.id) && offer.vendor.id !== "—";
  const { data: partner } = usePartner(needsPartner ? offer.vendor.id : undefined);
  const vendorName = offer.vendor?.name
    || (lang === "en" ? ((partner as any)?.vendorNameEn || (partner as any)?.vendorNameAr) : ((partner as any)?.vendorNameAr || (partner as any)?.vendorNameEn))
    || "";
  const vendorCity = offer.vendor?.city || (partner as any)?.city || (partner as any)?.addressAr || (partner as any)?.address || "";
  const baseRating = offer.vendor?.rating || Number((partner as any)?.rating || 0);
  const baseReviews = offer.vendor?.reviewsCount || Number((partner as any)?.reviewsCount || 0);

  const { data: reviewStats } = useQuery({
    queryKey: ["offer-reviews", String(offer.id)],
    queryFn: async () => {
      const res: any = await reviewsApi.list({ offerId: String(offer.id), limit: 1 });
      const data = res?.data ?? res;
      const total = Number(data?.total ?? (Array.isArray(data?.items) ? data.items.length : 0)) || 0;
      const avg = Number(data?.average ?? 0) || 0;
      return { total, average: Math.round(avg * 10) / 10 };
    },
    enabled: Boolean(offer.id) && baseReviews === 0,
    staleTime: 60_000,
  });
  const liveStats =
    reviewStats && reviewStats.total > 0
      ? { avg: reviewStats.average, count: reviewStats.total }
      : null;
  const vendorRating = liveStats?.avg ?? baseRating;
  const vendorReviews = liveStats?.count ?? baseReviews;

  const offerTitle = lang === "en" ? ((offer as any).titleEn || offer.title) : (offer.title || (offer as any).titleEn || "");
  const currency = L("ريال", "SAR");
  const offerNo = shortOfferNumber(String(offer.id));

  return (
    <Link
      to="/offers/$offerId"
      params={{ offerId: offer.id }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[#6D5BFF]/20"
    >
      {/* Image with purple gradient overlay */}
      <div className="relative aspect-[16/11] overflow-hidden bg-muted">
        <img
          src={offer.image}
          alt={offerTitle}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Signature purple tint — matches reference */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#6D5BFF]/0 via-[#6D5BFF]/15 to-[#6D5BFF]/55" />

        {/* Offer number pill (top-right in RTL, top-left in LTR) */}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }}
            aria-label={L("حفظ العرض", "Save offer")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md backdrop-blur transition hover:scale-110 hover:text-[#6D5BFF]"
          >
            <Heart className={`h-4 w-4 transition ${saved ? "fill-[#6D5BFF] text-[#6D5BFF]" : ""}`} />
          </button>

          <span className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-foreground shadow" dir="ltr">
            {L(`رقم العرض:${offerNo}`, `Offer #${offerNo}`)}
          </span>
        </div>
      </div>

      {/* Price + discount strip below image */}
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <span className="inline-flex items-center rounded-full bg-[#F2E9FF] px-3 py-1 text-[11px] font-extrabold text-[#6D5BFF]">
          -{offer.discountPercent}%
        </span>
        <div className="flex items-baseline gap-1.5 text-[#6D5BFF]" dir="rtl">
          <span className="text-[13px] font-semibold text-slate-400 line-through">
            {offer.priceBefore} {currency}
          </span>
          <span className="text-xl font-black">
            {offer.priceAfter} {currency}
          </span>
        </div>
      </div>

      <div className="mx-5 my-3 h-px bg-border" />

      {/* Body */}
      <div className="flex flex-1 flex-col px-5 pb-5">
        <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-extrabold leading-snug text-foreground">
          {offerTitle}
        </h3>

        {vendorName && (
          <p className="mt-2 text-sm font-bold text-foreground/85">{vendorName}</p>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs" dir={dir}>
          {vendorCity && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4 text-[#6D5BFF]" />
              <span className="font-semibold">{vendorCity}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-extrabold text-foreground">{vendorRating > 0 ? vendorRating.toFixed(1) : "0.0"}</span>
            <span className="text-muted-foreground">({vendorReviews} {L("تعليق", "reviews")})</span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => { e.preventDefault(); }}
          className="mt-5 w-full rounded-2xl bg-[#6D5BFF] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(109,91,255,0.7)] transition hover:bg-[#5A48F0]"
        >
          {L("احجز الآن", "Book now")}
        </button>
      </div>
    </Link>
  );
}
