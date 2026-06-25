import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useCategories, useOffers } from "@/hooks/useCatalog";
import { useMemo } from "react";
import { renderCategoryIcon } from "@/lib/categoryIcon";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "التصنيفات | خصومات" },
      { name: "description", content: "تصفح كل التصنيفات على خصومات في السعودية: الصالونات، العيادات، الحجامة، اللياقة، المختبرات، السبا، ومتاجر التجميل." },
      { property: "og:title", content: "التصنيفات | خصومات" },
      { property: "og:description", content: "اختر التصنيف اللي يناسبك واحجز عرضك المفضل خلال دقائق." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { categories } = useCategories();
  const { offers } = useOffers({ pageSize: 200 });
  const countBySlug = useMemo(() => {
    const m = new Map<string, number>();
    offers.forEach((o) => m.set(o.category, (m.get(o.category) ?? 0) + 1));
    return m;
  }, [offers]);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />


      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#3F2A6B] via-[#5b3a8a] to-[#E0254D] py-16 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold backdrop-blur">
              <Sparkles className="h-3 w-3" /> {L("تصفح حسب التصنيف", "Browse by category")}
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">{L("كل التصنيفات", "All Categories")}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/85 sm:text-base">
              {L(
                `أكثر من 120 عرض حصري موزعة على ${categories.length} تصنيفات — اختر اللي يهمك واحجز خلال دقايق`,
                `Over 120 exclusive offers across ${categories.length} categories — pick what suits you and book in minutes`,
              )}
            </p>
          </div>
        </section>

        {/* Grid */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => {
              const count = countBySlug.get(c.slug) ?? 0;
              const name = (lang === "en" && (c as any).nameEn) ? (c as any).nameEn : c.nameAr;
              return (
                <Link
                  key={c.slug}
                  to="/offers/category/$slug"
                  params={{ slug: c.slug }}
                  className="group relative flex h-64 flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-primary/20"
                >
                  <img
                    src={c.cover}
                    alt={name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-br ${c.color} opacity-75 mix-blend-multiply`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                  <div className="relative z-10 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-md ring-1 ring-white/30">
                      {renderCategoryIcon(c.icon)}
                    </div>
                    <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-extrabold text-foreground shadow-md">
                      {count} {L("عرض", "offers")}
                    </span>
                  </div>

                  <div className="relative z-10 text-white">
                    <h3 className="text-xl font-extrabold leading-tight drop-shadow sm:text-2xl">{name}</h3>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur transition group-hover:bg-white group-hover:text-foreground">
                      {L("تصفح العروض", "Browse offers")}
                      <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
