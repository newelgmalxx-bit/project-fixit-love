import { Link } from "@tanstack/react-router";
import { MapPin, Star, Heart } from "lucide-react";
import type { Offer } from "@/data/offers";
import { usePartner } from "@/hooks/useCatalog";
import { useFavorite } from "@/hooks/useFavorite";
import { useQuery } from "@tanstack/react-query";
import { reviews as reviewsApi } from "@/lib/api/services";
import { publicApi } from "@/lib/api/public";
import { useLang } from "@/i18n/LanguageProvider";
import { SarIcon } from "@/components/ui/SarIcon";

export function OfferCard({ offer }: { offer: Offer }) {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { fav: saved, toggle } = useFavorite(String(offer.id));

  const hasVendorId = Boolean(offer.vendor?.id) && offer.vendor.id !== "—";
  const cityMissing = !offer.vendor?.city;

  // The slider endpoint returns partnerName* but no partnerId/partnerCity.
  // When city is missing and we don't have a partnerId, fetch full offer details to get them.
  const needsOfferDetail = cityMissing && !hasVendorId && Boolean(offer.id);
  const { data: offerDetail } = useQuery({
    queryKey: ["offer-detail-for-card", String(offer.id)],
    queryFn: () => publicApi.getOffer(String(offer.id)),
    enabled: needsOfferDetail,
    staleTime: 5 * 60 * 1000,
  });
  const detailPartnerId = (offerDetail as any)?.partnerId as string | undefined;

  const partnerIdToFetch = hasVendorId ? offer.vendor.id : detailPartnerId;
  const needsPartner = cityMissing && Boolean(partnerIdToFetch);
  const { data: partner } = usePartner(needsPartner ? partnerIdToFetch : undefined);

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
  const currency = L("ر.س", "SAR");
  

  return (
    <Link
      to="/offers/$offerId"
      params={{ offerId: offer.id }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/15"
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
        <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-extrabold leading-snug text-foreground transition-colors group-hover:text-primary">
          {offerTitle}
        </h3>

        {vendorName && (
          <p className="mt-2 text-sm font-bold text-foreground/85">{vendorName}</p>
        )}

        {vendorCity && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground" dir={dir}>
            <MapPin className="h-4 w-4 text-[#E0254D]" />
            <span className="font-semibold">{vendorCity}</span>
          </div>
        )}

        <div className="mt-2 flex items-center gap-1 text-xs" dir={dir}>
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-extrabold text-foreground">{vendorRating > 0 ? vendorRating.toFixed(1) : "0.0"}</span>
          <span className="text-muted-foreground">({vendorReviews} {L("تعليق", "reviews")})</span>
        </div>


        <button
          type="button"
          onClick={(e) => { e.preventDefault(); }}
          className="mt-5 w-full rounded-2xl bg-foreground px-5 py-3.5 text-sm font-extrabold text-background transition-all duration-300 hover:bg-gradient-to-r hover:from-[#3F2A6B] hover:to-[#E0254D]"
        >
          {L("احجز الآن", "Book now")}
        </button>
      </div>
    </Link>
  );
}
