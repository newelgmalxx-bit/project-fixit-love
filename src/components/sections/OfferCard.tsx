import { Link } from "@tanstack/react-router";
import { MapPin, Star, Clock, Heart, ArrowLeft, ArrowRight, BadgeCheck } from "lucide-react";
import type { Offer } from "@/data/offers";
import { useCategories, usePartner } from "@/hooks/useCatalog";
import { SarIcon } from "@/components/ui/SarIcon";
import { useFavorite } from "@/hooks/useFavorite";
import { useQuery } from "@tanstack/react-query";
import { reviews as reviewsApi } from "@/lib/api/services";
import { useLang } from "@/i18n/LanguageProvider";

export function OfferCard({ offer }: { offer: Offer }) {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { fav: saved, toggle } = useFavorite(String(offer.id));
  const savings = offer.priceBefore - offer.priceAfter;
  const { categories } = useCategories();
  const cat: any = categories.find((c) => c.slug === offer.category);

  // Offer list endpoint doesn't include partner info — fetch it when missing.
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
  const categoryName = cat ? (lang === "en" ? (cat.nameEn || cat.nameAr) : (cat.nameAr || cat.nameEn)) : "";
  const currency = L("ر.س", "SAR");

  return (
    <Link
      to="/offers/$offerId"
      params={{ offerId: offer.id }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/15"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={offer.image}
          alt={offerTitle}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />

        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-2.5 py-1 text-xs font-black text-white shadow-lg ring-1 ring-white/20">
              -{offer.discountPercent}%
            </span>
            {savings > 0 && (
              <span className="inline-flex items-center gap-1 self-start rounded-lg bg-white/95 px-2 py-0.5 text-[10px] font-extrabold text-[#E0254D] shadow backdrop-blur" dir={dir}>
                {L(`توفير ${savings} ر.س`, `Save ${savings} SAR`)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle();
            }}
            aria-label={L("حفظ العرض", "Save offer")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md backdrop-blur transition hover:scale-110 hover:text-[#E0254D]"
          >
            <Heart className={`h-4 w-4 transition ${saved ? "fill-[#E0254D] text-[#E0254D]" : ""}`} />
          </button>
        </div>

        {cat && (
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-foreground shadow backdrop-blur">
              <span className="text-sm leading-none">{cat.icon}</span>
              <span className="truncate max-w-[140px]">{categoryName}</span>
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-extrabold leading-snug text-foreground transition-colors group-hover:text-primary">
          {offerTitle}
        </h3>

        {vendorName && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="truncate font-semibold text-foreground/80">{vendorName}</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-extrabold">{vendorRating > 0 ? vendorRating : "0.0"}</span>
            <span className="text-amber-600/70">({vendorReviews})</span>
          </div>
          {vendorCity && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span className="font-semibold">{vendorCity}</span>
            </div>
          )}
          {offer.durationMinutes > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-semibold">{offer.durationMinutes} {L("د", "min")}</span>
            </div>
          )}
        </div>

        <div className="my-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{L("السعر بعد الخصم", "Price after discount")}</span>
            <div className="flex items-baseline gap-1.5" dir="ltr">
              <span className="text-2xl font-black bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] bg-clip-text text-transparent">
                {offer.priceAfter}
              </span>
              {lang === "en" ? (
                <span className="text-xs font-bold text-[#E0254D]">{currency}</span>
              ) : (
                <SarIcon className="h-[0.8em] text-[#E0254D]" />
              )}
              <span className="text-xs text-slate-400 line-through">{offer.priceBefore}</span>
            </div>
            <span className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{L("شامل الضريبة", "VAT included")}</span>
          </div>

          <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground px-5 py-3 text-sm font-extrabold text-background transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-[#3F2A6B] group-hover:to-[#E0254D]">
            {L("احجز الآن", "Book now")}
            {dir === "rtl"
              ? <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
              : <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
          </span>
        </div>
      </div>
    </Link>
  );
}
