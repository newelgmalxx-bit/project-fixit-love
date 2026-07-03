import { useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useHomeData } from "@/hooks/useHomeData";
import { useCategories } from "@/hooks/useCatalog";
import { normalizeOffer } from "@/lib/api/catalog";
import { OfferCard } from "./OfferCard";
import { useLang } from "@/i18n/LanguageProvider";
import type { Offer } from "@/data/offers";

type Props = {
  sliderKey: "slider_1" | "slider_2";
  titleAr: string;
  titleEn: string;
  kickerAr?: string;
  kickerEn?: string;
  tone?: "rose" | "indigo";
};

/**
 * Home-page offer slider. Pulls its data from the batched /home-data
 * response (homeSlider1 / homeSlider2). Renders as a swipeable carousel:
 *   mobile   → 1.5 cards visible (so the user knows to swipe)
 *   sm       → 2 cards
 *   md       → 3 cards
 *   lg+      → 4 cards
 * Returns null when the slider has no active offers, so the section
 * disappears cleanly for stores that don't use it yet.
 */
export function HomeOfferSlider({ sliderKey, titleAr, titleEn, kickerAr, kickerEn, tone = "rose" }: Props) {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { data } = useHomeData();
  const { categoryIdToSlug } = useCategories();

  const raw: any[] = (data as any)?.[sliderKey === "slider_1" ? "homeSlider1" : "homeSlider2"] ?? [];
  const offers = useMemo<Offer[]>(() => {
    return raw
      .map((r) => {
        // Server may nest partner fields at the row root; merge into a partner-ish shape.
        const partner = r?.partnerNameAr || r?.partnerNameEn || r?.partnerCity || r?.partnerLogo
          ? {
              id: r.partnerId ?? r.partner_id ?? "",
              vendorNameAr: r.partnerNameAr,
              vendorNameEn: r.partnerNameEn,
              city: r.partnerCity,
              logo: r.partnerLogo,
            }
          : undefined;
        return normalizeOffer(r, categoryIdToSlug, partner as any);
      });
  }, [raw, categoryIdToSlug]);

  const [emblaRef, embla] = useEmblaCarousel({
    align: "start",
    direction: dir === "rtl" ? "rtl" : "ltr",
    loop: false,
    containScroll: "trimSnaps",
    dragFree: false,
  });

  if (offers.length === 0) return null;

  const toneStyles = tone === "indigo"
    ? "text-indigo-500"
    : "text-rose-500";

  return (
    <section className="bg-background py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            {(kickerAr || kickerEn) && (
              <span className={`text-xs font-bold uppercase tracking-[0.2em] ${toneStyles}`}>
                {L(kickerAr || "", kickerEn || "")}
              </span>
            )}
            <h2 className="mt-1 text-2xl font-extrabold text-foreground sm:text-3xl">
              {L(titleAr, titleEn)}
            </h2>
            {/* Swipe hint for mobile — a partial second card already hints, but a label helps. */}
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground sm:hidden">
              {L("اسحب لعرض المزيد ←", "Swipe for more →")}
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => embla?.scrollPrev()}
              aria-label={L("السابق", "Previous")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-sm transition hover:border-primary hover:text-primary"
            >
              {dir === "rtl" ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => embla?.scrollNext()}
              aria-label={L("التالي", "Next")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-sm transition hover:border-primary hover:text-primary"
            >
              {dir === "rtl" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="overflow-hidden" ref={emblaRef}>
          <div className="-ml-4 flex">
            {offers.map((o) => (
              <div
                key={o.id}
                className="min-w-0 shrink-0 grow-0 basis-[70%] pl-4 sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
              >
                <OfferCard offer={o} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Named export kept generic; tiny wrappers for the two well-known keys.
export function HomeOfferSlider1() {
  return (
    <HomeOfferSlider
      sliderKey="slider_1"
      titleAr="عروض مختارة لك 🔥"
      titleEn="Picked for you 🔥"
      kickerAr="الأكثر خصماً"
      kickerEn="Biggest discounts"
      tone="rose"
    />
  );
}

export function HomeOfferSlider2() {
  return (
    <HomeOfferSlider
      sliderKey="slider_2"
      titleAr="عروض ما تفوتك ✨"
      titleEn="Don't miss these ✨"
      kickerAr="اختيارنا لك"
      kickerEn="Our picks"
      tone="indigo"
    />
  );
}

// Convenience: render both, and fall back to nothing when the backend
// hasn't shipped the endpoint yet (caller can keep FeaturedOffers as a
// separate fallback).
export function HomeOfferSliders() {
  return (
    <>
      <HomeOfferSlider1 />
      <HomeOfferSlider2 />
    </>
  );
}

// Small helper hook so the home page can decide whether to hide the
// legacy FeaturedOffers grid when at least one slider has content.
export function useHasHomeSliders() {
  const { data } = useHomeData();
  const s1: any[] = (data as any)?.homeSlider1 ?? [];
  const s2: any[] = (data as any)?.homeSlider2 ?? [];
  return s1.length > 0 || s2.length > 0;
}

// Fallback arrow icons kept for tree-shaking friendliness.
export { ArrowLeft, ArrowRight };
