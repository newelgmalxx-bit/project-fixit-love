import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapPin, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { OfferCard } from "@/components/sections/OfferCard";
import { type CategorySlug } from "@/data/offers";
import { useOffers, useCategories } from "@/hooks/useCatalog";
import { buildSeo } from "@/lib/seo";
import { renderCategoryIcon } from "@/lib/categoryIcon";
import offersHero from "@/assets/offers-hero.webp";
import { useLang } from "@/i18n/LanguageProvider";


export const Route = createFileRoute("/offers/")({
  head: () => {
    const seo = buildSeo({
      title: "كل العروض | خصومات",
      description: "تصفح كل العروض والخصومات المتاحة على خصومات في السعودية — صالونات، عيادات، لياقة، سبا، تجميل والمزيد بأفضل الأسعار.",
      keywords: "عروض، خصومات، صالونات، عيادات، ليزر، سبا، لياقة، تجميل، السعودية",
      path: "/offers",
    });
    return { meta: seo.meta, links: seo.links };
  },
  component: OffersIndex,
});

type Sort = "featured" | "discount" | "price-asc" | "price-desc" | "rating";

function OffersIndex() {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategorySlug | "all">("all");
  const [city, setCity] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("featured");

  const { offers } = useOffers({ pageSize: 200 });
  const { categories } = useCategories();

  const cities = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => o.vendor.city && set.add(o.vendor.city));
    return Array.from(set).sort();
  }, [offers]);

  const filtered = useMemo(() => {
    let list = offers.slice();
    if (cat !== "all") list = list.filter((o) => o.category === cat);
    if (city !== "all") list = list.filter((o) => o.vendor.city === city);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.title.toLowerCase().includes(s) ||
          o.vendor.name.toLowerCase().includes(s) ||
          o.vendor.city.toLowerCase().includes(s),
      );
    }
    switch (sort) {
      case "discount": list.sort((a, b) => b.discountPercent - a.discountPercent); break;
      case "price-asc": list.sort((a, b) => a.priceAfter - b.priceAfter); break;
      case "price-desc": list.sort((a, b) => b.priceAfter - a.priceAfter); break;
      case "rating": list.sort((a, b) => b.vendor.rating - a.vendor.rating); break;
    }
    return list;
  }, [q, cat, city, sort, offers]);

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden py-20 text-white sm:py-24">
          <img
            src={offersHero}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#3F2A6B]/70 via-[#5b3a8a]/60 to-[#E0254D]/70" />

          <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold backdrop-blur">
              <Sparkles className="h-3 w-3" /> {L("كل العروض المتاحة", "All available offers")}
            </span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">
              {L(`اكتشف ${offers.length}+ عرض حصري`, `Discover ${offers.length}+ exclusive offers`)}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-white/85 sm:text-base">
              {L("فلتر حسب التصنيف والسعر والتقييم — احجز اللي يناسبك بضغطة", "Filter by category, price and rating — book what suits you with one tap")}
            </p>

            {/* search */}
            <div className="mx-auto mt-6 flex max-w-2xl items-center gap-2 rounded-full bg-white p-1.5 shadow-2xl">
              <div className="flex flex-1 items-center gap-2 px-4">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={L("ابحث عن خدمة أو منشأة أو مدينة...", "Search for a service, center or city...")}
                  className="h-11 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {q && (
                  <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Chip active={cat === "all"} onClick={() => setCat("all")}>
                <span>{L("كل التصنيفات", "All Categories")}</span>
                <span className="rounded-full bg-black/10 px-1.5 text-[10px]">{offers.length}</span>
              </Chip>
              {categories.map((c) => {
                const count = offers.filter((o) => o.category === c.slug).length;
                const name = (lang === "en" && (c as any).nameEn) ? (c as any).nameEn : c.nameAr;
                return (
                  <Chip key={c.slug} active={cat === c.slug} onClick={() => setCat(c.slug)}>
                    <span className="inline-flex h-4 w-4 items-center justify-center overflow-hidden text-sm leading-none">{renderCategoryIcon(c.icon)}</span>
                    <span className="truncate">{name}</span>
                    <span className="rounded-full bg-black/10 px-1.5 text-[10px]">{count}</span>
                  </Chip>
                );
              })}
            </div>
          </div>
        </section>

        {/* Toolbar */}
        <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {L("عرض", "Showing")} <span className="font-extrabold text-foreground">{filtered.length}</span> {L("عرض", "offers")}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold text-foreground">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {L("المدينة:", "City:")}
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="cursor-pointer bg-transparent text-xs font-extrabold text-foreground outline-none"
                >
                  <option value="all">{L("كل المدن", "All cities")}</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold text-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                {L("ترتيب:", "Sort:")}
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="cursor-pointer bg-transparent text-xs font-extrabold text-foreground outline-none"
                >
                  <option value="featured">{L("المميزة", "Featured")}</option>
                  <option value="discount">{L("الأعلى خصماً", "Biggest discount")}</option>
                  <option value="rating">{L("الأعلى تقييماً", "Top rated")}</option>
                  <option value="price-asc">{L("السعر: الأقل", "Price: low to high")}</option>
                  <option value="price-desc">{L("السعر: الأعلى", "Price: high to low")}</option>
                </select>
              </label>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
              <div className="text-4xl">🔍</div>
              <h3 className="mt-3 text-lg font-extrabold text-foreground">{L("لا توجد نتائج", "No results")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{L("جرّب تغيير الفلتر أو كلمة البحث", "Try changing the filter or search term")}</p>
              <button
                onClick={() => { setQ(""); setCat("all"); setCity("all"); }}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background"
              >
                {L("إعادة تعيين الفلاتر", "Reset filters")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </div>
          )}
        </section>

        <div className="h-16" />
      </main>

      <SiteFooter />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition ${
        active
          ? "border-transparent bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] text-white shadow-md"
          : "border-border bg-card text-foreground/80 hover:border-primary/40 hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}
