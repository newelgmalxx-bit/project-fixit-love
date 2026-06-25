import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Home, Search, ArrowLeft } from "lucide-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/router";

import "../styles.css";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import { usePageTracking } from "@/hooks/usePageTracking";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { type ReactNode } from "react";
import { buildSeo, organizationJsonLd, websiteJsonLd } from "@/lib/seo";


const GOOGLE_CLIENT_ID =
  "35325770661-6il1fjomm9jg8i1j45b9hr6pig14ml54.apps.googleusercontent.com";

function NotFoundComponent() {
  const lang = (typeof document !== "undefined" && document.documentElement.lang === "en") ? "en" : "ar";
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  return (
    <div dir={lang === "en" ? "ltr" : "rtl"} className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-background to-primary/5 px-4">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" />
      <div className="relative z-10 w-full max-w-2xl text-center">
        <div className="select-none bg-gradient-to-b from-primary to-primary/40 bg-clip-text text-[9rem] sm:text-[12rem] font-black leading-none text-transparent drop-shadow-sm">
          404
        </div>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">
          {L("الصفحة غير موجودة", "Page not found")}
        </h2>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
          {L("عذراً، الصفحة التي تبحث عنها غير متوفرة أو تم نقلها إلى مكان آخر.", "Sorry, the page you are looking for is unavailable or has been moved.")}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90"
          >
            <Home className="h-4 w-4" /> {L("العودة للرئيسية", "Back to home")}
          </Link>
          <Link
            to="/contact"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"
          >
            <Search className="h-4 w-4" /> {L("تواصل معنا", "Contact us")}
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {L("الرجوع للخلف", "Go back")}
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => {
    const seo = buildSeo({
      title: "خصومات | عروض حصرية ومتنوعة لتسهيل حياتك وتوفير أموالك",
      description:
        "عروض حصرية ومتنوعة لتسهيل حياتك وتوفير أموالك — منصتك الأولى في السعودية لأفضل الخصومات والكوبونات على الصالونات والعيادات.",
      keywords: "خصومات، عروض، كوبونات، تخفيضات، صالونات، عيادات، تجميل، أسنان، ليزر، السعودية",
      path: "/",
    });
    return {
      meta: seo.meta,
      links: [
        ...seo.links,
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap",
        },
      ],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(organizationJsonLd()) },
        { type: "application/ld+json", children: JSON.stringify(websiteJsonLd()) },
      ],
    };
  },
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  useTrackVisit();
  usePageTracking();
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <LanguageProvider>
            <AuthProvider>
              <MaintenanceGate>
                <Outlet />
              </MaintenanceGate>
              <Toaster position="top-center" richColors closeButton />
            </AuthProvider>
          </LanguageProvider>
        </GoogleOAuthProvider>
      </QueryClientProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
