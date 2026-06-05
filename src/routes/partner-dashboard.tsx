import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  Loader2, LogOut, Store, Tag, Calendar, BarChart3, Plus, Trash2,
  Edit3, Check, X, Clock, AlertCircle, TrendingUp, DollarSign, Users,
  Wallet, Star, Bell, ArrowDownToLine, MessageSquare, LineChart,
  CalendarDays, UserCog, Crown, LifeBuoy, Send, Phone, Mail, Shield,
  Sparkles, ChevronLeft, ChevronRight, Zap, Menu, ExternalLink, Percent, FileText, Eye,
  ShieldCheck, CheckCircle2, XCircle, Search, User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { partnerApi, partnerAuth, getStoredPartner, setStoredPartner, type PartnerProfile as ApiPartnerProfile } from "@/lib/api/partner";
import { useCategories } from "@/hooks/useCatalog";
import logoImg from "@/assets/booking-logo.png";
import { generateTimeSlots } from "@/lib/timeSlots";
import { ImageUpload, ImageUploadMulti } from "@/components/ui/ImageUpload";
import {
  loadStore as loadAgreementStore, saveStore as saveAgreementStore, subscribeStore as subscribeAgreementStore,
  buildAgreementHtmlForPartner, printAgreementPdf, DEMO_PARTNER_ID,
} from "@/lib/agreementMock";


import { PartnerGuard } from "@/components/auth/PartnerGuard";

export const Route = createFileRoute("/partner-dashboard")({
  head: () => ({ meta: [{ title: "لوحة تحكم الشريك | خصومات" }] }),
  component: () => (
    <PartnerGuard>
      <PartnerDashboard />
    </PartnerGuard>
  ),
});

type Tab = "overview" | "profile" | "offers" | "bookings" | "verify" | "schedule" | "wallet" | "reviews" | "messages" | "analytics" | "agreement" | "notifications" | "support";

type WorkingHour = { day: string; open: string; close: string; closed?: boolean };
const WEEK_DAYS: { key: string; ar: string }[] = [
  { key: "saturday", ar: "السبت" },
  { key: "sunday", ar: "الأحد" },
  { key: "monday", ar: "الاثنين" },
  { key: "tuesday", ar: "الثلاثاء" },
  { key: "wednesday", ar: "الأربعاء" },
  { key: "thursday", ar: "الخميس" },
  { key: "friday", ar: "الجمعة" },
];
function defaultWorkingHours(): WorkingHour[] {
  return WEEK_DAYS.map((d) => ({
    day: d.key,
    open: d.key === "friday" ? "00:00" : "09:00",
    close: d.key === "friday" ? "00:00" : "22:00",
    closed: d.key === "friday",
  }));
}
function parseWorkingHoursStruct(raw: any): WorkingHour[] {
  if (!raw) return defaultWorkingHours();
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length) {
      return WEEK_DAYS.map((d) => {
        const found = arr.find((x: any) => String(x?.day || "").toLowerCase() === d.key);
        if (!found) return { day: d.key, open: "09:00", close: "22:00", closed: false };
        const open = String(found.open || "09:00");
        const close = String(found.close || "22:00");
        const closed = !!found.closed || (open === "00:00" && close === "00:00");
        return { day: d.key, open, close, closed };
      });
    }
  } catch {}
  return defaultWorkingHours();
}

type Profile = {
  id: string; user_id: string; vendor_name: string; owner_name: string;
  category: string; city: string; phone: string; email: string | null;
  commercial_number: string | null; logo_url: string | null;
  about: string | null; working_hours: string | null; address: string | null;
  maps_url?: string | null;
  status: string; notes: string | null;
  commission_pct?: number | null; deposit_pct?: number | null;
  vendor_name_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  terms?: string | null;
  terms_en?: string | null;
  about_en?: string | null;
  category_ids?: (string | number)[];
  working_hours_struct?: WorkingHour[];
};

const DEMO_PROFILE: Profile = {
  id: DEMO_PARTNER_ID,
  user_id: "demo",
  vendor_name: "مركز لمسة جمال",
  owner_name: "أ. منيرة الحربي",
  category: "salon",
  city: "الرياض",
  phone: "+966501234567",
  email: "demo@beauty-booking.com",
  commercial_number: "1010234567",
  logo_url: null,
  about: "مركز تجميل نسائي متكامل يقدّم خدمات الشعر والبشرة والمكياج بأيدي خبيرات معتمدات.",
  working_hours: "السبت - الخميس · 10ص - 10م",
  address: "حي الياسمين، طريق الأمير محمد بن سعد، الرياض",
  maps_url: "",
  status: "active",
  notes: null,
  commission_pct: 10,
  deposit_pct: 20,
};

type Offer = {
  id: string; partner_id: string; title: string; description: string | null;
  title_en?: string | null; description_en?: string | null;
  price: number; original_price: number | null; image_url: string | null;
  image_urls?: string[] | null;
  category: string | null; status: string;
  duration_minutes?: number | null;
  discount_percent?: number | null;
  terms?: string[] | null;
  terms_en?: string[] | null;
  overview_bullets?: string[] | null;
  overview_bullets_en?: string[] | null;
  valid_from?: string | null;
  valid_to?: string | null;
};

type Booking = {
  id: string; partner_id: string; offer_id: string | null;
  customer_name: string; customer_phone: string; customer_email: string | null;
  booking_date: string | null; booking_time: string | null;
  amount: number | null; status: string; notes: string | null; created_at: string;
  verify_code?: string | null; redeemed_at?: string | null;
  qty?: number;
  payment?: "online" | "deposit" | "cash";
  payment_method?: "mada" | "visa" | "mastercard" | "applepay" | "stcpay" | "mayfatoorah" | "cod";
  payment_status?: "paid" | "deposit_paid" | "unpaid" | "refunded";
  commission?: number;
  deposit_amount?: number | null;
  source?: "app" | "web" | "partner";
  confirmed_at?: string | null;
};

const PAY_METHOD_LABEL: Record<string, string> = { mada: "مدى", visa: "فيزا", mastercard: "ماستر كارد", applepay: "Apple Pay", stcpay: "STC Pay", mayfatoorah: "ماي فاتورة", cod: "الدفع في المركز" };
const PAY_STATUS_LABEL: Record<string, string> = { paid: "مدفوع بالكامل", deposit_paid: "عربون مدفوع", unpaid: "غير مدفوع", refunded: "مسترجع" };
const SOURCE_LABEL: Record<string, string> = { app: "التطبيق", web: "الويب", partner: "من المركز" };

function mapApiPartner(raw: ApiPartnerProfile | null | undefined): Profile | null {
  if (!raw?.id) return null;
  const p: any = raw;
  return {
    id: String(p.id),
    user_id: p.userId ? String(p.userId) : (p.user_id ? String(p.user_id) : ""),
    vendor_name: p.vendorName || p.vendor_name || p.name || "",
    owner_name: p.ownerName || p.owner_name || p.owner || "",
    category: p.category || p.categoryId || p.category_id || "",
    city: p.city || p.cityName || p.city_name || "",
    phone: p.phone || "",
    email: p.email ?? null,
    commercial_number: p.commercialNumber ?? p.commercial_number ?? null,
    logo_url: p.logoUrl || p.logo_url || p.logo || null,
    about: p.about ?? null,
    working_hours: p.workingHours ?? p.working_hours ?? null,
    address: p.address ?? null,
    maps_url: p.mapsUrl ?? p.maps_url ?? null,
    status: p.status || "pending",
    notes: p.notes ?? null,
    commission_pct: p.commissionPct ?? p.commission_pct ?? null,
    deposit_pct: p.depositPct ?? p.deposit_pct ?? null,
    vendor_name_en: p.vendorNameEn ?? p.vendor_name_en ?? p.nameEn ?? p.name_en ?? null,
    description: p.description ?? p.descriptionAr ?? null,
    description_en: p.descriptionEn ?? p.description_en ?? null,
    terms: p.terms ?? p.termsAr ?? null,
    terms_en: p.termsEn ?? p.terms_en ?? null,
    about_en: p.aboutEn ?? p.about_en ?? null,
    category_ids: (() => {
      const src = p.categoryIds ?? p.category_ids ?? p.partner_categories ?? p.categories;
      if (!Array.isArray(src)) return [];
      return src
        .map((c: any) => (typeof c === "object" ? (c.id ?? c.categoryId ?? c.category_id) : c))
        .filter((v: any) => v != null);
    })(),
    working_hours_struct: parseWorkingHoursStruct(p.workingHours ?? p.working_hours),
  };
}

