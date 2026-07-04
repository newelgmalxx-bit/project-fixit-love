import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  Sparkles,
  Megaphone,
  BadgePercent,
  BadgeCheck,
  MapPin,
  Star,
  Clock,
} from "lucide-react";
import { publicApi } from "@/lib/api/public";
import { useLang } from "@/i18n/LanguageProvider";
import { useCategories } from "@/hooks/useCatalog";
import { useSponsoredAdsBundle } from "@/hooks/useSponsoredAds";
import { renderCategoryIcon } from "@/lib/categoryIcon";
import { SarIcon } from "@/components/ui/SarIcon";
import heroFacial from "@/assets/hero-facial.jpg";
import heroHairBlonde from "@/assets/hero-hair-blonde.jpg";
import heroHairCurl from "@/assets/hero-hair-curl.jpg";
import heroHairwash from "@/assets/hero-hairwash.jpg";
import heroBlowdry from "@/assets/hero-blowdry.jpg";
import heroMedical from "@/assets/hero-medical-1.jpg";
import heroFitness from "@/assets/hero-fitness-1.jpg";
import heroCoffee from "@/assets/hero-coffee.jpg";
import heroTinting from "@/assets/hero-tinting.webp";

type Slide = {
  kicker: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  image: string;
  badge: { value: string; label: string };
  gradient: string;
  ambient: string;
};

