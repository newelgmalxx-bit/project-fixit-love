import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { OfferCard } from "@/components/sections/OfferCard";
import { useCategory, useOffersByCategory } from "@/hooks/useCatalog";
import { buildSeo } from "@/lib/seo";
import { renderCategoryIcon } from "@/lib/categoryIcon";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/offers/category/$slug")({
  head: ({ params }) => {
    const seo = buildSeo({
      title: `تصنيف ${params.slug} | عروض وخصومات`,
      description: `أفضل عروض وخصومات التصنيف — احجز بالباركود واستمتع بأقل الأسعار.`,
      path: `/offers/category/${params.slug}`,
    });
    return { meta: seo.meta, links: seo.links };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const category = useCategory(slug);
  const { offers, isLoading } = useOffersByCategory(slug);
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);

  if (!category && !isLoading) {
    return (
      <div dir={dir} className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center p-12">
          <p className="text-muted-foreground">{L("التصنيف غير موجود.", "Category not found.")}</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {category && (
          <section className={`relative overflow-hidden bg-gradient-to-br ${category.color} py-16 text-white`}>
            <img src={category.cover} alt={lang === "en" ? (category as any).nameEn || category.nameAr : category.nameAr} className="absolute inset-0 h-full w-full object-cover opacity-20" />
            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <Link to="/" className="inline-flex items-center gap-1 text-xs font-bold text-white/80 hover:text-white">
                <ChevronLeft className={`h-4 w-4 ${dir === "ltr" ? "rotate-180" : ""}`} /> {L("الرئيسية", "Home")}
              </Link>
              <div className="mt-4 flex items-center gap-4">
                <div className="inline-flex h-14 w-14 items-center justify-center overflow-hidden text-5xl">{renderCategoryIcon(category.icon)}</div>
                <div>
                  <h1 className="text-3xl font-extrabold sm:text-4xl">{lang === "en" ? (category as any).nameEn || category.nameAr : category.nameAr}</h1>
                  <p className="mt-1 text-sm text-white/80">{offers.length} {L("عرض حصري متاح الآن", "exclusive offers available now")}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
              {L("جاري التحميل…", "Loading…")}
            </div>
          ) : offers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
              {L("لا توجد عروض حالياً في هذا التصنيف.", "No offers in this category right now.")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {offers.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
