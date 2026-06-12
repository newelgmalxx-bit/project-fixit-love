import { Link } from "@tanstack/react-router";
import { Phone, Mail, MapPin, Instagram, Music2, Ghost, MessageCircle } from "lucide-react";
import logo from "@/assets/booking-logo.png";
import visaMc from "@/assets/payments/visa-mastercard.png";
import applePay from "@/assets/payments/apple-pay.jpg";
import mada from "@/assets/payments/mada.png";
import stcPay from "@/assets/payments/stc-pay.png";
import { useSiteSettings, waHref } from "@/hooks/useSiteSettings";
import { useCategories } from "@/hooks/useCatalog";
import { renderCategoryIcon } from "@/lib/categoryIcon";

const paymentMethods = [
  { src: visaMc, alt: "Visa & Mastercard" },
  { src: mada, alt: "مدى" },
  { src: applePay, alt: "Apple Pay" },
  { src: stcPay, alt: "STC Pay" },
];

export function SiteFooter() {
  const site = useSiteSettings();
  const { categories } = useCategories();
  const socials = ([
    [site.instagram, Instagram],
    [site.tiktok, Music2],
    [site.snapchat, Ghost],
    [site.whatsapp ? (waHref(site.whatsapp) || site.whatsapp) : undefined, MessageCircle],
  ] as const).filter(([u]) => !!u);

  const quickLinks: { label: string; to: any; hash?: string }[] = [
    { label: "الرئيسية", to: "/" },
    { label: "كل العروض", to: "/offers" },
    { label: "من نحن", to: "/about" },
    { label: "متابعة الحجز", to: "/track" },
    { label: "تواصل معنا", to: "/contact" },
  ];

  return (
    <footer className="bg-primary-dark text-white">
      <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        {/* Brand */}
        <div className="lg:col-span-1">
          <div className="mb-5 inline-flex items-center gap-3">
            <img src={logo} alt="خصومات" width={180} height={72} className="h-14 w-auto object-contain sm:h-16" />
          </div>
          <p className="text-base leading-8 text-white/80" suppressHydrationWarning>
            {site.footerDescription || site.descriptionAr || "منصتك الأولى لأقوى خصومات الصالونات، متاجر التجميل، السبا، اللياقة، والعيادات — احجز ادفع واستخدم الباركود."}
          </p>
          <div className="mt-6 flex items-center gap-3">
            {socials.map(([url, Icon], i) => (
              <a
                key={i}
                href={url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="mb-5 text-lg font-bold">روابط سريعة</h4>
          <ul className="space-y-3 text-base text-white/85">
            {quickLinks.map((l) => (
              <li key={l.label}>
                <Link to={l.to} hash={l.hash} className="transition hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Categories */}
        <div>
          <h4 className="mb-5 text-lg font-bold">تصنيفات الخدمات</h4>
          <ul className="space-y-3 text-base text-white/85">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  to="/offers/category/$slug"
                  params={{ slug: c.slug }}
                  className="inline-flex items-center gap-2 transition hover:text-white"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center overflow-hidden">{renderCategoryIcon(c.icon)}</span>
                  <span>{c.nameAr}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="mb-5 text-lg font-bold">تواصل معنا</h4>
          <ul className="space-y-3">
            {([
              site.phone ? { Icon: Phone, text: site.phone } : null,
              site.email ? { Icon: Mail, text: site.email } : null,
              { Icon: MapPin, text: site.address || "المملكة العربية السعودية" },
            ].filter(Boolean) as { Icon: any; text: string }[]).map(({ Icon, text }, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/10">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icon className="h-4 w-4" />
                </span>
                <span dir="ltr" className="flex-1 text-start text-sm text-white/85">{text}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/offers"
            className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-primary-dark shadow-md transition hover:-translate-y-0.5"
          >
            تصفح كل العروض
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-5 text-sm text-white/70 sm:px-6 lg:flex-row lg:px-8">
          <p className="order-3 lg:order-1">© 2022 خصومات. جميع الحقوق محفوظة.</p>

          <div className="order-2 flex flex-wrap items-center justify-center gap-2">
            {paymentMethods.map((p) => (
              <div
                key={p.alt}
                className="flex h-8 items-center justify-center rounded-md bg-white px-2 shadow-sm ring-1 ring-black/5"
              >
                <img src={p.src} alt={p.alt} className="h-5 w-auto object-contain" loading="lazy" />
              </div>
            ))}
          </div>

          <div className="order-1 flex items-center gap-5 lg:order-3">
            <Link to={"/privacy" as any} className="hover:text-white">سياسة الخصوصية</Link>
            <Link to={"/terms" as any} className="hover:text-white">الشروط والأحكام</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