function buildSlides(L: (a: string, e: string) => string): Slide[] {
  return [
    {
      kicker: L("عروض متنوعة كل يوم", "Fresh deals every day"),
      titleLine1: L("كل اللي تحتاجيه،", "Everything you need,"),
      titleLine2: L("بخصومات حصرية ومتنوعة", "with exclusive, varied discounts"),
      description: L(
        "عروض مختارة من قطاعات مختلفة — جمال، صحة، لياقة، عناية وأكثر — بخصومات تصل حتى 73% وتتجدد باستمرار.",
        "Curated deals across beauty, health, fitness, wellness and more — up to 73% off, updated constantly."
      ),
      image: heroFacial,
      badge: { value: "73%", label: L("أعلى خصم اليوم", "Today's biggest discount") },
      gradient: "from-[#3F2A6B] via-[#7A4FB8] to-[#E0254D]",
      ambient: "bg-[#E0254D]/25",
    },
    {
      kicker: L("صالونات ومراكز تجميل", "Salons & beauty centers"),
      titleLine1: L("إطلالة أحلى،", "A better look,"),
      titleLine2: L("بأقوى عروض الصالونات", "with the best salon deals"),
      description: L(
        "صبغة، قصات، تسريحات، عناية بشرة وأكثر — من باقة واسعة من الصالونات والمراكز بأسعار حصرية.",
        "Coloring, cuts, styling, skincare and more — from a wide selection of salons at exclusive prices."
      ),
      image: heroHairBlonde,
      badge: { value: "60%", label: L("خصومات الصالونات", "Salon discounts") },
      gradient: "from-[#3F2A6B] via-[#A23A8A] to-[#E0254D]",
      ambient: "bg-[#A23A8A]/25",
    },
    {
      kicker: L("تشكيلة متجددة من العروض", "A constantly refreshed lineup"),
      titleLine1: L("اختاري من تشكيلة واسعة،", "Choose from a wide range,"),
      titleLine2: L("تناسب كل احتياجاتك", "matching every need"),
      description: L(
        "أكثر من 120 عرض حصري في تخصصات مختلفة، نضيف عروض جديدة كل أسبوع لتلاقي اللي يناسبك بسرعة.",
        "Over 120 exclusive offers across categories, with new ones added weekly so you find what fits fast."
      ),
      image: heroHairCurl,
      badge: { value: "55%", label: L("عروض متنوعة", "Varied offers") },
      gradient: "from-[#2A1B4E] via-[#5B3A9E] to-[#9B3FB8]",
      ambient: "bg-[#5B3A9E]/30",
    },
    {
      kicker: L("عناية وجمال شامل", "Complete wellness & beauty"),
      titleLine1: L("دلّلي نفسك،", "Treat yourself,"),
      titleLine2: L("بأفضل خدمات العناية", "with the best care services"),
      description: L(
        "بروتين، كيراتين، سبا، حجامة، وعلاجات تجميل متنوعة بإشراف متخصصين — احجزي بكل سهولة من المنصة.",
        "Protein, keratin, spa, cupping and a variety of cosmetic treatments by specialists — book easily on the platform."
      ),
      image: heroHairwash,
      badge: { value: "50%", label: L("عروض العناية", "Care offers") },
      gradient: "from-[#3F2A6B] via-[#6B3FA8] to-[#E0254D]",
      ambient: "bg-[#6B3FA8]/25",
    },
    {
      kicker: L("مناسبات وتصفيف احترافي", "Occasions & pro styling"),
      titleLine1: L("لكل مناسبة عرض،", "An offer for every occasion,"),
      titleLine2: L("ولكل ذوق اختيار", "and a pick for every taste"),
      description: L(
        "تصفيف، مكياج، تجهيز عرائس، وعروض مميزة لكل المناسبات — تجدّيها كلها في مكان واحد.",
        "Styling, makeup, bridal prep and special-occasion offers — all in one place."
      ),
      image: heroBlowdry,
      badge: { value: "45%", label: L("عروض المناسبات", "Occasion deals") },
      gradient: "from-[#3F2A6B] via-[#8A3FB8] to-[#E0254D]",
      ambient: "bg-[#3F2A6B]/30",
    },
    {
      kicker: L("مراكز وعيادات طبية", "Medical centers & clinics"),
      titleLine1: L("صحتك أولًا،", "Your health first,"),
      titleLine2: L("بأفضل المراكز والعيادات", "with the best centers & clinics"),
      description: L(
        "أسنان، جلدية، ليزر، تجميل طبي وأكثر — من مراكز وعيادات معتمدة بخصومات حقيقية ومتنوعة.",
        "Dental, dermatology, laser, medical aesthetics and more — from accredited centers with real, varied discounts."
      ),
      image: heroMedical,
      badge: { value: "55%", label: L("خصومات طبية", "Medical discounts") },
      gradient: "from-[#0b3b4a] via-[#0891b2] to-[#00aec6]",
      ambient: "bg-[#00aec6]/25",
    },
    {
      kicker: L("لياقة، يوغا، ورياضة", "Fitness, yoga & sports"),
      titleLine1: L("نشاطك يبدأ هنا،", "Your fitness starts here,"),
      titleLine2: L("بعروض رياضية متنوعة", "with varied sports offers"),
      description: L(
        "اشتراكات جيم، يوغا، كروس فيت، ومدربين خاصين من نوادي مختلفة — اختاري الأنسب لك بأفضل سعر.",
        "Gym memberships, yoga, CrossFit and personal trainers from various clubs — pick the best fit at the best price."
      ),
      image: heroFitness,
      badge: { value: "40%", label: L("عروض الرياضة", "Sports deals") },
      gradient: "from-[#7f1d1d] via-[#b91c1c] to-[#f43f5e]",
      ambient: "bg-[#f43f5e]/25",
    },
    {
      kicker: L("مراكز العزل والتظليل الحراري", "Insulation & window tinting"),
      titleLine1: L("حافظ على سيارتك من حرارة الصيف،", "Protect your car from the summer heat,"),
      titleLine2: L("مع أفضل مراكز العزل الحراري", "with the best thermal insulation centers"),
      description: L(
        "تظليل حراري، عوازل عالية الجودة، وحماية متكاملة من أشعة الشمس من مراكز معتمدة بخصومات حصرية.",
        "Thermal tinting, premium insulation and full sun protection from certified centers — at exclusive prices."
      ),
      image: heroTinting,
      badge: { value: "40%", label: L("خصم التظليل", "Tinting discount") },
      gradient: "from-[#0f172a] via-[#334155] to-[#64748b]",
      ambient: "bg-[#334155]/25",
    },
    {
      kicker: L("كوفي شوب ومقاهي", "Coffee shops & cafés"),
      titleLine1: L("اطلب ترويقة قهوة وحلا،", "Order a coffee & sweet treat,"),
      titleLine2: L("من خصومات تروق فيها مزاجك", "from deals that lift your mood"),
      description: L(
        "قهوة مختصة، مشروبات باردة وساخنة، وحلويات فاخرة من أفضل الكوفي شوب بخصومات حصرية تروّق يومك.",
        "Specialty coffee, hot & cold drinks and premium desserts from top coffee shops — with exclusive mood-lifting discounts."
      ),
      image: heroCoffee,
      badge: { value: "50%", label: L("خصم الكوفي", "Café discount") },
      gradient: "from-[#3f2417] via-[#8b5a2b] to-[#d4a373]",
      ambient: "bg-[#8b5a2b]/25",
    },
  ];
}