function PartnerDashboard() {
  const navigate = useNavigate();
  const [loading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(() => {
    const real = mapApiPartner(getStoredPartner());
    if (real) return real;
    const sp = loadAgreementStore().partners.find((p) => p.id === DEMO_PARTNER_ID);
    return { ...DEMO_PROFILE, status: sp?.status || "pending" };
  });
  useEffect(() => {
    // Refresh real partner from API
    (async () => {
      try {
        const d = await partnerAuth.me();
        const real = mapApiPartner(d?.partner);
        if (real) setProfile(real);
      } catch { /* ignore */ }
    })();
    // Keep demo-only agreement status in sync (only relevant for demo partner)
    const sync = () => {
      setProfile((prev) => {
        if (!prev || prev.id !== DEMO_PARTNER_ID) return prev;
        const sp = loadAgreementStore().partners.find((p) => p.id === DEMO_PARTNER_ID);
        if (!sp) return prev;
        return { ...prev, status: sp.status, commission_pct: sp.commission_pct ?? prev.commission_pct, deposit_pct: sp.deposit_pct ?? prev.deposit_pct };
      });
    };
    sync();
    return subscribeAgreementStore(sync);
  }, []);
  const [tab, setTab] = useState<Tab>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  async function logout() {
    try { await partnerAuth.logout(); } catch {}
    navigate({ to: "/" });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col bg-background" dir="rtl">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <AlertCircle className="h-12 w-12 text-amber-500" />
          <h2 className="mt-4 text-xl font-extrabold">لم نجد ملف شريك مرتبط بحسابك</h2>
          <p className="mt-2 text-sm text-muted-foreground">سجّل بياناتك أولاً كشريك</p>
          <Link to="/partner" className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">سجّل كشريك</Link>
        </main>
      </div>
    );
  }

  const navItems: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "نظرة عامة", icon: BarChart3 },
    { id: "offers", label: "العروض", icon: Tag },
    { id: "bookings", label: "الحجوزات", icon: Calendar },
    { id: "verify", label: "التحقق من الحجز", icon: ShieldCheck },
    { id: "schedule", label: "الجدول", icon: CalendarDays },
    { id: "analytics", label: "التحليلات", icon: LineChart },
    { id: "wallet", label: "نتائج المبيعات", icon: Wallet },
    { id: "reviews", label: "التقييمات", icon: Star },
    { id: "agreement", label: "الاتفاقية والعمولة", icon: Percent },
    
    { id: "notifications", label: "الإشعارات", icon: Bell },
    { id: "support", label: "الدعم", icon: LifeBuoy },
    { id: "profile", label: "ملف المركز", icon: Store },
  ];

  const activeNav = navItems.find((n) => n.id === tab);

  return (
    <div className="min-h-screen bg-muted/40 flex" dir="rtl">
      {/* Sidebar */}
      <aside
        className={`${mobileOpen ? "translate-x-0" : "translate-x-full"} lg:translate-x-0 fixed lg:sticky top-0 right-0 z-40 h-screen w-72 shrink-0 border-l border-border bg-card transition-transform overflow-y-auto`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <img src={logoImg} alt="logo" className="h-9 w-auto object-contain" />
          <div className="text-[11px] text-muted-foreground">لوحة الشريك</div>
        </div>

        {/* Vendor card */}
        <div className="mx-3 mt-3 rounded-2xl border border-border bg-gradient-to-br from-[#3F2A6B] to-[#E0254D] p-4 text-white">
          <div className="flex items-center gap-3">
            {profile.logo_url ? (
              <img src={profile.logo_url} className="h-11 w-11 rounded-xl object-cover ring-2 ring-white/30" alt="" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold">{profile.vendor_name}</div>
              <div className="truncate text-[11px] text-white/80">{profile.owner_name}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <StatusBadge status={profile.status} />
            <span className="text-[10px] text-white/70">{profile.city}</span>
          </div>
        </div>

        <nav className="p-3 space-y-1 pb-10">
          {navItems.map((n) => {
            const active = tab === n.id;
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => { setTab(n.id); setMobileOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] text-white shadow-sm" : "text-foreground/75 hover:bg-muted"}`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </button>
            );
          })}
          <div className="my-3 h-px bg-border" />
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50">
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </nav>
      </aside>

      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur px-3 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="القائمة"
                className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm hover:bg-muted"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold truncate leading-tight">{activeNav?.label || "لوحة التحكم"}</h1>
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate">إدارة مركزك وعروضك</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={"/" as any}
                title="عرض الموقع"
                className="hidden sm:inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-bold text-foreground/80 hover:border-primary hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>عرض الموقع</span>
              </Link>
              <button
                onClick={() => setTab("notifications")}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted"
                aria-label="الإشعارات"
              >
                <Bell className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {profile.status === "pending" && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <Clock className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="text-sm flex-1">
                <div className="font-bold">حسابك قيد المراجعة</div>
                <div className="mt-0.5 text-amber-700">
                  استلمت الإدارة طلبك. ستراجع بياناتك وترسل لك اتفاقية الشراكة (مع نسبة العمولة/العربون الخاصة بمركزك) في تبويب <button onClick={() => setTab("agreement")} className="font-bold underline">الاتفاقية والعمولة</button>. بمجرد توقيعك على الاتفاقية يتم تفعيل حسابك تلقائياً.
                </div>
              </div>
            </div>
          )}

          {(() => {
            const locked = profile.status !== "active";
            const allowedWhenLocked: Tab[] = ["agreement", "profile"];
            if (locked && !allowedWhenLocked.includes(tab)) {
              return (
                <div className="rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50 p-8 text-center">
                  <Shield className="mx-auto h-12 w-12 text-amber-500" />
                  <h3 className="mt-3 text-lg font-extrabold text-amber-900">هذا القسم مغلق حالياً</h3>
                  <p className="mt-2 text-sm text-amber-800/90 max-w-md mx-auto">
                    لا يمكنك الوصول لهذا القسم قبل توقيع اتفاقية الشراكة وتفعيل حسابك. توجّه لتبويب «الاتفاقية والعمولة» لمراجعة وتوقيع الاتفاقية.
                  </p>
                  <button onClick={() => setTab("agreement")} className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-5 py-2.5 text-sm font-bold text-white shadow">
                    <FileText className="h-4 w-4" /> الذهاب للاتفاقية
                  </button>
                </div>
              );
            }
            return (
              <>
                {tab === "overview" && <OverviewTab partner={profile} onNavigate={setTab} />}
                {tab === "offers" && <OffersTab partner={profile} />}
                {tab === "bookings" && <BookingsTab partner={profile} />}
                {tab === "verify" && <VerifyTab partner={profile} />}
                {tab === "schedule" && <ScheduleTab partner={profile} />}
                {tab === "messages" && <MessagesTab />}
                {tab === "analytics" && <AnalyticsTab />}
                {tab === "wallet" && <WalletTab />}
                {tab === "reviews" && <ReviewsTab />}
                {tab === "agreement" && <AgreementTab partner={profile} onPartnerUpdate={setProfile} />}
                {tab === "notifications" && <NotificationsTab />}
                {tab === "support" && <SupportTab />}
                {tab === "profile" && <ProfileTab partner={profile} onUpdate={setProfile} />}
              </>
            );
          })()}
        </main>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "قيد المراجعة", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    active: { label: "نشط", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    rejected: { label: "مرفوض", cls: "bg-rose-100 text-rose-800 border-rose-200" },
    suspended: { label: "موقوف", cls: "bg-gray-200 text-gray-800 border-gray-300" },
  };
  const c = map[status] || map.pending;
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${c.cls}`}>{c.label}</span>;
}

/* -------------------- Overview -------------------- */
function OverviewTab({ partner, onNavigate }: { partner: Profile; onNavigate: (t: Tab) => void }) {
  const isDemo = partner.id === DEMO_PARTNER_ID;
  const [stats, setStats] = useState({ offers: 0, bookings: 0, revenue: 0, pendingBookings: 0 });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [topOffers, setTopOffers] = useState<Offer[]>([]);
  useEffect(() => {
    (async () => {
      if (isDemo) {
        const list = DEMO_BOOKINGS;
        setStats({
          offers: DEMO_OFFERS.length,
          bookings: list.length,
          revenue: list.filter((b) => b.status === "completed").reduce((s, b) => s + Number(b.amount || 0), 0),
          pendingBookings: list.filter((b) => b.status === "pending").length,
        });
        setRecentBookings(list.slice(0, 4));
        setTopOffers(DEMO_OFFERS.filter((o) => o.status === "active").slice(0, 3));
        return;
      }
      try {
        const [s, b, o]: any[] = await Promise.all([
          partnerApi.stats().catch(() => ({})),
          partnerApi.listBookings({ limit: 4 }).catch(() => ({ items: [] })),
          partnerApi.listOffers({ status: "active", limit: 3 }).catch(() => ({ items: [] })),
        ]);
        const list = (s?.bookings || s?.recentBookings || b?.items || []) as { amount: number | null; partner_amount?: number | null; status: string }[];
        const revenueFromList = list
          .filter((x) => x.status === "completed")
          .reduce((acc, x) => acc + Number(x.partner_amount ?? x.amount ?? 0), 0);
        setStats({
          offers: s?.offers ?? s?.offersCount ?? 0,
          bookings: s?.bookingsCount ?? list.length,
          revenue: s?.partnerEarnings ?? s?.netRevenue ?? s?.totalRevenue ?? s?.revenue ?? revenueFromList,
          pendingBookings: s?.pendingBookings ?? list.filter((x) => x.status === "pending").length,
        });
        setRecentBookings(((b?.items || []) as Booking[]).slice(0, 4));
        setTopOffers(((o?.items || []) as Offer[]).slice(0, 3));
      } catch (e: any) {
        toast.error(e?.message || "تعذّر تحميل الإحصائيات");
      }
    })();
  }, [partner.id, isDemo]);

  const cards = [
    { label: "إجمالي العروض", value: stats.offers, icon: Tag, color: "from-violet-500 to-purple-600" },
    { label: "إجمالي الحجوزات", value: stats.bookings, icon: Calendar, color: "from-pink-500 to-rose-600" },
    { label: "حجوزات بانتظار", value: stats.pendingBookings, icon: Users, color: "from-amber-500 to-orange-600" },
    { label: "الإيرادات (ر.س)", value: stats.revenue.toFixed(2), icon: DollarSign, color: "from-emerald-500 to-teal-600" },
  ];


  const statusMap: Record<string, { label: string; cls: string }> = {
    pending: { label: "بانتظار", cls: "bg-amber-100 text-amber-800" },
    confirmed: { label: "مؤكد", cls: "bg-sky-100 text-sky-800" },
    completed: { label: "مكتمل", cls: "bg-emerald-100 text-emerald-800" },
    cancelled: { label: "ملغي", cls: "bg-rose-100 text-rose-800" },
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-3xl border border-border bg-card p-6">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${c.color} text-white shadow`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-3xl font-black text-foreground">{c.value}</div>
            <div className="mt-1 text-xs font-bold text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-border bg-gradient-to-br from-[#3F2A6B]/5 to-[#E0254D]/5 p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" /> نصيحة لزيادة الحجوزات
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          أضف 3 عروض على الأقل بصور احترافية وأسعار جذابة، وفعّل ساعات العمل في ملف المركز لزيادة ظهورك في نتائج البحث.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          { label: "إضافة عرض جديد", icon: Plus, color: "from-violet-500 to-purple-600", target: "offers" as Tab },
          { label: "مراجعة الحجوزات", icon: Calendar, color: "from-pink-500 to-rose-600", target: "bookings" as Tab },
          { label: "نتائج المبيعات", icon: TrendingUp, color: "from-emerald-500 to-teal-600", target: "wallet" as Tab },
          { label: "تعديل ملف المركز", icon: Store, color: "from-amber-500 to-orange-600", target: "profile" as Tab },
        ]).map((a) => (
          <button key={a.label} onClick={() => onNavigate(a.target)} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-right hover:border-primary hover:shadow-sm transition">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${a.color} text-white`}>
              <a.icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-foreground group-hover:text-primary">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Recent bookings + top offers */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <Calendar className="h-4 w-4 text-primary" /> آخر الحجوزات
            </div>
            <span className="text-[11px] text-muted-foreground">آخر {recentBookings.length} حجوزات</span>
          </div>
          <div className="mt-4 divide-y divide-border">
            {recentBookings.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">لا توجد حجوزات بعد</div>
            ) : recentBookings.map((b) => {
              const s = statusMap[b.status] || statusMap.pending;
              return (
                <div key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-foreground">{b.customer_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {b.booking_date} · {b.booking_time}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-extrabold text-foreground">{Number(b.amount || 0).toFixed(0)} ر.س</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${s.cls}`}>{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <Star className="h-4 w-4 text-amber-500" /> أبرز العروض
          </div>
          <div className="mt-4 space-y-3">
            {topOffers.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">لا توجد عروض نشطة بعد</div>
            ) : topOffers.map((o) => (
              <div key={o.id} className="flex items-center gap-3">
                <img src={o.image_url || ""} alt="" className="h-12 w-12 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-foreground">{o.title}</div>
                  <div className="text-[11px] font-bold text-primary">{o.price} ر.س</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Demo data -------------------- */
const DEMO_OFFERS: Offer[] = [
  { id: "demo-of-1", partner_id: "demo-partner", title: "باقة عروس متكاملة", description: "صبغة + قص + سشوار + مكياج + مانيكير وباديكير.", price: 599, original_price: 1500, image_url: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900&q=80", category: "women-salons", status: "active" },
  { id: "demo-of-2", partner_id: "demo-partner", title: "صبغة شعر احترافية + قص", description: "ألوان عالمية مع علاج عميق للأطراف.", price: 199, original_price: 500, image_url: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=900&q=80", category: "women-salons", status: "active" },
  { id: "demo-of-3", partner_id: "demo-partner", title: "هايدرافيشل + تنظيف بشرة", description: "جلسة كاملة لتنقية البشرة وترطيبها.", price: 249, original_price: 600, image_url: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=900&q=80", category: "women-salons", status: "active" },
  { id: "demo-of-4", partner_id: "demo-partner", title: "مكياج سهرة كامل", description: "إطلالة فاخرة بأيدي خبيرات معتمدات.", price: 299, original_price: 700, image_url: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=900&q=80", category: "women-salons", status: "paused" },
  { id: "demo-of-5", partner_id: "demo-partner", title: "مساج استرخائي 90 دقيقة", description: "مساج بزيوت طبيعية مع جلسة استرخاء.", price: 349, original_price: 900, image_url: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=900&q=80", category: "spa", status: "draft" },
  { id: "demo-of-6", partner_id: "demo-partner", title: "حمام مغربي + تقشير", description: "تجربة سبا متكاملة بمنتجات مغربية أصلية.", price: 249, original_price: 700, image_url: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=900&q=80", category: "spa", status: "active" },
];

const DEMO_BOOKINGS: Booking[] = [
  { id: "demo-b-1", partner_id: "demo-partner", offer_id: "demo-of-1", customer_name: "نورة المطيري", customer_phone: "+966501112233", customer_email: "noura@example.com", booking_date: "2026-05-25", booking_time: "11:00", amount: 599, status: "pending", notes: "تطلب موعد قبل العصر", created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), verify_code: "284913", qty: 1, payment: "deposit", payment_method: "mada", payment_status: "deposit_paid", commission: 60, source: "app" },
  { id: "demo-b-2", partner_id: "demo-partner", offer_id: "demo-of-2", customer_name: "سارة العتيبي", customer_phone: "+966552223344", customer_email: "sara@example.com", booking_date: "2026-05-25", booking_time: "14:30", amount: 199, status: "confirmed", notes: null, created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), verify_code: "591046", qty: 2, payment: "online", payment_method: "visa", payment_status: "paid", commission: 20, source: "web", confirmed_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: "demo-b-3", partner_id: "demo-partner", offer_id: "demo-of-3", customer_name: "ريم الزهراني", customer_phone: "+966563334455", customer_email: null, booking_date: "2026-05-24", booking_time: "10:00", amount: 249, status: "completed", notes: null, created_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), verify_code: "763215", redeemed_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), qty: 1, payment: "online", payment_method: "applepay", payment_status: "paid", commission: 25, source: "app", confirmed_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: "demo-b-4", partner_id: "demo-partner", offer_id: "demo-of-1", customer_name: "هند القحطاني", customer_phone: "+966584445566", customer_email: "hind@example.com", booking_date: "2026-05-26", booking_time: "16:00", amount: 599, status: "confirmed", notes: "زبونة جديدة", created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), verify_code: "428107", qty: 1, payment: "cash", payment_method: "cod", payment_status: "unpaid", commission: 60, source: "app", confirmed_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() },
  { id: "demo-b-5", partner_id: "demo-partner", offer_id: "demo-of-6", customer_name: "منى السبيعي", customer_phone: "+966595556677", customer_email: "mona@example.com", booking_date: "2026-05-23", booking_time: "18:00", amount: 249, status: "cancelled", notes: "ألغت قبل الموعد", created_at: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(), verify_code: "104938", qty: 1, payment: "online", payment_method: "stcpay", payment_status: "refunded", commission: 25, source: "web" },
  { id: "demo-b-6", partner_id: "demo-partner", offer_id: "demo-of-2", customer_name: "لينا الحربي", customer_phone: "+966506667788", customer_email: null, booking_date: "2026-05-27", booking_time: "12:30", amount: 199, status: "pending", notes: null, created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(), verify_code: "672381", qty: 3, payment: "deposit", payment_method: "mayfatoorah", payment_status: "deposit_paid", commission: 20, source: "partner" },
  { id: "demo-b-7", partner_id: "demo-partner", offer_id: "demo-of-3", customer_name: "أمل الشمري", customer_phone: "+966517778899", customer_email: "amal@example.com", booking_date: "2026-05-22", booking_time: "09:00", amount: 249, status: "completed", notes: null, created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), verify_code: "915204", redeemed_at: new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString(), qty: 1, payment: "cash", payment_method: "cod", payment_status: "paid", commission: 25, source: "app", confirmed_at: new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString() },
];

/* -------------------- Offers -------------------- */
function OffersTab({ partner }: { partner: Profile }) {
  const { apiCategories } = useCategories();
  const [items, setItems] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Offer> | null>(null);
  const selectedCategoryId = editing?.category
    ? apiCategories.find((c: any) => c.id === editing.category || c.slug === editing.category)?.id || ""
    : "";

  async function load() {
    setLoading(true);
    if (partner.id === DEMO_PARTNER_ID) {
      setItems(DEMO_OFFERS);
      setLoading(false);
      return;
    }
    try {
      const r: any = await partnerApi.listOffers({ limit: 100 });
      const rows = (r?.items || r || []) as Offer[];
      setItems(rows);
    } catch (e: any) {
      toast.error(e?.message || "تعذّر تحميل العروض");
      setItems([]);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [partner.id]);

  async function save() {
    if (!editing?.title || editing.price == null) {
      toast.error("ادخل العنوان بالعربي والسعر");
      return;
    }
    const matchedCategory = editing.category
      ? apiCategories.find((c: any) => c.id === editing.category || c.slug === editing.category)
      : null;
    if (apiCategories.length > 0 && editing.category && !matchedCategory) {
      toast.error("اختر تصنيفًا صحيحًا من القائمة");
      return;
    }
    const toArr = (v: any): string[] =>
      Array.isArray(v) ? v : typeof v === "string" ? v.split("\n").map((s) => s.trim()).filter(Boolean) : [];
    const imgs = Array.isArray(editing.image_urls) ? editing.image_urls.filter(Boolean) : [];
    const payload = {
      partner_id: partner.id,
      title: editing.title,
      title_en: (editing as any).title_en?.trim() || null,
      description: editing.description || null,
      description_en: (editing as any).description_en?.trim() || null,
      price: Number(editing.price),
      original_price: editing.original_price ? Number(editing.original_price) : null,
      image_url: imgs[0] || editing.image_url || null,
      image_urls: imgs.length ? imgs : (editing.image_url ? [editing.image_url] : []),
      category: matchedCategory?.id || null,
      status: editing.status || "draft",
      duration_minutes: editing.duration_minutes != null && (editing.duration_minutes as any) !== "" ? Number(editing.duration_minutes) : null,
      discount_percent: editing.discount_percent != null && (editing.discount_percent as any) !== "" ? Number(editing.discount_percent) : null,
      terms: toArr((editing as any).terms_text ?? editing.terms),
      terms_en: toArr((editing as any).terms_text_en ?? editing.terms_en),
      overview_bullets: toArr((editing as any).bullets_text ?? editing.overview_bullets),
      overview_bullets_en: toArr((editing as any).bullets_text_en ?? editing.overview_bullets_en),
      valid_from: editing.valid_from || null,
      valid_to: editing.valid_to || null,
    };
    try {
      if (editing.id) {
        await partnerApi.updateOffer(editing.id, payload as any);
      } else {
        await partnerApi.createOffer(payload as any);
      }
      toast.success("تم الحفظ");
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا العرض؟")) return;
    try {
      await partnerApi.deleteOffer(id);
      toast.success("تم الحذف");
      load();
    } catch (e: any) {
      toast.error(e?.message || "فشل الحذف");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-foreground">العروض ({items.length})</h2>
        <button
          onClick={() => setEditing({ title: "", price: 0, status: "draft", category: "" })}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-5 py-2.5 text-sm font-bold text-white shadow"
        >
          <Plus className="h-4 w-4" /> أضف عرض
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          لا توجد عروض بعد — أضف أول عرض!
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((o) => (
            <div key={o.id} className="overflow-hidden rounded-3xl border border-border bg-card">
              {o.image_url && <img src={o.image_url} alt={o.title} className="h-40 w-full object-cover" loading="lazy" />}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-extrabold text-foreground">{o.title}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${o.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                    {o.status === "active" ? "نشط" : o.status === "paused" ? "متوقف" : "مسودة"}
                  </span>
                </div>
                {o.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{o.description}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-lg font-extrabold text-primary">{o.price} ر.س</span>
                  {o.original_price && <span className="text-xs text-muted-foreground line-through">{o.original_price}</span>}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link to="/offers/$offerId" params={{ offerId: o.id }} target="_blank" className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-muted" title="عرض">
                    <Eye className="h-3.5 w-3.5" />
                  </Link>
                  <button onClick={() => setEditing({ ...o, terms_text: (o.terms || []).join("\n"), terms_text_en: (o.terms_en || []).join("\n"), bullets_text: (o.overview_bullets || []).join("\n"), bullets_text_en: (o.overview_bullets_en || []).join("\n") } as any)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-muted">
                    <Edit3 className="h-3.5 w-3.5" /> تعديل
                  </button>
                  <button onClick={() => remove(o.id)} className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-rose-600 hover:bg-rose-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setEditing(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
            style={{ maxHeight: "92vh" }}
          >
            {/* Sticky header */}
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-border bg-white px-5 py-4 sm:px-6">
              <h3 className="text-base font-extrabold sm:text-lg">{editing.id ? "تعديل عرض" : "عرض جديد"}</h3>
              <button onClick={() => setEditing(null)} className="rounded-full p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <div className="space-y-3">
                <Input label="العنوان (عربي) *" value={editing.title || ""} onChange={(v) => setEditing({ ...editing, title: v })} />
                <Input label="Title (English) — optional" value={(editing as any).title_en || ""} onChange={(v) => setEditing({ ...editing, title_en: v } as any)} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold">الوصف (عربي)</label>
                    <textarea
                      rows={3}
                      value={editing.description || ""}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      placeholder="نبذة مفصّلة عن العرض وما يشمله…"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold">Description (English) — optional</label>
                    <textarea
                      rows={3}
                      dir="ltr"
                      value={(editing as any).description_en || ""}
                      onChange={(e) => setEditing({ ...editing, description_en: e.target.value } as any)}
                      placeholder="Detailed description of the offer…"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="السعر (ر.س) *" type="number" value={String(editing.price ?? "")} onChange={(v) => setEditing({ ...editing, price: Number(v) })} />
                  <Input label="السعر قبل الخصم" type="number" value={String(editing.original_price ?? "")} onChange={(v) => setEditing({ ...editing, original_price: v ? Number(v) : null as any })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold">صور العرض (يمكن إضافة أكثر من صورة)</label>
                  {(() => {
                    const imgs: string[] = Array.isArray(editing.image_urls) && editing.image_urls.length
                      ? (editing.image_urls as string[])
                      : (editing.image_url ? [editing.image_url] : []);
                    return (
                      <ImageUploadMulti
                        values={imgs}
                        onChange={(next) => setEditing({ ...editing, image_urls: next, image_url: next[0] || "" })}
                        max={8}
                        folder={`partners/${partner.id || "new"}/offers`}
                      />
                    );
                  })()}
                  <p className="mt-2 text-[11px] text-muted-foreground">أول صورة هي الصورة الرئيسية للعرض.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold">التصنيف</label>
                    <select value={selectedCategoryId} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                      <option value="">— اختر التصنيف —</option>
                      {apiCategories.map((c: any) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold">الحالة</label>
                    <select value={editing.status || "draft"} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                      <option value="draft">مسودة</option>
                      <option value="active">نشط</option>
                      <option value="paused">متوقف</option>
                      <option value="archived">مؤرشف</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="مدة الجلسة (دقيقة)" type="number" value={String((editing.duration_minutes as any) ?? "")} onChange={(v) => setEditing({ ...editing, duration_minutes: v === "" ? null : Number(v) })} />
                  <Input label="نسبة الخصم %" type="number" value={String((editing.discount_percent as any) ?? "")} onChange={(v) => setEditing({ ...editing, discount_percent: v === "" ? null : Number(v) })} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold">تاريخ بداية العرض (اختياري)</label>
                    <input
                      type="date"
                      dir="ltr"
                      value={(editing.valid_from || "").slice(0, 10)}
                      onChange={(e) => setEditing({ ...editing, valid_from: e.target.value || null })}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold">تاريخ نهاية العرض (اختياري)</label>
                    <input
                      type="date"
                      dir="ltr"
                      value={(editing.valid_to || "").slice(0, 10)}
                      onChange={(e) => setEditing({ ...editing, valid_to: e.target.value || null })}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold">نقاط نظرة عامة (عربي — كل نقطة في سطر)</label>
                  <textarea
                    rows={3}
                    value={(editing as any).bullets_text ?? ""}
                    onChange={(e) => setEditing({ ...editing, bullets_text: e.target.value } as any)}
                    placeholder={"أخصائيون معتمدون بخبرة عالية\nأحدث الأجهزة والتقنيات"}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold">Overview bullets (English — one per line) — optional</label>
                  <textarea
                    rows={3}
                    dir="ltr"
                    value={(editing as any).bullets_text_en ?? ""}
                    onChange={(e) => setEditing({ ...editing, bullets_text_en: e.target.value } as any)}
                    placeholder={"Certified expert specialists\nLatest equipment & techniques"}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold">شروط العرض (عربي — كل شرط في سطر)</label>
                  <textarea
                    rows={3}
                    value={(editing as any).terms_text ?? ""}
                    onChange={(e) => setEditing({ ...editing, terms_text: e.target.value } as any)}
                    placeholder={"العرض ساري لمدة 30 يومًا\nيجب الحجز المسبق"}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold">Terms (English — one per line) — optional</label>
                  <textarea
                    rows={3}
                    dir="ltr"
                    value={(editing as any).terms_text_en ?? ""}
                    onChange={(e) => setEditing({ ...editing, terms_text_en: e.target.value } as any)}
                    placeholder={"Valid for 30 days\nAdvance booking required"}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Sticky footer */}
            <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 border-t border-border bg-white px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
              <button onClick={() => setEditing(null)} className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-bold hover:bg-muted">
                إلغاء
              </button>
              <button onClick={save} className="rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-6 py-2.5 text-sm font-extrabold text-white shadow">
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- Bookings -------------------- */
function BookingsTab({ partner }: { partner: Profile }) {
  const { categories } = useCategories();
  const [items, setItems] = useState<Booking[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [vId, setVId] = useState("");
  const [vCode, setVCode] = useState("");
  const [liveEvents, setLiveEvents] = useState<import("@/lib/verifyFeed").VerifyEvent[]>([]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    import("@/lib/verifyFeed").then(({ loadFeed, subscribeVerifyFeed, playSuccessChime }) => {
      setLiveEvents(loadFeed());
      unsub = subscribeVerifyFeed((ev) => {
        setLiveEvents((prev) => [ev, ...prev.filter((p) => p.id !== ev.id)]);
        playSuccessChime();
        toast.success(`تم تأكيد حضور: ${ev.customerName}`, { description: `${ev.offerTitle || "خدمة"} · ${ev.bookingDate} ${ev.bookingTime}` });
      });
    });
    return () => { try { unsub?.(); } catch {} };
  }, []);

  const offerMap = useMemo(() => {
    const m = new Map<string, Offer>();
    offers.forEach((o) => m.set(o.id, o));
    return m;
  }, [offers]);

  async function load() {
    setLoading(true);
    if (partner.id === DEMO_PARTNER_ID) {
      setItems(DEMO_BOOKINGS);
      setOffers(DEMO_OFFERS);
      setLoading(false);
      return;
    }
    try {
      const [b, o] = await Promise.all([
        partnerApi.listBookings({ limit: 200 }) as Promise<any>,
        partnerApi.listOffers({ limit: 100 }) as Promise<any>,
      ]);
      const rows = ((b?.items || b || []) as Booking[]);
      setItems(rows);
      const offerRows = ((o?.items || o || []) as Offer[]);
      setOffers(offerRows);
    } catch (e: any) {
      toast.error(e?.message || "تعذّر تحميل الحجوزات");
      setItems([]); setOffers([]);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [partner.id]);


  async function updateStatus(id: string, status: string, extra?: Partial<Booking>) {
    const stampConfirm = (status === "confirmed" || status === "completed");
    if (id.startsWith("demo-")) {
      setItems((prev) => prev.map((b) => b.id === id ? {
        ...b,
        status,
        ...(stampConfirm && !b.confirmed_at ? { confirmed_at: new Date().toISOString() } : {}),
        ...(extra || {}),
      } : b));
      toast.success("تم التحديث (بيانات تجريبية)");
      return;
    }
    try { await partnerApi.updateBooking(id, { status, ...(extra as any) }); }
    catch (e: any) { toast.error(e?.message || "فشل التحديث"); return; }
    toast.success("تم التحديث");
    load();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const idQ = vId.trim();
    const codeQ = vCode.trim();
    if (!idQ || !codeQ) { toast.error("أدخل رقم الحجز ورمز التحقق"); return; }
    const b = items.find((x) =>
      (x.id.toLowerCase() === idQ.toLowerCase() ||
        x.id.toLowerCase().endsWith(idQ.toLowerCase()) ||
        x.customer_phone.endsWith(idQ))
    );
    if (!b) { toast.error("الحجز غير موجود"); return; }
    if (b.redeemed_at || b.status === "completed") { toast.warning("هذا الحجز مستخدم من قبل"); return; }
    if (b.status === "cancelled") { toast.error("هذا الحجز ملغي"); return; }
    if (b.id.startsWith("demo-")) {
      if ((b.verify_code || "") !== codeQ) { toast.error("الكود غير صحيح"); return; }
      updateStatus(b.id, "completed", { redeemed_at: new Date().toISOString() });
      toast.success(`تم تأكيد حضور: ${b.customer_name}`);
      setVId(""); setVCode("");
      return;
    }
    try {
      await partnerApi.redeemBooking(b.id, codeQ);
      toast.success(`تم تأكيد حضور: ${b.customer_name}`);
      setVId(""); setVCode("");
      load();
    } catch (err: any) {
      toast.error(err?.message || "الكود غير صحيح");
    }
  }

  const filtered = useMemo(() => filter === "all" ? items : items.filter((i) => i.status === filter), [items, filter]);

  return (
    <div className="space-y-6">
      {/* Verify form */}
      <form onSubmit={handleVerify} className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-extrabold">التحقق من حجز العميل</div>
            <div className="text-[11px] text-muted-foreground">أدخل رقم الحجز (أو آخر أرقام الجوال) + رمز التحقق المكوّن من 6 أرقام</div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input value={vId} onChange={(e) => setVId(e.target.value)} placeholder="رقم الحجز أو الجوال" className="h-11 rounded-xl border border-border bg-background px-3 text-sm" dir="ltr" />
          <input value={vCode} onChange={(e) => setVCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="رمز التحقق" maxLength={6} className="h-11 rounded-xl border border-border bg-background px-3 text-center text-base font-black tracking-[0.3em]" dir="ltr" />
          <button type="submit" className="h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
            تأكيد الحضور
          </button>
        </div>
      </form>

      {liveEvents.length > 0 && (
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-emerald-800">تأكيدات الباركود اللحظية</div>
              <div className="text-[11px] text-emerald-700/80">يتم تحديثها فور قراءة العميل للباركود</div>
            </div>
          </div>
          <div className="grid gap-2 max-h-72 overflow-y-auto">
            {liveEvents.slice(0, 10).map((ev) => (
              <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-xs">
                <div className="font-extrabold text-foreground">{ev.customerName}</div>
                <div className="text-muted-foreground">{ev.offerTitle || "خدمة"}</div>
                <div className="text-muted-foreground" dir="ltr">حجز: {ev.bookingDate} · {ev.bookingTime}</div>
                <div className="font-bold text-emerald-700" dir="ltr">تم: {new Date(ev.redeemedAt).toLocaleString("ar-SA")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-foreground">الحجوزات ({items.length})</h2>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {[
            { v: "all", l: "الكل" },
            { v: "pending", l: "بانتظار" },
            { v: "confirmed", l: "مؤكد" },
            { v: "completed", l: "مكتمل" },
            { v: "cancelled", l: "ملغي" },
          ].map((o) => (
            <button key={o.v} onClick={() => setFilter(o.v)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filter === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">لا توجد حجوزات</div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          {filtered.map((b) => {
            const offer = b.offer_id ? offerMap.get(b.offer_id) : undefined;
            const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const rawTitle = (b as any).offer_title || offer?.title || (offer as any)?.titleAr || "";
            const offerTitle = rawTitle && !uuidRe.test(String(rawTitle).trim()) ? String(rawTitle) : "خدمة";
            const offerCategory = offer?.category
              ? (categories.find((c: any) => c.id === offer.category || c.slug === offer.category)?.nameAr || offer.category)
              : null;
            const bookingNumber = (b as any).booking_number || (b as any).qr_code || `#${b.id.replace(/-/g, "").slice(-6).toUpperCase()}`;
            const servicesCount = b.qty ?? 1;
            return (
              <div key={b.id} className="border-b border-border p-5 last:border-b-0 hover:bg-muted/20 transition">
                {/* Header: customer + status */}
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-black">
                      {(b.customer_name || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-foreground">{b.customer_name || "—"}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">{b.customer_phone || "—"}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <BookingStatusBadge status={b.status} redeemed={!!b.redeemed_at} />
                    {b.status === "pending" && (
                      <>
                        <button onClick={() => updateStatus(b.id, "confirmed")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"><Check className="h-3.5 w-3.5" /> تأكيد</button>
                        <button onClick={() => updateStatus(b.id, "cancelled")} className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"><X className="h-3.5 w-3.5" /> إلغاء</button>
                      </>
                    )}
                    {b.status === "confirmed" && (
                      <button onClick={() => updateStatus(b.id, "completed", { redeemed_at: new Date().toISOString() })} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700">إنهاء</button>
                    )}
                  </div>
                </div>

                {/* Service + identifiers */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700">
                    <Tag className="h-3 w-3" /> {offerTitle}
                  </span>
                  {offerCategory && (
                    <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">{offerCategory}</span>
                  )}
                  <span className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-bold text-foreground">× {servicesCount}</span>
                </div>

                {/* Quick info row: booking #, verify code, schedule */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <InfoBox label="رقم الحجز">
                    <span dir="ltr" className="font-mono text-xs font-black tracking-wider text-primary">{bookingNumber}</span>
                  </InfoBox>
                  <InfoBox label="رمز التحقق">
                    {b.verify_code ? (
                      <span dir="ltr" className="font-mono text-xs font-black tracking-[0.2em] text-amber-700">{b.verify_code}</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </InfoBox>
                  <InfoBox label="موعد الحجز">
                    <span dir="ltr" className="text-xs font-bold">{b.booking_date || "—"} {b.booking_time || ""}</span>
                  </InfoBox>
                  <InfoBox label="تاريخ الإنشاء">
                    <span dir="ltr" className="text-xs font-semibold">{b.created_at ? new Date(b.created_at).toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}</span>
                  </InfoBox>
                </div>

                {/* Money + meta strip */}
                {(() => {
                  const totalWithVat = b.amount != null
                    ? Number(b.amount)
                    : (offer?.price != null ? +(Number(offer.price) * 1.15).toFixed(2) : null);
                  const paidOnline = Number(b.deposit_amount ?? b.commission ?? 0);
                  const remaining = totalWithVat != null ? Math.max(0, +(totalWithVat - paidOnline).toFixed(2)) : null;
                  return (
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/20 p-3 text-[11px] sm:grid-cols-4">
                      <div>
                        <div className="font-bold text-muted-foreground">الإجمالي</div>
                        <div className="text-sm font-extrabold" dir="ltr">{totalWithVat != null ? `${totalWithVat} ر.س` : "—"}</div>
                        <div className="text-[10px] text-muted-foreground">شامل 15% ضريبة</div>
                      </div>
                      <div>
                        <div className="font-bold text-muted-foreground">العربون أونلاين</div>
                        <div className="text-sm font-extrabold text-emerald-700" dir="ltr">{paidOnline ? `${paidOnline} ر.س` : "—"}</div>
                        {b.payment_method && <div className="text-[10px] text-muted-foreground">{PAY_METHOD_LABEL[b.payment_method]}</div>}
                      </div>
                      <div>
                        <div className="font-bold text-muted-foreground">المتبقي في المركز</div>
                        <div className="text-sm font-extrabold text-amber-700" dir="ltr">{remaining != null ? `${remaining} ر.س` : "—"}</div>
                      </div>
                      <div>
                        <div className="font-bold text-muted-foreground">المصدر</div>
                        <div className="text-sm font-bold">{b.source ? (SOURCE_LABEL[b.source] || b.source) : "—"}</div>
                        {b.customer_email && <div className="truncate text-[10px] text-muted-foreground" dir="ltr">{b.customer_email}</div>}
                      </div>
                    </div>
                  );
                })()}

                {b.confirmed_at && (
                  <div className="mt-2 text-[11px] text-emerald-700" dir="ltr">
                    ✓ تم التأكيد: {new Date(b.confirmed_at).toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
                  </div>
                )}

                {b.redeemed_at && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-2">
                    <span className="text-[11px] font-bold text-emerald-700">وقت تأكيد الاستخدام</span>
                    <span dir="ltr" className="text-xs font-extrabold text-emerald-800">
                      {new Date(b.redeemed_at).toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}

function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function BookingStatusBadge({ status, redeemed }: { status: string; redeemed?: boolean }) {
  if (redeemed && status === "completed") {
    return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">تم الاستخدام</span>;
  }
  const map: Record<string, { l: string; c: string }> = {
    pending: { l: "بانتظار", c: "bg-amber-100 text-amber-700" },
    confirmed: { l: "مؤكد", c: "bg-emerald-100 text-emerald-700" },
    completed: { l: "مكتمل", c: "bg-violet-100 text-violet-700" },
    cancelled: { l: "ملغي", c: "bg-rose-100 text-rose-700" },
  };
  const c = map[status] || map.pending;
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${c.c}`}>{c.l}</span>;
}

/* -------------------- Profile -------------------- */
function ProfileTab({ partner, onUpdate }: { partner: Profile; onUpdate: (p: Profile) => void }) {
  const { categories } = useCategories();
  const [f, setF] = useState<Profile>({
    ...partner,
    working_hours_struct: partner.working_hours_struct?.length ? partner.working_hours_struct : defaultWorkingHours(),
    category_ids: partner.category_ids || [],
  });
  const [saving, setSaving] = useState(false);
  const upd = <K extends keyof Profile>(k: K, v: Profile[K]) => setF((p) => ({ ...p, [k]: v }));

  // Re-sync form when the partner prop changes (e.g. after /auth/partner/me hydration)
  useEffect(() => {
    setF({
      ...partner,
      working_hours_struct: partner.working_hours_struct?.length ? partner.working_hours_struct : defaultWorkingHours(),
      category_ids: partner.category_ids || [],
    });
  }, [partner]);

  async function save() {
    setSaving(true);
    try {
      const r: any = await partnerApi.updateProfile({
        vendorName: f.vendor_name, ownerName: f.owner_name, category: f.category,
        city: f.city, phone: f.phone, email: f.email, commercialNumber: f.commercial_number,
        logoUrl: f.logo_url, about: f.about, address: f.address, mapsUrl: f.maps_url || null,
        workingHours: (f.working_hours_struct as any) || [],
        nameEn: f.vendor_name_en || "",
        vendorNameEn: f.vendor_name_en || "",
        description: f.description || "",
        descriptionEn: f.description_en || "",
        terms: f.terms || "",
        termsEn: f.terms_en || "",
        aboutEn: f.about_en || "",
        categoryIds: f.category_ids || [],
      } as any);
      // The API returns the raw partner shape (camelCase). Normalize before storing.
      const raw = (r?.partner || r) as any;
      const mapped = mapApiPartner(raw) || f;
      if (raw?.id) setStoredPartner(raw);
      setF(mapped);
      onUpdate(mapped);
      setSaving(false);
      toast.success("تم حفظ الملف");
    } catch (e: any) {
      setSaving(false);
      toast.error(e?.message || "فشل الحفظ");
    }
  }

  const catKey = (c: any) => String(c?.id ?? c?.slug ?? c?.categoryId ?? c?.category_id ?? "");
  const selectedIds = (f.category_ids || []).map((x) => String(x));
  function toggleCat(c: any) {
    const k = catKey(c);
    if (!k) return;
    const cur = new Set(selectedIds);
    if (cur.has(k)) cur.delete(k); else cur.add(k);
    upd("category_ids", Array.from(cur));
  }

  return (
    <div className="space-y-5">
      {/* Basic info */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-extrabold">البيانات الأساسية</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="اسم المركز (عربي)" value={f.vendor_name} onChange={(v) => upd("vendor_name", v)} />
          <div>
            <label className="mb-1.5 block text-xs font-bold">اسم المركز (إنجليزي)</label>
            <input
              dir="ltr"
              value={f.vendor_name_en || ""}
              onChange={(e) => upd("vendor_name_en", e.target.value)}
              placeholder="Center name"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
      <Input label="اسم المسؤول" value={f.owner_name} onChange={(v) => upd("owner_name", v)} />
      <Input label="المدينة" value={f.city || ""} onChange={(v) => upd("city", v)} />
      <Input label="رقم الجوال" value={f.phone} onChange={(v) => upd("phone", v)} />
      <Input label="البريد الإلكتروني" value={f.email || ""} onChange={(v) => upd("email", v)} />
      <Input label="السجل التجاري" value={f.commercial_number || ""} onChange={(v) => upd("commercial_number", v)} />
      <Input label="العنوان التفصيلي" value={f.address || ""} onChange={(v) => upd("address", v)} className="sm:col-span-2" />
      <Input label="رابط الموقع على خرائط جوجل" value={f.maps_url || ""} onChange={(v) => upd("maps_url", v)} placeholder="https://maps.app.goo.gl/..." className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <ImageUpload
              label="شعار المركز"
              value={f.logo_url}
              onChange={(url) => upd("logo_url", url || "")}
              folder={`partners/${f.id || "new"}/logo`}
              aspect="aspect-square"
              className="max-w-[200px]"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-extrabold">تصنيفات المركز</h3>
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-background p-2">
          {(categories || []).length === 0 && (
            <span className="text-xs text-muted-foreground">لا توجد تصنيفات متاحة حالياً.</span>
          )}
          {(categories || []).map((c: any) => {
            const k = catKey(c);
            const selected = selectedIds.includes(k);
            return (
              <button
                type="button"
                key={k || c.nameAr}
                onClick={() => toggleCat(c)}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-bold transition",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                ].join(" ")}
              >
                {c.nameAr || c.name_ar || c.name || c.nameEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description & Terms */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-extrabold">الوصف والشروط</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold">نبذة قصيرة (عربي)</label>
            <textarea value={f.about || ""} onChange={(e) => upd("about", e.target.value)} rows={3} className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold">Short About (English)</label>
            <textarea dir="ltr" value={f.about_en || ""} onChange={(e) => upd("about_en", e.target.value)} rows={3} className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold">وصف المركز (عربي)</label>
            <textarea value={f.description || ""} onChange={(e) => upd("description", e.target.value)} rows={4} placeholder="نبذة عن المركز وخدماته..." className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold">Description (English)</label>
            <textarea dir="ltr" value={f.description_en || ""} onChange={(e) => upd("description_en", e.target.value)} rows={4} placeholder="Brief about the center..." className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold">شروط المركز (عربي)</label>
            <textarea value={f.terms || ""} onChange={(e) => upd("terms", e.target.value)} rows={4} placeholder="سياسة الإلغاء، التحضير قبل الموعد..." className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold">Terms (English)</label>
            <textarea dir="ltr" value={f.terms_en || ""} onChange={(e) => upd("terms_en", e.target.value)} rows={4} placeholder="Cancellation policy, prep before appointment..." className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
          </div>
        </div>
      </div>

      {/* Working hours */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-extrabold">ساعات العمل الأسبوعية</h3>
          <button
            type="button"
            onClick={() => upd("working_hours_struct", defaultWorkingHours())}
            className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold hover:bg-muted"
          >
            استعادة الافتراضي
          </button>
        </div>
        <div className="space-y-2">
          {WEEK_DAYS.map((d, idx) => {
            const cur = (f.working_hours_struct || defaultWorkingHours())[idx] || { day: d.key, open: "09:00", close: "22:00", closed: false };
            const setWh = (patch: Partial<WorkingHour>) => {
              const next = [...(f.working_hours_struct || defaultWorkingHours())];
              next[idx] = { ...cur, ...patch };
              upd("working_hours_struct", next);
            };
            return (
              <div key={d.key} className="grid grid-cols-[80px_1fr_1fr_auto] items-center gap-2">
                <div className="text-xs font-bold">{d.ar}</div>
                <input type="time" disabled={cur.closed} value={cur.open} onChange={(e) => setWh({ open: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-50" />
                <input type="time" disabled={cur.closed} value={cur.close} onChange={(e) => setWh({ close: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-50" />
                <label className="inline-flex items-center gap-1 text-[11px] font-bold">
                  <input
                    type="checkbox"
                    checked={!!cur.closed}
                    onChange={(e) => setWh({ closed: e.target.checked, open: e.target.checked ? "00:00" : "09:00", close: e.target.checked ? "00:00" : "22:00" })}
                  />
                  مغلق
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-6 py-2.5 text-sm font-extrabold text-white shadow disabled:opacity-60">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} حفظ التغييرات
        </button>
      </div>

      {/* Change password */}
      <ChangePasswordSection />
    </div>
  );
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!currentPassword) {
      toast.error("أدخل كلمة المرور الحالية");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("كلمة المرور وتأكيدها غير متطابقين");
      return;
    }
    setSaving(true);
    try {
      await partnerApi.changePassword({ currentPassword, newPassword });
      toast.success("تم تغيير كلمة المرور بنجاح");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e?.message || "فشل تغيير كلمة المرور");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-extrabold">تغيير كلمة المرور</h3>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold hover:bg-muted"
        >
          {show ? "إخفاء" : "إظهار"}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-bold">كلمة المرور الحالية</label>
          <input
            type={show ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold">كلمة المرور الجديدة</label>
          <input
            type={show ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold">تأكيد كلمة المرور</label>
          <input
            type={show ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        يجب أن تكون كلمة المرور 6 أحرف على الأقل. بعد التغيير قد يُطلب منك تسجيل الدخول مجدداً.
      </p>
      <div className="mt-4">
        <button
          onClick={submit}
          disabled={saving || !newPassword || !confirmPassword}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-6 py-2.5 text-sm font-extrabold text-white shadow disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} تحديث كلمة المرور
        </button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, className = "" }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-bold text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

/* -------------------- Verify Booking -------------------- */
function VerifyTab({ partner }: { partner: Profile }) {
  const [bookingId, setBookingId] = useState("");
  const [code, setCode] = useState("");
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<
    | { status: "idle" }
    | { status: "notfound" }
    | { status: "wrong" }
    | { status: "ok"; booking: Booking; alreadyRedeemed: boolean }
  >({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  async function load() {
    setLoading(true);
    if (partner.id === DEMO_PARTNER_ID) {
      setItems(DEMO_BOOKINGS);
      setLoading(false);
      return;
    }
    try {
      const b: any = await partnerApi.listBookings({ limit: 300 });
      setItems(((b?.items || b || []) as Booking[]));
    } catch {
      setItems([]);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [partner.id]);

  function findBooking(idQ: string): Booking | undefined {
    const q = idQ.toLowerCase();
    return items.find((x) => {
      const short = `#${x.id.replace(/-/g, "").slice(-6)}`.toLowerCase();
      return (
        x.id.toLowerCase() === q ||
        x.id.toLowerCase().endsWith(q) ||
        short === q ||
        short.replace("#", "") === q.replace("#", "") ||
        (x.customer_phone || "").endsWith(idQ)
      );
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const idQ = bookingId.trim();
    const codeQ = code.trim();
    if (!idQ || codeQ.length < 4) { toast.error("أدخل رقم الحجز ورمز التحقق"); return; }
    setSubmitting(true);
    const b = findBooking(idQ);
    if (!b) { setResult({ status: "notfound" }); setSubmitting(false); return; }
    if ((b.verify_code || "") !== codeQ) { setResult({ status: "wrong" }); setSubmitting(false); return; }
    const already = !!b.redeemed_at || b.status === "completed";
    setResult({ status: "ok", booking: b, alreadyRedeemed: already });
    setSubmitting(false);
  }

  async function confirmRedeem() {
    if (result.status !== "ok") return;
    const b = result.booking;
    if (b.status === "cancelled") { toast.error("هذا الحجز ملغي"); return; }
    setRedeeming(true);
    try {
      if (b.id.startsWith("demo-")) {
        const stamped: Booking = { ...b, status: "completed", redeemed_at: new Date().toISOString() };
        setItems((prev) => prev.map((x) => x.id === b.id ? stamped : x));
        setResult({ status: "ok", booking: stamped, alreadyRedeemed: true });
      } else {
        await partnerApi.redeemBooking(b.id, code.trim());
        const stamped: Booking = { ...b, status: "completed", redeemed_at: new Date().toISOString() };
        setItems((prev) => prev.map((x) => x.id === b.id ? stamped : x));
        setResult({ status: "ok", booking: stamped, alreadyRedeemed: true });
      }
      toast.success(`تم تأكيد حضور: ${b.customer_name}`);
    } catch (e: any) {
      toast.error(e?.message || "تعذّر تأكيد الحجز");
    } finally {
      setRedeeming(false);
    }
  }

  function reset() {
    setBookingId("");
    setCode("");
    setResult({ status: "idle" });
  }

  const b = result.status === "ok" ? result.booking : null;
  const totalWithVat = b?.amount != null ? Number(b.amount) : null;
  const paidOnline = b ? Number(b.deposit_amount ?? b.commission ?? 0) : 0;
  const remaining = totalWithVat != null ? Math.max(0, +(totalWithVat - paidOnline).toFixed(2)) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-xl">
        {/* Purple header */}
        <div className="bg-gradient-to-r from-[#3F2A6B] to-[#5a3d8f] p-6 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold">التحقق من حجز العميل</h2>
              <p className="text-xs text-white/85">للمراكز فقط — أدخل رقم الحجز ورمز التأكيد</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground text-right">رقم الحجز</label>
            <input
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="BK-XXXXXX"
              dir="ltr"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base font-bold tracking-wider text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground text-right">رمز التأكيد (6 أرقام)</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              inputMode="numeric"
              dir="ltr"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-2xl font-black tracking-[0.4em] text-center text-foreground outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3F2A6B] py-3 text-sm font-bold text-white hover:bg-[#3F2A6B]/90 disabled:opacity-60"
          >
            {submitting || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} تحقّق
          </button>
        </form>

        {result.status === "notfound" && (
          <div className="mx-6 mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            <XCircle className="h-5 w-5 shrink-0" />
            <div className="text-sm font-bold">رقم الحجز غير موجود.</div>
          </div>
        )}
        {result.status === "wrong" && (
          <div className="mx-6 mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            <XCircle className="h-5 w-5 shrink-0" />
            <div className="text-sm font-bold">رمز التأكيد غير صحيح.</div>
          </div>
        )}

        {result.status === "ok" && b && (
          <div className="mx-6 mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50">
            <div className="flex items-center gap-3 bg-emerald-100/60 px-4 py-3 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <div className="text-sm font-extrabold">
                {result.alreadyRedeemed ? "تم استخدام هذا الحجز مسبقاً" : "الحجز صحيح ومؤكد"}
              </div>
            </div>
            <div className="space-y-2 p-4 text-sm">
              <VRow icon={UserIcon} label="العميل" value={b.customer_name || "—"} />
              <VRow icon={Phone} label="الجوال" value={b.customer_phone || "—"} ltr />
              <VRow icon={Calendar} label="التاريخ" value={b.booking_date || "—"} ltr />
              <VRow icon={Clock} label="الوقت" value={b.booking_time || "—"} ltr />
              {remaining != null && remaining > 0 ? (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-amber-800">
                  <span className="text-xs font-bold">يتبقى عند الخدمة</span>
                  <span dir="ltr" className="font-extrabold">{remaining} ر.س</span>
                </div>
              ) : null}
              <div className="flex gap-2 pt-3">
                {!result.alreadyRedeemed && (
                  <button
                    type="button"
                    onClick={confirmRedeem}
                    disabled={redeeming}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {redeeming && <Loader2 className="h-4 w-4 animate-spin" />} تأكيد استخدام الحجز
                  </button>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 rounded-xl border border-border bg-white py-2.5 text-sm font-bold text-foreground hover:border-primary"
                >
                  تحقّق من حجز آخر
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VRow({ icon: Icon, label, value, ltr }: { icon: any; label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-emerald-200/60 pb-1.5 last:border-0">
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="font-bold text-foreground" dir={ltr ? "ltr" : undefined}>{value}</div>
    </div>
  );
}

/* -------------------- Sales Results -------------------- */
function WalletTab() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);


  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, b]: any[] = await Promise.all([
          partnerApi.stats("30d").catch(() => ({})),
          partnerApi.listBookings({ limit: 100 }).catch(() => ({ items: [] })),
        ]);
        setStats(s || {});
        setBookings((b?.items || []) as Booking[]);
      } catch (e: any) {
        toast.error(e?.message || "تعذر تحميل النتائج");
      }
      setLoading(false);
    })();
  }, []);

  const completed = bookings.filter((x) => x.status === "completed");
  const totalSales = completed.reduce((s, b: any) => s + Number(b.partner_amount ?? b.amount ?? 0), 0);
  const monthSales = Number(stats?.totalRevenue ?? 0);
  const completedCount = completed.length;
  const platformCommission = Number(stats?.totalCommission ?? 0);
  const depositsForwarded = completed.reduce((s, b: any) => s + Number(b.deposit_amount || 0), 0);
  const cashAtService = Math.max(0, totalSales - depositsForwarded);

  const cards = [
    { label: "إجمالي المبيعات", value: `${totalSales.toLocaleString()} ر.س`, icon: TrendingUp, color: "from-violet-500 to-purple-600" },
    { label: "مبيعات آخر 30 يوم", value: `${monthSales.toLocaleString()} ر.س`, icon: BarChart3, color: "from-emerald-500 to-teal-600" },
    { label: "حجوزات مكتملة", value: `${completedCount}`, icon: Check, color: "from-sky-500 to-indigo-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground leading-7">
        💡 العميل يدفع <span className="font-extrabold text-primary">العربون</span> للمنصة لتأكيد الحجز، ويسلّمك <span className="font-extrabold text-primary">المبلغ المتبقي</span> مباشرة عند الحضور. هذه الشاشة لمتابعة نتائج مبيعاتك فقط.
      </div>

      {loading && <div className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-3xl border border-border bg-card p-6">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${c.color} text-white shadow`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-2xl font-black text-foreground" dir="ltr">{c.value}</div>
            <div className="mt-1 text-xs font-bold text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="text-xs font-bold text-muted-foreground">المحصّل منك مباشرة عند الخدمة</div>
          <div className="mt-2 text-xl font-black text-emerald-600" dir="ltr">{cashAtService.toLocaleString()} ر.س</div>
          <p className="mt-2 text-xs text-muted-foreground leading-6">المبلغ الذي قبضته نقداً أو بالشبكة من العميل في مركزك.</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="text-xs font-bold text-muted-foreground">عربون / عمولة المنصة</div>
          <div className="mt-2 text-xl font-black text-rose-600" dir="ltr">{platformCommission.toLocaleString()} ر.س</div>
          <p className="mt-2 text-xs text-muted-foreground leading-6">العربون الذي حصّلته المنصة من العملاء — وهو نفسه عمولة المنصة المتفق عليها.</p>
        </div>
      </div>


      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="border-b border-border p-5">
          <h3 className="text-lg font-extrabold text-foreground">سجل المبيعات</h3>
          <p className="mt-1 text-xs text-muted-foreground">تفاصيل كل عملية بيع: السعر الكامل، العربون عبر المنصة، والمتبقي الذي قبضته منك مباشرة.</p>
        </div>
        <div className="hidden grid-cols-12 gap-3 border-b border-border bg-muted/40 p-4 text-xs font-bold text-muted-foreground sm:grid">
          <div className="col-span-2">المرجع</div>
          <div className="col-span-3">الخدمة</div>
          <div className="col-span-2">التاريخ</div>
          <div className="col-span-2 text-end">العربون (المنصة)</div>
          <div className="col-span-2 text-end">قبضته عند الخدمة</div>
          <div className="col-span-1 text-end">الإجمالي</div>
        </div>
        {completed.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">لا توجد مبيعات بعد</div>
        ) : completed.map((t: any) => {
          const dep = Number(t.deposit_amount || 0);
          const total = Number(t.amount || 0);
          const cash = Math.max(0, total - dep);
          return (
            <div key={t.id} className="grid grid-cols-1 gap-2 border-b border-border p-4 last:border-b-0 sm:grid-cols-12 sm:items-center">
              <div className="text-xs font-bold text-muted-foreground sm:col-span-2" dir="ltr">#{String(t.id).slice(0, 8)}</div>
              <div className="text-sm font-bold sm:col-span-3">{t.offer_title || "—"}</div>
              <div className="text-xs text-muted-foreground sm:col-span-2">{t.booking_date} {t.booking_time || ""}</div>
              <div className="text-sm font-extrabold text-sky-600 sm:col-span-2 sm:text-end" dir="ltr">{dep.toFixed(0)} ر.س</div>
              <div className="text-sm font-extrabold text-emerald-600 sm:col-span-2 sm:text-end" dir="ltr">{cash.toFixed(0)} ر.س</div>
              <div className="text-sm font-extrabold text-foreground sm:col-span-1 sm:text-end" dir="ltr">{total.toFixed(0)} ر.س</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* -------------------- Reviews -------------------- */
function ReviewsTab() {
  type RV = { id: string; name: string; offer: string; rating: number; date: string; text: string; reply?: string | null };
  const [reviews, setReviews] = useState<RV[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r: any = await partnerApi.listReviews({ pageSize: 50 });
      const rows: RV[] = (r?.items || []).map((x: any) => ({
        id: String(x.id),
        name: x.customerName || x.customer_name || x.user?.name || "عميل",
        offer: x.offerTitle || x.offer_title || x.offer?.title || "—",
        rating: Number(x.rating || 5),
        date: x.createdAt || x.created_at || "",
        text: x.comment || x.text || "",
        reply: x.partnerReply || x.partner_reply || x.reply || null,
      }));
      setReviews(rows);
    } catch {
      setReviews([]);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function sendReply(id: string) {
    if (!replyText.trim()) { toast.error("اكتب الرد أولاً"); return; }
    setSending(true);
    try {
      await partnerApi.replyReview(id, replyText.trim());
      toast.success("تم إرسال الرد");
      setReplyId(null); setReplyText("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "فشل إرسال الرد");
    } finally {
      setSending(false);
    }
  }

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "0.0";

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-3xl border border-border bg-card p-6 sm:col-span-1">
          <div className="text-4xl font-black text-foreground">{avg}</div>
          <div className="mt-1 flex text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400" />)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{reviews.length} تقييم</div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 sm:col-span-3">
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((l) => {
              const c = reviews.filter((r) => r.rating === l).length;
              const p = reviews.length ? Math.round((c / reviews.length) * 100) : 0;
              return (
                <div key={l} className="flex items-center gap-2 text-xs">
                  <span className="w-3 font-bold">{l}</span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${p}%` }} />
                  </div>
                  <span className="w-14 text-end text-muted-foreground">{c} ({p}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {reviews.map((rv) => (
          <div key={rv.id} className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {rv.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">{rv.name}</div>
                  <div className="text-xs text-muted-foreground">{rv.offer} · {rv.date}</div>
                </div>
              </div>
              <div className="flex text-amber-500">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className={`h-3.5 w-3.5 ${j < rv.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                ))}
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{rv.text}</p>

            {rv.reply ? (
              <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                  <Check className="h-3 w-3" /> ردك على العميل
                </div>
                <p className="text-xs leading-6 text-emerald-900">{rv.reply}</p>
              </div>
            ) : replyId === rv.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  placeholder="اكتب ردك للعميل..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={sending}
                    onClick={() => sendReply(rv.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    {sending && <Loader2 className="h-3 w-3 animate-spin" />} إرسال الرد
                  </button>
                  <button
                    onClick={() => { setReplyId(null); setReplyText(""); }}
                    className="rounded-full border border-border px-4 py-2 text-xs font-bold hover:bg-muted"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <button
                  onClick={() => { setReplyId(rv.id); setReplyText(""); }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> الرد على العميل
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------- Notifications (live) -------------------- */
function NotificationsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await partnerApi.listNotifications({ pageSize: 100 });
      setItems(r?.items || []);
    } catch (e: any) {
      toast.error(e?.message || "تعذر تحميل الإشعارات");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    try {
      await partnerApi.markAllNotificationsRead();
      setItems((xs) => xs.map((n) => ({ ...n, read: true })));
      toast.success("تم وضع علامة مقروء على الكل");
    } catch (e: any) {
      toast.error(e?.message || "فشل التحديث");
    }
  };

  const markOne = async (id: string) => {
    try {
      await partnerApi.markNotificationRead(id);
      setItems((xs) => xs.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {}
  };

  const iconFor = (type?: string) => {
    if (type === "booking") return { I: Calendar, c: "from-pink-500 to-rose-600" };
    if (type === "review") return { I: Star, c: "from-amber-500 to-orange-600" };
    if (type === "payout" || type === "wallet") return { I: DollarSign, c: "from-emerald-500 to-teal-600" };
    if (type === "alert" || type === "warning") return { I: AlertCircle, c: "from-blue-500 to-cyan-600" };
    return { I: Bell, c: "from-violet-500 to-purple-600" };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-foreground">الإشعارات</h2>
        <button onClick={markAll} className="text-xs font-bold text-primary hover:underline">
          تحديد الكل كمقروء
        </button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>
        ) : items.map((n) => {
          const { I, c } = iconFor(n.type);
          const unread = !n.read;
          return (
            <button key={n.id} onClick={() => unread && markOne(n.id)} className={`flex w-full items-start gap-3 border-b border-border p-4 text-start last:border-b-0 ${unread ? "bg-primary/5" : ""}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c} text-white shadow`}>
                <I className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-foreground">{n.title}</div>
                  <div className="shrink-0 text-[11px] text-muted-foreground">{n.createdAt ? new Date(n.createdAt).toLocaleString("ar") : ""}</div>
                </div>
                {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
              </div>
              {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------- Schedule (Demo) -------------------- */
function ScheduleTab({ partner }: { partner: Profile }) {
  const days = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const defaults = days.map((d) => ({ day: d, open: "10:00", close: "23:00", closed: d === "الجمعة" }));

  // Try to parse partner.working_hours as JSON; fall back to defaults
  const initial = useMemo(() => {
    const raw = partner.working_hours;
    if (raw && typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 7) return parsed;
      } catch { /* not JSON, ignore */ }
    }
    if (raw && Array.isArray(raw as any) && (raw as any).length === 7) return raw as any;
    return defaults;
  }, [partner.working_hours]);

  const [hours, setHours] = useState<Array<{ day: string; open: string; close: string; closed: boolean }>>(initial);
  const [saving, setSaving] = useState(false);

  // Load from dedicated weekly endpoint on mount (more authoritative)
  useEffect(() => {
    let alive = true;
    partnerApi.getWeeklySchedule()
      .then((r: any) => {
        if (!alive) return;
        const wh = r?.workingHours;
        let parsed: any = wh;
        if (typeof wh === "string") {
          try { parsed = JSON.parse(wh); } catch { parsed = null; }
        }
        if (Array.isArray(parsed) && parsed.length === 7) setHours(parsed);
      })
      .catch(() => { /* ignore — fall back to profile value */ });
    return () => { alive = false; };
  }, []);

  function upd(i: number, k: "open" | "close" | "closed", v: any) {
    setHours((h) => h.map((d, idx) => (idx === i ? { ...d, [k]: v } : d)));
  }

  async function saveHours() {
    setSaving(true);
    try {
      await partnerApi.setWeeklySchedule(hours);
      toast.success("تم حفظ الجدول");
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    }
    setSaving(false);
  }


  // Per-date slot/day blocking (backend-driven)
  const vendorId = partner.id;
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const slots = useMemo(() => generateTimeSlots(60), []);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [dayOff, setDayOff] = useState(false);
  const [blockedLoading, setBlockedLoading] = useState(false);

  useEffect(() => {
    if (!vendorId || !date) return;
    let alive = true;
    setBlockedLoading(true);
    partnerApi.getBlockedDate(date)
      .then((r) => { if (!alive) return; setBlocked(r.slots || []); setDayOff(!!r.dayOff); })
      .catch(() => { if (!alive) return; setBlocked([]); setDayOff(false); })
      .finally(() => { if (alive) setBlockedLoading(false); });
    return () => { alive = false; };
  }, [vendorId, date]);

  async function handleToggleSlot(t: string) {
    if (dayOff || blockedLoading) return;
    try {
      const r = await partnerApi.toggleBlockedSlot(date, t);
      setBlocked(r.slots || []);
      setDayOff(!!r.dayOff);
    } catch (e: any) {
      toast.error(e?.message || "تعذر تحديث الوقت");
    }
  }
  async function handleToggleDay() {
    try {
      const r = await partnerApi.setBlockedDayOff(date, !dayOff);
      setDayOff(!!r.dayOff);
      setBlocked(r.slots || []);
      toast.success(r.dayOff ? "تم تعطيل اليوم بالكامل" : "تم تفعيل اليوم");
    } catch (e: any) {
      toast.error(e?.message || "تعذر تحديث اليوم");
    }
  }


  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-foreground">ساعات العمل الأسبوعية</h3>
            <p className="mt-1 text-xs text-muted-foreground">حدّد أوقات استقبال الحجوزات لكل يوم.</p>
          </div>
          <button onClick={saveHours} disabled={saving} className="rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-5 py-2.5 text-sm font-bold text-white shadow disabled:opacity-60">
            {saving ? "جارٍ الحفظ…" : "حفظ الجدول"}
          </button>
        </div>
        <div className="space-y-2">
          {hours.map((d, i) => (
            <div key={d.day} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3">
              <div className="w-20 text-sm font-bold">{d.day}</div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={!d.closed} onChange={(e) => upd(i, "closed", !e.target.checked)} />
                مفتوح
              </label>
              <div className="flex flex-1 items-center gap-2">
                <input type="time" disabled={d.closed} value={d.open} onChange={(e) => upd(i, "open", e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs disabled:opacity-40" />
                <span className="text-xs text-muted-foreground">—</span>
                <input type="time" disabled={d.closed} value={d.close} onChange={(e) => upd(i, "close", e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs disabled:opacity-40" />
              </div>
              {d.closed && <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">إجازة</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Per-date blocking */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-foreground">تعطيل يوم أو ساعات معيّنة</h3>
            <p className="mt-1 text-xs text-muted-foreground">لو صار زحمة، عطّل يوم كامل أو ساعات محددة. المواعيد المعطّلة تختفي من خيارات الحجز عند العميل.</p>
          </div>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary [color-scheme:light]"
          />
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
          <div className="text-sm font-bold">
            تعطيل اليوم بالكامل ({date})
            {dayOff && <span className="ms-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-extrabold text-rose-700">معطّل بالكامل</span>}
          </div>
          <button
            type="button"
            onClick={handleToggleDay}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
              dayOff ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-rose-600 text-white hover:bg-rose-700"
            }`}
          >
            {dayOff ? "تفعيل اليوم" : "تعطيل اليوم كامل"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {slots.map((s) => {
            const isBlocked = dayOff || blocked.includes(s);
            return (
              <button
                key={s}
                type="button"
                disabled={dayOff}
                onClick={() => handleToggleSlot(s)}
                className={`rounded-xl border-2 px-3 py-3 text-sm font-extrabold transition ${
                  isBlocked
                    ? "border-dashed border-rose-300 bg-rose-50 text-rose-600 line-through"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400"
                } ${dayOff ? "opacity-60 cursor-not-allowed" : ""}`}
                title={dayOff ? "اليوم معطّل بالكامل" : isBlocked ? "اضغط للتفعيل" : "اضغط للتعطيل"}
              >
                {s}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border-2 border-emerald-200 bg-emerald-50" />
            متاح
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border-2 border-dashed border-rose-300 bg-rose-50" />
            معطّل
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Messages (live) -------------------- */
function MessagesTab() {
  const [threads, setThreads] = useState<any[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<{ thread: any; messages: any[] } | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const loadThreads = async () => {
    setLoadingThreads(true);
    try {
      const r = await partnerApi.listMessageThreads();
      const items = r?.items || [];
      setThreads(items);
      if (!activeId && items[0]) setActiveId(items[0].id);
    } catch (e: any) {
      toast.error(e?.message || "تعذر تحميل المحادثات");
    }
    setLoadingThreads(false);
  };
  useEffect(() => { loadThreads(); }, []);

  useEffect(() => {
    if (!activeId) { setActive(null); return; }
    let alive = true;
    setLoadingMsgs(true);
    (async () => {
      try {
        const r = await partnerApi.getMessageThread(activeId);
        if (!alive) return;
        setActive({ thread: r?.thread, messages: r?.messages || [] });
        await partnerApi.markThreadRead(activeId).catch(() => {});
        setThreads((xs) => xs.map((t) => (t.id === activeId ? { ...t, unreadCount: 0 } : t)));
      } catch (e: any) {
        toast.error(e?.message || "تعذر تحميل الرسائل");
      }
      setLoadingMsgs(false);
    })();
    return () => { alive = false; };
  }, [activeId]);

  const send = async () => {
    if (!activeId || !text.trim()) return;
    setSending(true);
    try {
      const r = await partnerApi.sendMessage(activeId, text.trim());
      setActive((cur) => cur ? { ...cur, messages: [...cur.messages, r.message] } : cur);
      setText("");
    } catch (e: any) {
      toast.error(e?.message || "فشل الإرسال");
    }
    setSending(false);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr] md:h-[560px]">
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="border-b border-border p-4 text-sm font-extrabold">المحادثات</div>
        <div className="max-h-[500px] overflow-y-auto">
          {loadingThreads ? (
            <div className="flex items-center justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">لا توجد محادثات</div>
          ) : threads.map((th) => {
            const subj = th.subject || "محادثة";
            const last = th.lastMessage?.text || "";
            const time = th.lastMessage?.createdAt || th.updatedAt || th.createdAt;
            return (
              <button key={th.id} onClick={() => setActiveId(th.id)} className={`flex w-full items-start gap-3 border-b border-border p-3 text-start transition hover:bg-muted/30 ${activeId === th.id ? "bg-primary/5" : ""}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{subj.charAt(0)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-bold">{subj}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{time ? new Date(time).toLocaleDateString("ar") : ""}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">{last}</span>
                    {th.unreadCount > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{th.unreadCount}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card">
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">اختر محادثة</div>
        ) : loadingMsgs || !active ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="text-sm font-extrabold">{active.thread?.subject || "محادثة"}</div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
              {active.messages.length === 0 && (
                <div className="text-center text-xs text-muted-foreground">لا توجد رسائل بعد</div>
              )}
              {active.messages.map((m) => {
                const mine = m.sender === "partner";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-gradient-to-br from-[#3F2A6B] to-[#E0254D] text-white" : "bg-card border border-border"}`}>
                      <div>{m.text}</div>
                      <div className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-muted-foreground"}`}>{m.createdAt ? new Date(m.createdAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 border-t border-border p-3">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !sending && send()} placeholder="اكتب رسالتك…" className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-primary" />
              <button onClick={send} disabled={sending || !text.trim()} className="rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] p-3 text-white shadow disabled:opacity-50">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------- Analytics -------------------- */
function AnalyticsTab() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [stats, setStats] = useState<any>(null);
  const [topOffers, setTopOffers] = useState<{ name: string; bookings: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, b]: any[] = await Promise.all([
          partnerApi.stats(range).catch(() => ({})),
          partnerApi.listBookings({ limit: 200 }).catch(() => ({ items: [] })),
        ]);
        setStats(s || {});
        const bookings = (b?.items || []) as any[];
        const grouped: Record<string, { name: string; bookings: number; revenue: number }> = {};
        for (const bk of bookings) {
          const key = bk.offer_id || bk.offer_title || "—";
          const name = bk.offer_title || "—";
          if (!grouped[key]) grouped[key] = { name, bookings: 0, revenue: 0 };
          grouped[key].bookings += 1;
          if (bk.status === "completed") grouped[key].revenue += Number(bk.partner_amount ?? bk.amount ?? 0);
        }
        setTopOffers(Object.values(grouped).sort((a, b) => b.bookings - a.bookings).slice(0, 5));
      } catch (e: any) {
        toast.error(e?.message || "تعذّر تحميل التحليلات");
      }
      setLoading(false);
    })();
  }, [range]);

  const daily: { day: string; bookings: number; revenue: number; commission?: number }[] =
    stats?.daily || stats?.dailyBreakdown || [];
  const totalRevenue = Number(stats?.totalRevenue ?? 0);
  const totalCommission = Number(stats?.totalCommission ?? 0);
  const totalBookings = Number(stats?.totalBookings ?? 0);
  const netRevenue = Number(stats?.netRevenue ?? (totalRevenue - totalCommission));
  const avgValue = totalBookings > 0 ? (totalRevenue / totalBookings) : 0;

  const kpis = [
    { label: "إجمالي الإيرادات", value: `${totalRevenue.toLocaleString()} ر.س`, icon: TrendingUp, color: "from-violet-500 to-purple-600" },
    { label: "صافي بعد العمولة", value: `${netRevenue.toLocaleString()} ر.س`, icon: DollarSign, color: "from-emerald-500 to-teal-600" },
    { label: "عمولة المنصة", value: `${totalCommission.toLocaleString()} ر.س`, icon: Zap, color: "from-pink-500 to-rose-600" },
    { label: "متوسط قيمة الحجز", value: `${avgValue.toFixed(0)} ر.س`, icon: Users, color: "from-amber-500 to-orange-600" },
  ];

  const chart = daily.map((d) => Number(d.revenue || 0));
  const max = Math.max(1, ...chart);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">التحليلات</h2>
        <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs font-bold">
          {(["7d", "30d", "90d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-4 py-1.5 transition ${range === r ? "bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              {r === "7d" ? "7 أيام" : r === "30d" ? "30 يوم" : "90 يوم"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-3xl border border-border bg-card p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${k.color} text-white shadow`}><k.icon className="h-5 w-5" /></div>
            <div className="mt-3 text-2xl font-black" dir="ltr">{k.value}</div>
            <div className="mt-1 text-xs font-bold text-muted-foreground">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold">الإيرادات اليومية</h3>
          <span className="text-xs text-muted-foreground">{daily.length} يوم</span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>
        ) : chart.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">لا توجد بيانات بعد لعرضها</div>
        ) : (
          <div className="flex h-48 items-end gap-1.5 overflow-x-auto">
            {chart.map((v, i) => (
              <div key={i} className="flex min-w-[20px] flex-1 flex-col items-center gap-1" title={`${daily[i]?.day}: ${v} ر.س`}>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-[#3F2A6B] to-[#E0254D]" style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? "4px" : "0" }} />
                <div className="text-[9px] text-muted-foreground">{(daily[i]?.day || "").slice(-2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-extrabold">أكثر العروض حجزاً</h3>
        {topOffers.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">لا توجد حجوزات بعد</div>
        ) : (
          <div className="space-y-3">
            {topOffers.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-extrabold text-primary">{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.bookings} حجز</div>
                </div>
                <div className="text-sm font-extrabold" dir="ltr">{t.revenue.toLocaleString()} ر.س</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Agreement & Commission -------------------- */
type CommissionRequest = {
  id: string;
  requested_commission_pct: number;
  requested_deposit_pct: number;
  current_commission_pct: number | null;
  current_deposit_pct: number | null;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

function AgreementTab({ partner, onPartnerUpdate }: { partner: Profile; onPartnerUpdate?: (p: Profile | null | ((prev: Profile | null) => Profile | null)) => void }) {
  const [adminAgreement, setAdminAgreementState] = useState<any>(null);
  const setAdminAgreement = setAdminAgreementState;
  const currentCommission = Number(adminAgreement?.commission_pct ?? partner.commission_pct ?? 10);
  const currentDeposit = Number(adminAgreement?.deposit_pct ?? partner.deposit_pct ?? 20);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [requests, setRequests] = useState<CommissionRequest[]>([]);
  const [reqCommission, setReqCommission] = useState<number>(currentCommission);
  const [reqDeposit, setReqDeposit] = useState<number>(currentDeposit);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [adminTemplate, setAdminTemplate] = useState<any>(null);
  const [viewing, setViewing] = useState(false);
  const [qr, setQr] = useState<{ qrUrl: string; qrPngBase64: string | null } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const partnerForAgreement = useMemo(() => {
    if (partner.id === DEMO_PARTNER_ID) {
      const s = loadAgreementStore();
      return s.partners.find((p) => p.id === DEMO_PARTNER_ID) || null;
    }
    return {
      id: partner.id ?? "",
      vendor_name: partner.vendor_name ?? "",
      owner_name: partner.owner_name ?? "",
      commercial_number: partner.commercial_number ?? "",
      phone: partner.phone ?? "",
      email: partner.email ?? "",
      city: partner.city ?? "",
      commission_pct: partner.commission_pct ?? 10,
      deposit_pct: partner.deposit_pct ?? 20,
    } as any;
  }, [partner]);

  const viewHtml = useMemo(() => {
    if (!adminAgreement || !partnerForAgreement) return "";
    let tpl: any = null;
    if (partner.id === DEMO_PARTNER_ID) {
      const s = loadAgreementStore();
      tpl = adminAgreement.template_id ? s.templates.find((t) => t.id === adminAgreement.template_id) || null : null;
    } else {
      tpl = adminTemplate;
    }
    return buildAgreementHtmlForPartner(partnerForAgreement, adminAgreement, tpl);
  }, [adminAgreement, adminTemplate, partnerForAgreement, partner.id]);

  const signedAgreementClauses = useMemo(() => {
    if (adminAgreement == null) return [] as string[];
    let tpl: any = null;
    if (partner.id === DEMO_PARTNER_ID) {
      const s = loadAgreementStore();
      tpl = adminAgreement.template_id ? s.templates.find((t) => t.id === adminAgreement.template_id) || null : null;
    } else {
      tpl = adminTemplate;
    }
    const rawBody =
      tpl?.resolvedBody ??
      tpl?.body ??
      adminAgreement?.custom_body ??
      adminAgreement?.body ??
      "";
    const safeBody = typeof rawBody === "string" ? rawBody : String(rawBody ?? "");
    const renderedBody = safeBody
      .replace(/\{commission_pct\}/g, String(adminAgreement?.commission_pct ?? ""))
      .replace(/\{deposit_pct\}/g, String(adminAgreement?.deposit_pct ?? ""));

    return renderedBody
      .split(/\n+/)
      .map((line: string) => line.trim())
      .map((line: string) => line.replace(/^\d+[\.)\-–—:]?\s*/, ""))
      .filter(Boolean);
  }, [adminAgreement, adminTemplate, partner.id]);

  function normalizeAgreement(a: any): any {
    if (!a) return null;
    return {
      ...a,
      id: a.id ?? a._id ?? a.agreementId ?? null,
      partner_id: a.partner_id ?? a.partnerId,
      template_id: a.template_id ?? a.templateId,
      template_version: a.template_version ?? a.templateVersion,
      commission_pct: a.commission_pct ?? a.commissionPct,
      deposit_pct: a.deposit_pct ?? a.depositPct,
      signed_name: a.signed_name ?? a.signedName,
      signed_at: a.signed_at ?? a.signedAt,
      signature_image: a.signature_image ?? a.signatureImage,
      admin_notes: a.admin_notes ?? a.adminNotes,
      custom_title: a.custom_title ?? a.customTitle,
      custom_body: a.custom_body ?? a.customBody,
      created_at: a.created_at ?? a.createdAt ?? new Date().toISOString(),
    };
  }

  useEffect(() => {
    (async () => {
      if (partner.id === DEMO_PARTNER_ID) {
        setOffers(DEMO_OFFERS);
        setRequests([
          { id: "demo-r-1", requested_commission_pct: 8, requested_deposit_pct: 20, current_commission_pct: 10, current_deposit_pct: 20, reason: "تجاوزنا 500 حجز شهرياً ونطلب مراجعة العمولة.", status: "pending", admin_notes: null, created_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString() },
          { id: "demo-r-2", requested_commission_pct: 12, requested_deposit_pct: 25, current_commission_pct: 15, current_deposit_pct: 25, reason: null, status: "approved", admin_notes: "تمت الموافقة لحسن الأداء.", created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() },
        ]);
        const syncAg = () => {
          const s = loadAgreementStore();
          const latest = s.agreements
            .filter((a) => a.partner_id === DEMO_PARTNER_ID)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          setAdminAgreement(latest || null);
        };
        syncAg();
        const unsub = subscribeAgreementStore(syncAg);
        return () => unsub();
      }
      const [oRes, rRes, agRes] = await Promise.allSettled([
        partnerApi.listOffers({ limit: 100 }),
        partnerApi.listCommissionRequests(),
        partnerApi.getAgreement(),
      ]);
      if (oRes.status === "fulfilled") {
        const o: any = oRes.value;
        setOffers((o?.items || o || []) as Offer[]);
      }
      if (rRes.status === "fulfilled") {
        const r: any = rRes.value;
        setRequests((r?.items || r || []) as CommissionRequest[]);
      }
      if (agRes.status === "fulfilled") {
        const ag: any = agRes.value;
        // Support multiple response shapes:
        //   { agreement: {...} }
        //   { data: { agreement: {...} } }
        //   { success: true, data: { agreement: null } }
        const rawAg = ag?.data?.agreement ?? ag?.agreement ?? null;
        const normAg = normalizeAgreement(rawAg);
        setAdminAgreement(normAg);
        const tpl0 = ag?.template || null;
        if (tpl0) setAdminTemplate(tpl0);
        if (normAg?.id) {
          try {
            const full: any = await partnerApi.getAgreementById(normAg.id);
            const fullAg = normalizeAgreement(full?.data?.agreement ?? full?.agreement ?? full);
            if (fullAg?.id) setAdminAgreement(fullAg);
            const tpl = full?.data?.template ?? full?.template ?? full?.agreement?.template ?? null;
            if (tpl) setAdminTemplate(tpl);
          } catch { /* ignore */ }
        }
      } else {
        console.error("[partner-dashboard] getAgreement failed:", agRes.reason);
      }
    })();
  }, [partner.id]);

  useEffect(() => {
    if (partner.id === DEMO_PARTNER_ID) return;
    if (adminAgreement?.status !== "signed") { setQr(null); return; }
    let cancelled = false;
    (async () => {
      setQrLoading(true);
      try {
        const d = await partnerApi.getAgreementQr();
        if (!cancelled) setQr({ qrUrl: d.qrUrl, qrPngBase64: d.qrPngBase64 });
      } catch { /* ignore */ }
      finally { if (!cancelled) setQrLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [partner.id, adminAgreement?.status, adminAgreement?.id]);



  const [signing, setSigning] = useState(false);
  function openSignDialog() {
    if (!adminAgreement) return;
    setSigning(true);
  }
  async function confirmSign(name: string, signatureDataUrl: string) {
    if (!adminAgreement) return;
    if (partner.id === DEMO_PARTNER_ID) {
      const s = loadAgreementStore();
      s.agreements = s.agreements.map((a) =>
        a.id === adminAgreement.id
          ? { ...a, status: "signed", signed_name: name, signed_at: new Date().toISOString(), signature_image: signatureDataUrl }
          : a
      );
      s.partners = s.partners.map((p) =>
        p.id === DEMO_PARTNER_ID ? { ...p, status: "active" } : p
      );
      saveAgreementStore(s);
      setSigning(false);
      setViewing(false);
      toast.success("تم توقيع الاتفاقية — تم تفعيل حسابك");
      return;
    }
    try {
      const res: any = await partnerApi.signAgreement(adminAgreement.id, {
        signedName: name,
        signatureImage: signatureDataUrl,
      });
      const updated = res?.agreement || res;
      setAdminAgreement(
        updated || { ...adminAgreement, status: "signed", signed_name: name, signed_at: new Date().toISOString(), signature_image: signatureDataUrl }
      );
      setSigning(false);
      setViewing(false);
      // Use the partner returned from the sign response if available, else refetch
      const returnedPartner = res?.partner ? mapApiPartner(res.partner) : null;
      if (returnedPartner) {
        onPartnerUpdate?.(returnedPartner);
      } else {
        onPartnerUpdate?.((prev) => (prev ? { ...prev, status: "active" } : prev));
        try {
          const me = await partnerAuth.me();
          const real = mapApiPartner(me?.partner);
          if (real) onPartnerUpdate?.(real);
        } catch { /* ignore */ }
      }
      toast.success("تم توقيع الاتفاقية — تم تفعيل حسابك");
    } catch (e: any) {
      toast.error(e?.message || "تعذر حفظ التوقيع، حاول مرة أخرى");
    }
  }

  function downloadDemoAgreementPdf() {
    if (!adminAgreement) return;
    const s = loadAgreementStore();
    const sp = s.partners.find((p) => p.id === DEMO_PARTNER_ID);
    const tpl = adminAgreement.template_id ? s.templates.find((t) => t.id === adminAgreement.template_id) || null : null;
    if (!sp) return;
    printAgreementPdf(buildAgreementHtmlForPartner(sp, adminAgreement, tpl));
  }


  const hasPending = requests.some((x) => x.status === "pending");

  async function submit() {
    if (hasPending) { toast.error("لديك طلب قيد المراجعة بالفعل"); return; }
    if (reqCommission === currentCommission) {
      toast.error("لم تقم بتغيير النسبة"); return;
    }
    if (reqCommission < 0 || reqCommission > 50) {
      toast.error("القيمة خارج النطاق المسموح (0% - 50%)"); return;
    }
    setSaving(true);
    try {
      const r: any = await partnerApi.createCommissionRequest({
        requestedCommissionPct: reqCommission,
        requestedDepositPct: reqCommission,
        reason: reason || undefined,
      });
      setSaving(false);
      const item = (r?.item || r) as CommissionRequest;
      setRequests((p) => [item, ...p]);
    } catch (e: any) {
      setSaving(false);
      toast.error(e?.message || "فشل إرسال الطلب"); return;
    }
    setReason("");
    toast.success("تم إرسال الطلب — بانتظار موافقة الإدارة");
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold">الاتفاقية والعمولة</h2>
        <p className="mt-1 text-xs text-muted-foreground">العربون الذي يدفعه العميل مقدماً هو نفسه عمولة المنصة — يُحصَّل عند الحجز ولا يُسلَّم للمركز.</p>
      </div>

      {!adminAgreement && (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-4 text-amber-800">
          <div className="flex items-center gap-2 font-extrabold">
            <Clock className="h-5 w-5" /> بانتظار إرسال الاتفاقية من الإدارة
          </div>
          <p className="mt-1 text-xs text-amber-700/90">
            تتم حالياً مراجعة بيانات مركزك. ستصلك اتفاقية الشراكة مع نسبة العمولة/العربون المخصّصة لمركزك هنا فور إرسالها من إدارة المنصة، وعند توقيعك عليها يتم تفعيل حسابك تلقائياً.
          </p>
        </div>
      )}
      {adminAgreement && adminAgreement.status !== "signed" && (
        <div className="rounded-2xl border-2 border-primary bg-primary/10 p-4">
          <div className="flex items-center gap-2 font-extrabold text-primary">
            <FileText className="h-5 w-5" /> لديك اتفاقية شراكة من الإدارة بانتظار توقيعك
          </div>
          <p className="mt-1 text-xs text-foreground/80">العمولة / العربون: <b>{adminAgreement.commission_pct}%</b> — راجع البنود ووقّع لتفعيل حسابك.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => setViewing(true)} className="inline-flex items-center gap-2 rounded-full border border-primary bg-white px-4 py-2 text-xs font-bold text-primary hover:bg-primary/10">
              <FileText className="h-4 w-4" /> عرض الاتفاقية
            </button>
            <button onClick={openSignDialog} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-4 py-2 text-xs font-bold text-white shadow">
              <Check className="h-4 w-4" /> الموافقة والتوقيع
            </button>
          </div>
        </div>
      )}

      {adminAgreement && adminAgreement.status === "signed" && partner.id !== DEMO_PARTNER_ID && (
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-extrabold">
                <FileText className="h-4 w-4 text-primary" /> باركود الاتفاقية الموقَّعة
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-6">
                امسح الباركود من أي جهاز لعرض نسخة الاتفاقية الموقَّعة للمركز. يمكنك طباعته ولصقه داخل المركز.
              </p>
              {qr?.qrUrl && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={qr.qrUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-bold hover:bg-muted">
                    فتح الرابط
                  </a>
                  {qr.qrPngBase64 && (
                    <a href={`data:image/png;base64,${qr.qrPngBase64}`} download="agreement-qr.png" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-4 py-2 text-xs font-bold text-white">
                      <ArrowDownToLine className="h-4 w-4" /> تحميل الباركود
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="shrink-0">
              {qrLoading ? (
                <div className="h-40 w-40 rounded-2xl border border-dashed border-border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">…تحميل</div>
              ) : qr?.qrPngBase64 ? (
                <img src={`data:image/png;base64,${qr.qrPngBase64}`} alt="QR" className="h-40 w-40 rounded-2xl border border-border bg-white p-2" />
              ) : (
                <div className="h-40 w-40 rounded-2xl border border-dashed border-border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground text-center p-2">الباركود غير متاح حالياً</div>
              )}
            </div>
          </div>
        </div>
      )}
      {adminAgreement && adminAgreement.status === "signed" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 font-extrabold text-emerald-700">
            <FileText className="h-5 w-5" /> اتفاقية الشراكة موقّعة — حسابك مفعّل
          </div>
          <p className="mt-1 text-xs text-emerald-700/80">وُقّعت بتاريخ {adminAgreement.signed_at ? new Date(adminAgreement.signed_at).toLocaleDateString("ar-SA") : "—"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => setViewing(true)} className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
              <FileText className="h-4 w-4" /> عرض الاتفاقية
            </button>
            <button onClick={downloadDemoAgreementPdf} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700">
              <ArrowDownToLine className="h-4 w-4" /> تحميل PDF
            </button>
          </div>
        </div>
      )}

      {viewing && adminAgreement && (
        <div onClick={() => setViewing(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-4xl h-[92vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <div className="font-extrabold">اتفاقية الشراكة</div>
              <div className="flex items-center gap-2">
                <button onClick={downloadDemoAgreementPdf} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                  <ArrowDownToLine className="h-4 w-4" /> تحميل PDF
                </button>
                {adminAgreement.status !== "signed" && (
                  <button onClick={() => { setViewing(false); openSignDialog(); }} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-4 py-2 text-xs font-bold text-white">
                    <Check className="h-4 w-4" /> الموافقة والتوقيع
                  </button>
                )}
                <button onClick={() => setViewing(false)} className="rounded-full border border-border p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <iframe srcDoc={viewHtml} className="flex-1 w-full min-h-0 bg-white" title="agreement" />
          </div>
        </div>
      )}

      {signing && adminAgreement && (
        <SignatureDialog
          defaultName={partner.owner_name}
          commission={adminAgreement.commission_pct}
          onCancel={() => setSigning(false)}
          onConfirm={confirmSign}
        />
      )}

      {/* Current rate — one unified card */}
      {adminAgreement ? (
        <div className="rounded-3xl border border-border bg-gradient-to-br from-[#3F2A6B] to-[#E0254D] p-6 text-white">
          <div className="flex items-center gap-2 text-xs opacity-90"><Percent className="h-4 w-4" /> نسبة العمولة / العربون</div>
          <div className="mt-2 text-5xl font-black">{currentCommission}%</div>
          <div className="mt-3 text-[12px] opacity-90 leading-6">
            العميل يدفع هذه النسبة مقدماً للمنصة كعربون لتأكيد الحجز — وهي نفسها عمولة المنصة. الباقي ({100 - currentCommission}%) يُحصّله المركز نقداً عند الخدمة.
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-3xl border border-dashed border-primary/40 bg-gradient-to-br from-[#3F2A6B]/10 via-background to-[#E0254D]/10 p-6">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <Percent className="h-4 w-4" /> نسبة العمولة / العربون
          </div>
          <div className="mt-3 flex items-end gap-3">
            <div className="text-5xl font-black tracking-tight text-muted-foreground/60">—</div>
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800 border border-amber-200">
              <Clock className="h-3.5 w-3.5" /> بانتظار تحديدها من الإدارة
            </span>
          </div>
          <p className="mt-3 text-[12px] leading-6 text-muted-foreground">
            ستظهر هنا النسبة المخصّصة لمركزك فور إرسال الإدارة لاتفاقية الشراكة. لن تُحتسب أي عمولة قبل توقيعك على الاتفاقية وتفعيل الحساب.
          </p>
        </div>
      )}


      {/* Agreement summary */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-extrabold">بنود الاتفاقية</h3>
        </div>
        {signedAgreementClauses.length > 0 ? (
          <ul className="space-y-2 text-sm text-foreground/80 list-disc pr-5">
            {signedAgreementClauses.map((clause: string, index: number) => (
              <li key={`${index}-${clause}`}>{clause}</li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            ستظهر هنا البنود الفعلية لنفس الاتفاقية التي أرسلتها الإدارة لك ووقّعت عليها.
          </div>
        )}
      </div>

      {partner.status === "active" && (<>
      {/* Per-offer breakdown */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <h3 className="font-extrabold mb-3">تفاصيل العروض والصافي لكل عرض</h3>
        {offers.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">لا توجد عروض بعد. أضف أول عرض من قسم «العروض».</div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-right text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 font-medium">العرض</th>
                  <th className="py-2 font-medium">السعر</th>
                  <th className="py-2 font-medium">العربون / العمولة ({currentCommission}%)</th>
                  <th className="py-2 font-medium">صافي الشريك</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => {
                  const price = Number(o.price) || 0;
                  const commission = price * currentCommission / 100;
                  const net = price - commission;
                  return (
                    <tr key={o.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-bold">{o.title}</td>
                      <td className="py-3">{price.toFixed(0)} ر.س</td>
                      <td className="py-3 text-rose-600">{commission.toFixed(0)} ر.س</td>
                      <td className="py-3 font-extrabold text-emerald-600">{net.toFixed(0)} ر.س</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Request form */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Send className="h-4 w-4 text-primary" />
          <h3 className="font-extrabold">طلب تعديل النسبة</h3>
        </div>
        {hasPending && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            لديك طلب قيد المراجعة، يرجى انتظار رد الإدارة قبل إرسال طلب جديد.
          </div>
        )}
        <label className="block">
          <span className="text-xs font-bold text-foreground/70">النسبة المقترحة (%) — تشمل العربون والعمولة معاً</span>
          <input type="number" min={0} max={50} step={0.5} value={reqCommission}
            onChange={(e) => { const v = Number(e.target.value); setReqCommission(v); setReqDeposit(v); }}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-bold text-foreground/70">سبب الطلب (اختياري)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            placeholder="مثال: حجم الحجوزات الشهرية تجاوز 500 وأطلب مراجعة العمولة."
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <button onClick={submit} disabled={saving || hasPending}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-5 py-2.5 text-sm font-bold text-white shadow disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          إرسال الطلب للإدارة
        </button>
      </div>

      {/* Request history */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <h3 className="font-extrabold mb-3">سجل الطلبات</h3>
        {requests.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">لا توجد طلبات سابقة.</div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const tone = r.status === "approved" ? "bg-emerald-100 text-emerald-700"
                : r.status === "rejected" ? "bg-rose-100 text-rose-700"
                : "bg-amber-100 text-amber-700";
              const label = r.status === "approved" ? "تمت الموافقة"
                : r.status === "rejected" ? "مرفوض" : "قيد المراجعة";
              return (
                <div key={r.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar")}</div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${tone}`}>{label}</span>
                  </div>
                  <div className="mt-2 text-xs">
                    النسبة: <b>{r.current_commission_pct ?? "—"}%</b> ← <b className="text-primary">{r.requested_commission_pct}%</b>
                  </div>

                  {r.reason && <div className="mt-2 text-xs text-foreground/70">السبب: {r.reason}</div>}
                  {r.admin_notes && <div className="mt-2 text-xs text-foreground/70">ملاحظة الإدارة: {r.admin_notes}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>)}
    </div>

  );
}

function SignatureDialog({ defaultName, commission, onCancel, onConfirm }: { defaultName: string; commission: number; onCancel: () => void; onConfirm: (name: string, dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [name, setName] = useState(defaultName || "");
  const [agreed, setAgreed] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  }
  function end() { drawing.current = false; last.current = null; }
  function clear() {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  }
  function confirm() {
    if (!name.trim()) { toast.error("اكتب اسمك الكامل"); return; }
    if (!hasInk) { toast.error("ارسم توقيعك في المربع"); return; }
    if (!agreed) { toast.error("لازم توافق على بنود الاتفاقية"); return; }
    onConfirm(name.trim(), canvasRef.current!.toDataURL("image/png"));
  }

  return (
    <div onClick={onCancel} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="font-extrabold">توقيع الاتفاقية</div>
          <button onClick={onCancel} className="rounded-full border border-border p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs text-foreground/80">
            ستوقع بصفتك المسؤول عن المركز على اتفاقية الشراكة بنسبة عمولة/عربون <b>{commission}%</b>. عند التوقيع يتم تفعيل حسابك مباشرة.
          </div>
          <label className="block">
            <span className="text-xs font-bold text-foreground/70">الاسم الكامل</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="اكتب اسمك الكامل" />
          </label>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground/70">ارسم توقيعك اليدوي</span>
              <button onClick={clear} type="button" className="text-[11px] font-bold text-rose-600 hover:underline">مسح</button>
            </div>
            <canvas
              ref={canvasRef}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
              className="block h-40 w-full touch-none cursor-crosshair rounded-xl border-2 border-dashed border-border bg-[linear-gradient(transparent_38px,#e5e7eb_39px)] bg-[length:100%_40px]"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">استخدم الماوس أو إصبعك للتوقيع داخل المربع.</p>
          </div>
          <label className="flex items-start gap-2 text-xs text-foreground/80 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span>أقر بأني اطلعت على بنود اتفاقية الشراكة ووافقت عليها وأقبل التوقيع إلكترونياً.</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onCancel} className="rounded-full border border-border px-4 py-2 text-xs font-bold text-foreground/70 hover:bg-muted">إلغاء</button>
            <button onClick={confirm} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-5 py-2 text-xs font-bold text-white shadow">
              <Check className="h-4 w-4" /> تأكيد التوقيع وتفعيل الحساب
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* -------------------- Support (Demo) -------------------- */
function SupportTab() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [activeMessages, setActiveMessages] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await partnerApi.listSupportTickets();
      setTickets(r?.items || []);
    } catch (e: any) {
      toast.error(e?.message || "تعذر تحميل التذاكر");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openTicket = async (id: string) => {
    setActiveId(id);
    setActiveTicket(null);
    setActiveMessages([]);
    setLoadingDetail(true);
    try {
      const r: any = await partnerApi.getSupportTicket(id);
      setActiveTicket(r?.ticket || null);
      setActiveMessages(r?.messages || []);
    } catch (e: any) {
      toast.error(e?.message || "تعذر تحميل التذكرة");
      setActiveId(null);
    }
    setLoadingDetail(false);
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeId) return;
    setSendingReply(true);
    try {
      await partnerApi.createSupportTicket as any; // noop guard
      // reuse messages endpoint via getSupportTicket POST? Use partnerApi if exists
      const api: any = partnerApi as any;
      if (typeof api.replySupportTicket === "function") {
        await api.replySupportTicket(activeId, reply.trim());
      } else {
        // fallback: try generic
        await api.sendMessage?.(activeId, reply.trim());
      }
      setReply("");
      await openTicket(activeId);
      toast.success("تم إرسال الرد");
    } catch (e: any) {
      toast.error(e?.message || "فشل إرسال الرد");
    }
    setSendingReply(false);
  };

  const submit = async () => {
    if (!subject.trim() || !body.trim()) { toast.error("املأ كل الحقول"); return; }
    setSubmitting(true);
    try {
      await partnerApi.createSupportTicket({ subject: subject.trim(), body: body.trim() });
      toast.success("تم إرسال التذكرة");
      setSubject(""); setBody("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "فشل إرسال التذكرة");
    }
    setSubmitting(false);
  };

  const statusLabel = (s?: string) => {
    if (s === "open") return { t: "مفتوحة", c: "bg-amber-100 text-amber-800" };
    if (s === "replied" || s === "in_progress") return { t: "تم الرد", c: "bg-blue-100 text-blue-800" };
    if (s === "closed") return { t: "مغلقة", c: "bg-gray-200 text-gray-700" };
    return { t: s || "—", c: "bg-muted text-foreground/70" };
  };

  return (
    <div className="grid gap-6">
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3F2A6B] to-[#E0254D] text-white shadow"><LifeBuoy className="h-5 w-5" /></div>
            <div>
              <h3 className="text-lg font-extrabold">فتح تذكرة دعم جديدة</h3>
              <p className="text-xs text-muted-foreground">سيتم الرد خلال 24 ساعة على أيام العمل.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع التذكرة" className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="اشرح مشكلتك أو استفسارك بالتفصيل…" className="w-full rounded-xl border border-border bg-background p-4 text-sm outline-none focus:border-primary" />
            <button onClick={submit} disabled={submitting} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-6 py-2.5 text-sm font-bold text-white shadow disabled:opacity-60">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال التذكرة
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="border-b border-border p-5"><h3 className="text-lg font-extrabold">تذاكري السابقة</h3></div>
          {loading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">لا توجد تذاكر بعد</div>
          ) : tickets.map((t) => {
            const s = statusLabel(t.status);
            return (
              <button
                key={t.id}
                onClick={() => openTicket(t.id)}
                className="flex w-full items-center justify-between gap-3 border-b border-border p-4 text-right transition hover:bg-muted/40 last:border-b-0"
              >
                <div>
                  <div className="text-sm font-extrabold">{t.subject}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{t.number || t.id} · {t.createdAt ? new Date(t.createdAt).toLocaleDateString("ar") : ""}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${s.c}`}>{s.t}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setActiveId(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border p-5">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-extrabold">{activeTicket?.subject || "تذكرة دعم"}</h3>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {activeTicket?.number || activeId}
                  {activeTicket?.createdAt ? ` · ${new Date(activeTicket.createdAt).toLocaleString("ar")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeTicket?.status && (
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusLabel(activeTicket.status).c}`}>
                    {statusLabel(activeTicket.status).t}
                  </span>
                )}
                <button onClick={() => setActiveId(null)} className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-5">
              {loadingDetail ? (
                <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : activeMessages.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                  {activeTicket?.body || "لا توجد رسائل."}
                </div>
              ) : (
                activeMessages.map((m: any, i: number) => {
                  const isPartner = m.sender === "partner" || m.from === "partner" || m.isPartner;
                  return (
                    <div key={m.id || i} className={`flex ${isPartner ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${isPartner ? "bg-gradient-to-br from-[#3F2A6B] to-[#E0254D] text-white" : "bg-card border border-border"}`}>
                        <div className="whitespace-pre-wrap leading-relaxed">{m.text || m.body || m.message}</div>
                        {m.createdAt && (
                          <div className={`mt-1 text-[10px] ${isPartner ? "text-white/70" : "text-muted-foreground"}`} dir="ltr">
                            {new Date(m.createdAt).toLocaleString("ar")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {activeTicket?.status !== "closed" && (
              <div className="border-t border-border bg-card p-4">
                <div className="flex items-end gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    placeholder="اكتب ردك…"
                    className="flex-1 resize-none rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
                  />
                  <button
                    onClick={sendReply}
                    disabled={sendingReply || !reply.trim()}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-5 py-2.5 text-sm font-bold text-white shadow disabled:opacity-60"
                  >
                    {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    إرسال
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}