import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, CheckCircle2, BadgePercent } from "lucide-react";
import { Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-hair-curl.jpg";
import { useLang } from "@/i18n/LanguageProvider";
import { publicApi } from "@/lib/api/public";
import type { TKey } from "@/i18n/translations";

const stats: TKey[] = ["ctaBanner.stat1", "ctaBanner.stat2", "ctaBanner.stat3"];

type FeaturedOffer = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  featured_rank: number | null;
};

export function CtaBanner() {
  const { dir, t } = useLang();
  const [featured, setFeatured] = useState<FeaturedOffer[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const items = await publicApi.getDailyFeaturedOffers({ limit: 100 });
        if (!alive) return;
        const mapped: FeaturedOffer[] = items.map((o: any, i) => ({
          id: o.id,
          title: o.titleAr || o.titleEn || o.title || "",
          description: o.descriptionAr || o.description || null,
          price: Number(o.priceAfter ?? o.price ?? 0),
          original_price: o.priceBefore != null ? Number(o.priceBefore) : (o.originalPrice ?? null),
          image_url: o.image || o.imageUrl || null,
          featured_rank: o.featuredRank ?? i + 1,
        }));
        setFeatured(mapped);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  const discountPct = (o: FeaturedOffer) => {
    if (!o.original_price || o.original_price <= 0 || o.original_price <= o.price) return null;
    return Math.round(((o.original_price - o.price) / o.original_price) * 100);
  };

  return (
    <section className="bg-background pb-24 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[36px] shadow-[0_50px_100px_-30px_rgba(63,42,107,0.55)] ring-1 ring-black/5">
          {/* Background image */}
          <div className="absolute inset-0">
            <img src={heroImg} alt="" className="h-full w-full object-cover" />
            {/* Dark gradient wash */}
            <div className="absolute inset-0 bg-gradient-to-l from-[#2A1A4F]/96 via-[#3F2A6B]/88 to-[#3F2A6B]/55" />
            {/* Soft accent glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(224,37,77,0.4),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_90%,rgba(255,255,255,0.08),transparent_45%)]" />
            {/* Subtle grain via SVG noise */}
            <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")" }} />
          </div>

          {/* Decorative floating chip — bottom only, away from content */}
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
            <div className="absolute right-[8%] bottom-10 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md">
              ⭐ 4.9 / 5 · 12K+ مراجعة
            </div>
          </div>


          {/* Content */}
          <div className="relative grid items-center gap-10 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-[1.55fr_1fr] lg:px-16 lg:py-24">
            <div className="text-start text-white">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur">
                <Sparkles className="h-3 w-3" /> خصومات · Deals platform
              </span>
              <h2 className="mt-6 text-3xl font-extrabold leading-[1.18] sm:text-4xl lg:text-[2.75rem]">
                {t("ctaBanner.title")}
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-8 text-white/85 sm:text-base">
                {t("ctaBanner.desc")}
              </p>

              {/* CTAs + stats */}
              <div className="mt-9 flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to={"/offers" as any}
                    className="group inline-flex h-14 items-center gap-2 rounded-full bg-white px-8 text-sm font-extrabold text-primary shadow-[0_18px_40px_-14px_rgba(0,0,0,0.45)] transition-all hover:-translate-y-0.5 hover:bg-secondary"
                  >
                    {t("ctaBanner.cta")}
                    <ArrowLeft className={`h-4 w-4 transition-transform group-hover:-translate-x-1 ${dir === "ltr" ? "rotate-180" : ""}`} />
                  </Link>
                  <Link
                    to={"/partner" as any}
                    className="inline-flex h-14 items-center gap-2 rounded-full border border-white/40 bg-white/5 px-7 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
                  >
                    كن شريكًا
                  </Link>
                </div>

                <ul className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-white/90 sm:grid-cols-3">
                  {stats.map((k) => (
                    <li key={k} className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
                      <span className="font-semibold">{t(k)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right column: two stacked daily offers picked by admin */}
            <div className="relative hidden lg:block">
              <div className="absolute -inset-4 -z-10 rounded-[32px] bg-gradient-to-br from-white/15 to-transparent blur-xl" />
              <div className="space-y-3">
                {(featured.length > 0 ? featured : [null]).map((o, idx) => {
                  const pct = o ? discountPct(o) : null;
                  return (
                    <div key={o?.id || `placeholder-${idx}`} className="overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-xl">
                      <div className="flex items-stretch gap-3">
                        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-white/10">
                          {o?.image_url ? (
                            <img src={o.image_url} alt={o.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-white/60">عرض اليوم</div>
                          )}
                          {pct && (
                            <span className="absolute left-1.5 top-1.5 rounded-full bg-[#E0254D] px-1.5 py-0.5 text-[10px] font-extrabold text-white">-{pct}%</span>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white">عرض اليوم #{idx + 1}</span>
                          </div>
                          <div className="mt-1.5 line-clamp-2 text-sm font-extrabold leading-snug text-white">
                            {o?.title || "اختر العرض من لوحة التحكم"}
                          </div>
                          <div className="mt-auto flex items-end justify-between pt-2">
                            <div className="flex items-baseline gap-2">
                              {o?.original_price ? (
                                <span className="text-[10px] text-white/60 line-through">{o.original_price} ر.س</span>
                              ) : null}
                              <span className="text-base font-extrabold text-white">
                                {o ? o.price : "—"} <span className="text-[10px] font-bold">ر.س</span>
                              </span>
                            </div>
                            {o ? (
                              <Link
                                to="/offers/$offerId"
                                params={{ offerId: String(o.id) }}
                                className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[11px] font-extrabold text-primary transition hover:bg-secondary"
                              >
                                احجزي الآن <ArrowLeft className={`h-3 w-3 ${dir === "ltr" ? "rotate-180" : ""}`} />
                              </Link>
                            ) : (
                              <Link
                                to={"/offers" as any}
                                className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[11px] font-extrabold text-primary transition hover:bg-secondary"
                              >
                                احجزي الآن <ArrowLeft className={`h-3 w-3 ${dir === "ltr" ? "rotate-180" : ""}`} />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
