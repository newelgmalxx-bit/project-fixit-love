import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft as ArrowLeftIcon } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { OffersHero } from "@/components/sections/OffersHero";
import { CategoriesGrid } from "@/components/sections/CategoriesGrid";
import { HomeOfferSlider1, HomeOfferSlider2 } from "@/components/sections/HomeOfferSlider";

import { AboutIntroSection } from "@/components/sections/AboutIntroSection";
import { WhyUsSection } from "@/components/sections/WhyUsSection";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";
import { CtaBanner } from "@/components/sections/CtaBanner";

import { buildSeo, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { Reveal } from "@/components/Reveal";
import { useLang } from "@/i18n/LanguageProvider";
import { useHomeData } from "@/hooks/useHomeData";

export const Route = createFileRoute("/")({
  head: () => {
    const seo = buildSeo({
      title: "خصومات | عروض حصرية ومتنوعة لتسهيل حياتك وتوفير أموالك",
      description:
        "عروض حصرية ومتنوعة لتسهيل حياتك وتوفير أموالك — منصتك الأولى في السعودية لأفضل الخصومات والكوبونات على الصالونات والعيادات.",
      keywords: "خصومات، عروض، كوبونات، تخفيضات، صالونات، عيادات، تجميل، أسنان، ليزر، السعودية، الرياض، جدة، الدمام",
      path: "/",
    });
    return {
      meta: seo.meta,
      links: seo.links,
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(organizationJsonLd()) },
        { type: "application/ld+json", children: JSON.stringify(websiteJsonLd()) },
      ],
    };
  },
  component: Index,
});

function Index() {
  const { dir, lang } = useLang();
  // Single batch request that seeds categories/partners/offers/ads/reviews caches.
  useHomeData(20);

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <OffersHero />
        <Reveal variant="up"><CategoriesGrid /></Reveal>
        <Reveal variant="up" delay={80}><HomeOfferSlider1 /></Reveal>
        <Reveal variant="up" delay={80}><HomeOfferSlider2 /></Reveal>
        <Reveal variant="up" delay={120}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12 flex justify-center">
            <Link
              to="/offers"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-8 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            >
              {lang === "en" ? "View all offers" : "عرض كل العروض"}
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>

        <Reveal variant="up"><WhyUsSection /></Reveal>
        {/* Legacy / secondary content kept below */}
        <Reveal variant="up"><AboutIntroSection /></Reveal>
        <Reveal variant="up"><TestimonialsSection /></Reveal>
        <Reveal variant="zoom"><CtaBanner /></Reveal>
      </main>
      <SiteFooter />
    </div>
  );
}