export function OffersHero() {
  const navigate = useNavigate();
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const slides = useMemo(() => buildSlides(L), [lang]);
  const [q, setQ] = useState("");
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, direction: dir, align: "start" },
    [Autoplay({ delay: 6000, stopOnInteraction: false, stopOnMouseEnter: true, stopOnFocusIn: true })]
  );
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  // Live search across offers
  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [loadedOffers, setLoadedOffers] = useState(false);
  const ensureOffersLoaded = useCallback(async () => {
    if (loadedOffers) return;
    try {
      const data: any = await publicApi.getOffers({ pageSize: 200 } as any);
      const items: any[] = Array.isArray(data)
        ? data
        : data?.items || data?.offers || data?.data || [];
      setAllOffers(items);
    } catch { /* ignore */ }
    finally { setLoadedOffers(true); }
  }, [loadedOffers]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      navigate({ to: "/offers", search: { q: q.trim() } as any });
    } else {
      navigate({ to: "/offers" as any });
    }
  };

  return (
    <section className="relative overflow-hidden bg-background">
      {/* Slider */}
      <div className="embla overflow-hidden" ref={emblaRef}>
        <div className="embla__container flex">
          {slides.map((s, i) => (
            <div
              key={i}
              className="embla__slide relative min-w-0 flex-[0_0_100%]"
            >
              <SlideContent
                slide={s}
                slideIndex={i}
                q={q}
                setQ={setQ}
                onSearch={onSearch}
                active={selected === i}
                offers={allOffers}
                onSearchFocus={ensureOffersLoaded}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Arrows hidden — dots-only navigation */}

      {/* Dots */}
      <div className="relative z-20 flex items-center justify-center gap-2 pb-6 pt-1 sm:absolute sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:p-0">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={L(`الشريحة ${i + 1}`, `Slide ${i + 1}`)}
            className={`h-2 rounded-full transition-all ${
              selected === i
                ? "w-8 bg-primary"
                : "w-2 bg-foreground/30 hover:bg-foreground/50"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

function SlideContent({
  slide,
  slideIndex,
  q,
  setQ,
  onSearch,
  active,
  offers,
  onSearchFocus,
}: {
  slide: Slide;
  slideIndex: number;
  q: string;
  setQ: (v: string) => void;
  onSearch: (e: React.FormEvent) => void;
  active: boolean;
  offers: any[];
  onSearchFocus: () => void;
}) {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { categories } = useCategories();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [] as any[];
    const norm = (v: any) => String(v ?? "").toLowerCase();
    return offers
      .filter((o) => {
        const hay = [
          o.title, o.titleAr, o.titleEn, o.description,
          o.vendorName, o.vendor?.name, o.partner?.vendorName, o.partnerName,
          o.city, o.vendor?.city, o.categoryName, o.categoryNameAr,
        ].map(norm).join(" ");
        return hay.includes(term);
      })
      .slice(0, 8);
  }, [q, offers]);

  return (
    <div className="relative">
      {/* Ambient glows colored per slide — desktop only (heavy blur lags mobile) */}
      <div
        className={`pointer-events-none absolute -top-40 -right-32 hidden h-[28rem] w-[28rem] rounded-full sm:block ${slide.ambient} blur-[120px]`}
      />
      <div className="pointer-events-none absolute -bottom-40 -left-32 hidden h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-[120px] sm:block" />
      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_at_top,theme(colors.primary/8),transparent_60%)] sm:block" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-4 px-4 pb-5 pt-3 sm:gap-12 sm:px-6 sm:pb-10 sm:pt-6 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:pb-12 lg:pt-6">
        {/* Content */}
        <div
          className={`order-2 lg:order-1 lg:col-span-7 transition-all duration-700 ${
            active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> {slide.kicker}
          </span>

          <h1 className="mt-3 text-2xl font-extrabold leading-[1.2] tracking-tight text-foreground sm:mt-5 sm:text-5xl lg:text-6xl">
            {slide.titleLine1}
            <br />
            <span
              className={`bg-gradient-to-r ${slide.gradient} bg-clip-text text-transparent`}
            >
              {slide.titleLine2}
            </span>
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:mt-5 sm:text-lg">
            {slide.description}
          </p>

          {/* Search */}
          <div ref={boxRef} className="relative mt-4 max-w-xl sm:mt-8">
            <form
              onSubmit={onSearch}
              suppressHydrationWarning
              className="flex items-center gap-2 rounded-full border border-border bg-card p-2 shadow-xl shadow-primary/10 ring-1 ring-black/5"
            >
              <Search className="ms-3 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => { onSearchFocus(); setOpen(true); }}
                placeholder={L("ابحث عن خدمة، متجر، أو مدينة…", "Search for a service, store, or city…")}
                suppressHydrationWarning
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className={`shrink-0 rounded-full bg-gradient-to-r ${slide.gradient} px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition hover:scale-[1.02]`}
              >
                {L("ابحث", "Search")}
              </button>
            </form>
            {open && q.trim() && (
              <div className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-border bg-card p-2 shadow-2xl">
                {matches.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    {L("لا توجد نتائج مطابقة", "No matching results")}
                  </div>
                ) : (
                  matches.map((o: any) => {
                    const title = (lang === "en" ? (o.titleEn || o.title || o.titleAr) : (o.title || o.titleAr || o.titleEn)) || L("عرض", "Offer");
                    const sub = o.vendor?.name || o.partner?.vendorName || o.partnerName || o.vendorName || o.city || "";
                    const img = o.image || o.imageUrl || o.coverImage || null;
                    return (
                      <Link
                        key={o.id}
                        to="/offers/$offerId"
                        params={{ offerId: String(o.id) }}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
                      >
                        {img ? (
                          <img src={img} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" loading="lazy" />
                        ) : (
                          <div className="h-10 w-10 shrink-0 rounded-lg bg-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-foreground">{title}</div>
                          {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Quick category pills */}
          <div className="mt-3 flex flex-wrap gap-2 sm:mt-6">
            <span className="self-center text-xs font-medium text-muted-foreground">
              {L("شائع:", "Popular:")}
            </span>
            {categories.slice(0, 5).map((c: any) => (
              <Link
                key={c.slug}
                to="/offers/category/$slug"
                params={{ slug: c.slug }}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <span className="me-1 inline-flex h-4 w-4 items-center justify-center overflow-hidden">{renderCategoryIcon(c.icon)}</span>
                {lang === "en" ? (c.nameEn || c.nameAr) : (c.nameAr || c.nameEn)}
              </Link>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-5 grid max-w-xl grid-cols-3 gap-2 border-t border-border pt-4 text-center sm:mt-10 sm:gap-4 sm:pt-6 sm:text-start">
            <Stat value="+120" label={L("عرض حصري", "Exclusive offers")} />
            <Stat value="+45" label={L("متجر معتمد", "Verified stores")} />
            <Stat value="73%" label={L("أقصى خصم", "Max discount")} />
          </div>
        </div>

        {/* Visual */}
        <div
          className={`order-1 lg:order-2 lg:col-span-5 transition-all duration-700 ${
            active ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <SlideVisual slide={slide} slideIndex={slideIndex} />
        </div>

      </div>
    </div>
  );
}

function SlideVisual({ slide, slideIndex }: { slide: Slide; slideIndex: number }) {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { ads, offers, partners } = useSponsoredAdsBundle();
  const ad =
    ads.find((a) => Number(a.slide_index) === slideIndex + 1) ||
    ads.find((a) => a.slide_index == null || Number(a.slide_index) === 0) ||
    null;
  const offer = ad?.offer_id ? offers[ad.offer_id] ?? null : null;
  const partner = offer?.partnerId ? partners[offer.partnerId] ?? null : null;



  const offerImage = offer?.image || offer?.imageUrl || offer?.coverImage || ad?.image_url || null;
  const useOfferImage = !!offerImage && (!!ad?.offer_id || !!ad?.image_url);
  const imgSrc = useOfferImage ? offerImage : slide.image;

  const priceBefore = Number(offer?.priceBefore ?? 0) || 0;
  const priceAfter = Number(offer?.priceAfter ?? 0) || 0;
  const discountPct =
    priceBefore > 0 && priceAfter > 0 && priceBefore > priceAfter
      ? Math.round(((priceBefore - priceAfter) / priceBefore) * 100)
      : 0;

  const badgeValue = discountPct > 0 ? `${discountPct}%` : slide.badge.value;
  const badgeLabel = discountPct > 0 ? L("خصم العرض", "Offer discount") : slide.badge.label;

  const offerTitle =
    (lang === "en" ? (offer?.titleEn || offer?.title || offer?.titleAr) : (offer?.title || offer?.titleAr || offer?.titleEn)) || ad?.title || "";
  const centerName =
    offer?.vendor?.name ||
    offer?.vendorName ||
    offer?.vendor_name ||
    offer?.vendorNameAr ||
    offer?.vendorNameEn ||
    offer?.partner?.vendorName ||
    offer?.partner?.name ||
    offer?.partnerName ||
    partner?.vendorName ||
    partner?.vendorNameAr ||
    partner?.vendorNameEn ||
    partner?.nameAr ||
    partner?.nameEn ||
    partner?.name ||
    ad?.subtitle ||
    null;

  const { categories } = useCategories();
  const categoryId = offer?.categoryId || offer?.category_id;
  const cat = categoryId
    ? (categories as any[]).find((c) => c.id === categoryId || c.slug === categoryId)
    : undefined;

  const city =
    offer?.vendor?.city ||
    offer?.city ||
    partner?.city ||
    partner?.addressAr ||
    partner?.address ||
    "";
  const rating = Number(offer?.vendor?.rating ?? partner?.rating ?? 0) || 0;
  const reviewsCount = Number(offer?.vendor?.reviewsCount ?? partner?.reviewsCount ?? 0) || 0;
  const duration = Number(offer?.durationMinutes ?? 0) || 0;
  const savings = priceBefore > priceAfter ? priceBefore - priceAfter : 0;

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        className={`absolute -inset-4 hidden rounded-[2rem] bg-gradient-to-tr ${slide.gradient} opacity-30 blur-2xl sm:block`}
      />
      <div className="relative overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-xl shadow-primary/20 sm:rounded-[2rem] sm:shadow-2xl">
        <img
          src={imgSrc}
          alt={useOfferImage ? offerTitle || L("عرض ممول", "Sponsored offer") : L("عرض مميز", "Featured offer")}
          width={896}
          height={1152}
          loading="lazy"
          decoding="async"
          className="aspect-[5/4] w-full object-cover sm:aspect-[4/5]"
        />

        <div className="absolute top-2 end-2 flex flex-col items-end gap-1.5 sm:top-3 sm:end-3">
          <div
            className={`flex items-center gap-1.5 rounded-xl bg-gradient-to-br ${slide.gradient} px-2.5 py-1.5 text-white shadow-lg ring-1 ring-white/20 sm:gap-2 sm:px-3 sm:py-2`}
          >
            <BadgePercent className="h-4 w-4 sm:h-5 sm:w-5" />
            <div className="leading-tight">
              <div className="text-base font-extrabold sm:text-lg">{badgeValue}</div>
              <div className="text-[9px] opacity-90 sm:text-[10px]">{badgeLabel}</div>
            </div>
          </div>
          {savings > 0 && (
            <span className="inline-flex items-center rounded-lg bg-white/95 px-2 py-0.5 text-[10px] font-extrabold text-[#E0254D] shadow backdrop-blur" dir={dir}>
              {L(`توفير ${savings} ر.س`, `Save ${savings} SAR`)}
            </span>
          )}
        </div>

        {ad?.offer_id && offer && cat && (
          <div className="pointer-events-none absolute bottom-[8.5rem] start-3 sm:bottom-[9.5rem] sm:start-5">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-foreground shadow backdrop-blur">
              <span className="text-sm leading-none">{(cat as any).icon}</span>
              <span className="truncate max-w-[140px]">{lang === "en" ? ((cat as any).nameEn || (cat as any).nameAr) : ((cat as any).nameAr || (cat as any).nameEn)}</span>
            </span>
          </div>
        )}

        {ad?.offer_id ? (
          <Link
            to="/offers/$offerId"
            params={{ offerId: ad.offer_id }}
            className="absolute inset-x-3 bottom-3 rounded-2xl bg-card/95 p-3 shadow-xl ring-1 ring-border backdrop-blur transition hover:bg-card sm:inset-x-5 sm:bottom-5"
          >
            {/* Row 1: badge + title */}
            <div className="flex items-center gap-2">
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                <Megaphone className="h-2.5 w-2.5" /> {L("إعلان ممول", "Sponsored")}
              </span>
              <h4 className="line-clamp-1 text-xs font-extrabold text-foreground sm:text-sm">
                {offerTitle}
              </h4>
            </div>

            {/* Row 2: vendor */}
            {centerName && (
              <div className="mt-1 flex items-center gap-1 text-[10px]">
                <BadgeCheck className="h-3 w-3 shrink-0 text-emerald-500" />
                <span className="truncate font-semibold text-foreground/80">{centerName}</span>
              </div>
            )}

            {/* Row 3: meta */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="font-extrabold">{rating > 0 ? rating : "0.0"}</span>
                <span className="text-amber-600/70">({reviewsCount})</span>
              </span>
              {city && (
                <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="font-semibold">{city}</span>
                </span>
              )}
              {duration > 0 && (
                <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="font-semibold">{duration} {L("د", "min")}</span>
                </span>
              )}
            </div>

            {/* Row 4: price + CTA */}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
              {priceAfter > 0 ? (
                <span className="inline-flex items-baseline gap-1.5">
                  <span className="inline-flex items-baseline gap-1" dir="ltr">
                    <span className="bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] bg-clip-text text-lg font-black text-transparent">
                      {priceAfter}
                    </span>
                    <SarIcon className="h-[0.8em] text-[#E0254D]" />
                    {priceBefore > priceAfter && (
                      <span className="text-[10px] text-slate-400 line-through">{priceBefore}</span>
                    )}
                  </span>
                  <span className="text-[9px] font-semibold text-muted-foreground">{L("السعر شامل الضريبة", "VAT included")}</span>
                </span>
              ) : <span />}
              <span className="shrink-0 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-extrabold text-background transition group-hover:bg-gradient-to-r group-hover:from-[#3F2A6B] group-hover:to-[#E0254D]">
                {L("احجز الآن", "Book now")}
              </span>
            </div>
          </Link>
        ) : ad ? (
          (() => {
            const inner = (
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  <Megaphone className="h-2.5 w-2.5" /> {L("إعلان ممول", "Sponsored")}
                </div>
                <div className="truncate text-xs font-extrabold text-foreground sm:text-sm">
                  {ad.title}
                </div>
                {ad.subtitle && (
                  <div className="line-clamp-2 text-[10px] text-muted-foreground sm:text-[11px]">
                    {ad.subtitle}
                  </div>
                )}
              </div>
            );
            const cta = ad.cta_label ? (
              <div className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground sm:px-4 sm:py-2 sm:text-xs">
                {ad.cta_label}
              </div>
            ) : null;
            const cls =
              "absolute inset-x-3 bottom-3 flex items-center gap-2.5 rounded-2xl bg-card/95 px-3 py-2.5 shadow-xl ring-1 ring-border backdrop-blur transition hover:bg-card sm:inset-x-5 sm:bottom-5 sm:gap-3 sm:px-4 sm:py-3";
            if (ad.link_url) {
              return (
                <a href={ad.link_url} target="_blank" rel="noreferrer" className={cls}>
                  {inner}
                  {cta}
                </a>
              );
            }
            return (
              <div className={cls}>
                {inner}
                {cta}
              </div>
            );
          })()
        ) : (
          <SponsoredAdOverlay slideIndex={slideIndex} />
        )}

      </div>
    </div>
  );
}




type SponsoredAd = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  cta_label: string | null;
  slide_index: number | null;
  offer_id: string | null;
};


function SponsoredAdOverlay({ slideIndex }: { slideIndex: number }) {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { ads, offers, partners } = useSponsoredAdsBundle();

  const getPartnerName = (partner: any) => {
    return (
      partner?.vendorName ||
      partner?.vendor_name ||
      partner?.vendorNameAr ||
      partner?.vendorNameEn ||
      partner?.name ||
      partner?.nameAr ||
      partner?.nameEn ||
      null
    );
  };

  const getCenterName = (offer: any, ad: SponsoredAd) => {
    return (
      offer?.vendor?.name ||
      offer?.vendorName ||
      offer?.vendor_name ||
      offer?.vendorNameAr ||
      offer?.vendorNameEn ||
      offer?.partner?.vendorName ||
      offer?.partner?.vendor_name ||
      offer?.partner?.name ||
      offer?.partner?.nameAr ||
      offer?.partnerName ||
      offer?.partner_name ||
      offer?.merchantName ||
      offer?.merchant_name ||
      offer?.centerName ||
      offer?.center_name ||
      getPartnerName(partners[offer?.partnerId]) ||
      ad.subtitle
    );
  };


  const slideAds = ads.filter((a) => a.slide_index == null || Number(a.slide_index) === 0 || Number(a.slide_index) === slideIndex + 1);

  const baseClass =
    "absolute inset-x-3 bottom-3 flex items-center gap-2.5 rounded-2xl bg-card/95 px-3 py-2.5 shadow-xl ring-1 ring-border backdrop-blur transition hover:bg-card sm:inset-x-5 sm:bottom-5 sm:gap-3 sm:px-4 sm:py-3";

  const renderInner = (title: string, subtitle: string | null, image: string | null, showBookBtn = false) => (
    <>
      {image ? (
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-12 sm:w-12">
          <img src={image} alt={title} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-12 sm:w-12">
          <Megaphone className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
          <Megaphone className="h-2.5 w-2.5" /> {L("إعلان ممول", "Sponsored")}
        </div>
        <div className="truncate text-xs font-extrabold text-foreground sm:text-sm">{title}</div>
        {subtitle && (
          <div className="truncate text-[10px] text-muted-foreground sm:text-[11px]">{subtitle}</div>
        )}
      </div>
      {showBookBtn && (
        <div className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground sm:px-4 sm:py-2 sm:text-xs">
          {L("احجز الآن", "Book now")}
        </div>
      )}
    </>
  );

  if (slideAds.length > 0) {
    const ad = slideAds[0];
    if (ad.offer_id) {
      const offer = offers[ad.offer_id];
      const title = (lang === "en" ? (offer?.titleEn || offer?.title || offer?.titleAr) : (offer?.title || offer?.titleAr || offer?.titleEn)) || ad.title;
      const subtitle = getCenterName(offer, ad);
      const image = offer?.image || offer?.imageUrl || offer?.coverImage || ad.image_url;
      return (
        <Link to="/offers/$offerId" params={{ offerId: ad.offer_id }} className={baseClass}>
          {renderInner(title, subtitle, image, true)}
        </Link>
      );
    }
    const inner = renderInner(ad.title, ad.subtitle, ad.image_url);
    if (ad.link_url) {
      return (
        <a href={ad.link_url} target="_blank" rel="noreferrer" className={baseClass}>
          {inner}
        </a>
      );
    }
    return <div className={baseClass}>{inner}</div>;
  }

  return null;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 px-1">
      <div className="text-xl font-extrabold leading-none text-foreground sm:text-3xl">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] leading-5 text-muted-foreground sm:text-sm">{label}</div>
    </div>
  );
}
