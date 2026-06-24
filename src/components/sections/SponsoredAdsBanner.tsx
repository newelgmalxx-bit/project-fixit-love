import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Megaphone, ArrowLeft, CalendarCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useLang } from "@/i18n/LanguageProvider";
import { useSponsoredAdsBundle } from "@/hooks/useSponsoredAds";

type Ad = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  cta_label: string | null;
  offer_id: string | null;
  priceBefore?: number | null;
  priceAfter?: number | null;
};

export function SponsoredAdsBanner() {
  const { dir } = useLang();
  const { ads: rawAds, offers } = useSponsoredAdsBundle();
  const [emblaRef] = useEmblaCarousel(
    { loop: true, direction: dir, align: "start" },
    [Autoplay({ delay: 5000, stopOnInteraction: false })]
  );

  const ads: Ad[] = rawAds.map((a) => {
    const o: any = a.offer_id ? offers[a.offer_id] : null;
    const base: Ad = {
      id: a.id,
      title: a.title,
      subtitle: a.subtitle,
      image_url: a.image_url,
      link_url: a.link_url,
      cta_label: a.cta_label,
      offer_id: a.offer_id,
    };
    if (!o) return base;
    return {
      ...base,
      title: o.titleAr || o.titleEn || o.title || base.title,
      subtitle:
        o.descriptionAr ||
        o.descriptionEn ||
        o.shortDescription ||
        o.description ||
        base.subtitle,
      image_url: o.image || o.imageUrl || base.image_url,
      priceBefore: Number(o.priceBefore ?? 0) || null,
      priceAfter: Number(o.priceAfter ?? 0) || null,
      link_url: null,
    };
  });

  if (ads.length === 0) return null;

  const cls =
    "relative block min-w-0 flex-[0_0_100%] overflow-hidden rounded-2xl border border-border bg-gradient-to-l from-[#3F2A6B] via-[#5b3a8a] to-[#E0254D] shadow-sm transition hover:shadow-md";

  return (
    <section className="bg-background pt-3 sm:pt-5">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
          <div className="flex">
            {ads.map((ad) => {
              const isOffer = !!ad.offer_id;

              const inner = (
                <div className="relative flex items-center gap-3 p-3 sm:gap-5 sm:p-4">
                  {ad.image_url && (
                    <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-white/10 sm:h-20 sm:w-32">
                      <img src={ad.image_url} alt={ad.title} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-white">
                    <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider sm:text-[10px]">
                      <Megaphone className="h-2.5 w-2.5" /> إعلان ممول
                    </div>
                    <h3 className="truncate text-sm font-extrabold sm:text-base">{ad.title}</h3>
                    {ad.subtitle && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-white/85 sm:text-xs">{ad.subtitle}</p>
                    )}
                    {isOffer && ad.priceAfter ? (
                      <div className="mt-1 flex items-center gap-2 text-[11px] sm:text-xs">
                        <span className="font-extrabold text-white">{ad.priceAfter} ر.س</span>
                        {ad.priceBefore && ad.priceBefore > ad.priceAfter && (
                          <span className="text-white/60 line-through">{ad.priceBefore} ر.س</span>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {isOffer ? (
                    <Link
                      to="/offers/$offerId"
                      params={{ offerId: ad.offer_id! }}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-primary shadow hover:bg-white/90 sm:px-3 sm:text-xs"
                    >
                      <CalendarCheck className="h-3.5 w-3.5" />
                      احجز الآن
                    </Link>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-primary sm:px-3 sm:text-xs">
                      {ad.cta_label || "اعرف أكثر"}
                      <ArrowLeft className={`h-3 w-3 ${dir === "ltr" ? "rotate-180" : ""}`} />
                    </span>
                  )}
                </div>
              );

              if (isOffer) {
                return (
                  <Link key={ad.id} to="/offers/$offerId" params={{ offerId: ad.offer_id! }} className={cls}>
                    {inner}
                  </Link>
                );
              }
              if (ad.link_url) {
                return (
                  <a key={ad.id} href={ad.link_url} target="_blank" rel="noreferrer" className={cls}>
                    {inner}
                  </a>
                );
              }
              return (
                <div key={ad.id} className={cls}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
