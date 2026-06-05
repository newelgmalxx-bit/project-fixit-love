import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { generateTimeSlots } from "@/lib/timeSlots";
import { publicApi } from "@/lib/api/public";
import { getSid } from "@/lib/api/client";
import { renderCategoryIcon } from "@/lib/categoryIcon";

import {
  ChevronLeft,
  MapPin,
  Phone,
  Star,
  Clock,
  FileText,
  Calendar,
  Check,
  Heart,
  Share2,
  ShieldCheck,
  QrCode,
  BadgePercent,
  Sparkles,
  CalendarCheck,
  RotateCcw,
  ChevronDown,
  Plus,
  Minus,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { toast } from "sonner";
import { useOffer, useOffersByCategory, useCategory } from "@/hooks/useCatalog";
import { SarIcon } from "@/components/ui/SarIcon";
import { OfferCard } from "@/components/sections/OfferCard";
import { buildSeo } from "@/lib/seo";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useCart } from "@/hooks/useCart";
import { useLang } from "@/i18n/LanguageProvider";
import { ShoppingCart } from "lucide-react";
import { useFavorite } from "@/hooks/useFavorite";
import { useAuth } from "@/hooks/useAuth";
import { reviews as reviewsApi } from "@/lib/api/services";


export const Route = createFileRoute("/offers/$offerId")({
  head: ({ params }) => {
    const seo = buildSeo({
      title: "عرض",
      description: "",
      path: `/offers/${params.offerId}`,
    });
    return { meta: seo.meta, links: seo.links };
  },
  component: OfferDetailPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">العرض غير موجود.</p>
    </div>
  ),
});



const FAQ = [
  {
    q: "هل أحتاج لتأكيد الحجز قبل الذهاب؟",
    a: "بعد إتمام الحجز ستصلك رسالة تأكيد مع باركود تعرضه عند وصولك للمتجر مباشرةً، لا حاجة لاتصال إضافي.",
  },
  {
    q: "هل يمكنني تعديل أو إلغاء الحجز؟",
    a: "نعم، يمكنك إعادة الجدولة أو الإلغاء مجاناً قبل 6 ساعات من الموعد من صفحة حجوزاتك.",
  },
  {
    q: "كيف تتم عملية الدفع؟",
    a: "الدفع آمن عبر مدى، فيزا، ماستر كارد، Apple Pay. لا نحتفظ بأي بيانات بطاقات على المنصة.",
  },
];

const PLACEHOLDER_OFFER: any = {
  id: "",
  title: "",
  description: "",
  image: "",
  priceBefore: 0,
  priceAfter: 0,
  discountPercent: 0,
  durationMinutes: 60,
  category: "",
  vendor: { id: "", name: "", city: "", address: "", rating: 0, reviewsCount: 0, verified: false },
  overview: [],
  terms: [],
};

function OfferDetailPage() {
  const { offerId } = Route.useParams();
  const { offer: offerData, isLoading } = useOffer(offerId);
  const offer = (offerData ?? PLACEHOLDER_OFFER) as NonNullable<typeof offerData>;
  const category = useCategory(offer.category);
  const { offers: sameCategoryOffers } = useOffersByCategory(offer.category);
  const navigate = useNavigate();
  const site = useSiteSettings();
  const cancellationTerms: string[] = Array.isArray((site as any).cancellationTerms) && (site as any).cancellationTerms.length
    ? (site as any).cancellationTerms
    : [
        "إلغاء مجاني واسترداد العربون قبل 6 ساعات من الموعد.",
        "خصم 50% من العربون عند الإلغاء قبل أقل من 6 ساعات.",
        "العربون غير مسترد في حال عدم الحضور بدون إشعار.",
      ];
  const mapsUrl = (offer.vendor as any).mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${offer.vendor.name} ${offer.vendor.address} ${offer.vendor.city}`)}`;


  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [qty, setQty] = useState(1);
  const { user, isAuthenticated } = useAuth();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  useEffect(() => {
    if (user) {
      if (user.name) setCustomerName((v) => v || user.name);
      if (user.email) setCustomerEmail((v) => v || user.email);
      if (user.phone) setCustomerPhone((v) => v || user.phone || "");
    }
  }, [user]);
  const [loading, setLoading] = useState(false);
  const { fav: favorite, toggle: toggleFavorite } = useFavorite(String(offer.id));
  const [tab, setTab] = useState<"overview" | "terms" | "location" | "reviews">("overview");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeImg, setActiveImg] = useState(0);
  const [step, setStep] = useState<"form" | "review">("form");
  const [agreed, setAgreed] = useState(false);

  // Time slots and availability — fetched from backend per selected date
  const FALLBACK_SLOTS = useMemo(() => generateTimeSlots(offer.durationMinutes), [offer.durationMinutes]);
  const [availableSlots, setAvailableSlots] = useState<string[]>(FALLBACK_SLOTS);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [dayOff, setDayOff] = useState(false);
  const [blockedDaysList, setBlockedDaysList] = useState<string[]>([]);

  const TIME_SLOTS = availableSlots;

  // Fetch availability for the selected date
  useEffect(() => {
    if (!date || !offer.id) {
      setBlockedSlots([]); setDayOff(false);
      setAvailableSlots(FALLBACK_SLOTS);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data: any = await publicApi.getOfferAvailability(offer.id, date);
        if (cancelled || !data) return;
        const slots: any[] = Array.isArray(data.slots) ? data.slots : [];
        const allTimes = slots.map((s) => s.time).filter(Boolean);
        const blocked = slots.filter((s) => !s.available).map((s) => s.time);
        setAvailableSlots(allTimes.length ? allTimes : FALLBACK_SLOTS);
        setBlockedSlots(blocked);
        // Ignore backend's dayOff flag — it currently returns true even when
        // the center is open. Day-off is derived from the partner's workingHours.
        setDayOff(false);
      } catch {
        // On failure, fallback to generated slots, no blocks
        if (!cancelled) {
          setAvailableSlots(FALLBACK_SLOTS);
          setBlockedSlots([]);
          setDayOff(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [date, offer.id, FALLBACK_SLOTS]);


  // Fetch 14-day range for the upcoming-days strip
  useEffect(() => {
    if (!offer.id) return;
    const today = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const from = iso(today);
    const end = new Date(today); end.setDate(today.getDate() + 13);
    const to = iso(end);
    let cancelled = false;
    (async () => {
      try {
        const arr: any[] = await publicApi.getOfferAvailabilityRange(offer.id, from, to);
        if (cancelled) return;
        // Only honor "fullyBooked" from the range endpoint — closed-day info
        // is sourced from the partner's workingHours (more reliable).
        const blocked = arr.filter((d) => d.fullyBooked).map((d) => d.date);
        setBlockedDaysList(blocked);
      } catch {
        if (!cancelled) setBlockedDaysList([]);
      }
    })();
    return () => { cancelled = true; };
  }, [offer.id]);


  // Weekday keys (Sun..Sat) marked closed in the partner's workingHours.
  const closedWeekdays = useMemo(() => {
    const wh: any[] = (offer.vendor as any)?.workingHours;
    if (!Array.isArray(wh)) return new Set<string>();
    return new Set(
      wh
        .filter((d) => d && (d.closed === true || d.closed === 1 || d.closed === "1"))
        .map((d) => String(d.day || "").toLowerCase()),
    );
  }, [offer.vendor]);

  const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  // Upcoming 14 days with blocked-day visual
  const upcomingDays = useMemo(() => {
    const out: { iso: string; label: string; weekday: string; blocked: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const blockedSet = new Set(blockedDaysList);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const weekdayKey = WEEKDAY_KEYS[d.getDay()];
      const isClosedDay = closedWeekdays.has(weekdayKey);
      out.push({
        iso,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        weekday: d.toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "short" }),
        blocked: isClosedDay || blockedSet.has(iso),
      });
    }
    return out;
  }, [blockedDaysList, closedWeekdays]);

  // Auto-clear time when blocked or day off
  useEffect(() => {
    if (dayOff && time) setTime("");
    else if (time && blockedSlots.includes(time)) setTime("");
  }, [blockedSlots, time, dayOff]);

  // User reviews (local-only for now)
  type UserReview = { name: string; date: string; rating: number; text: string };
  const [userReviews, setUserReviews] = useState<UserReview[]>([]);
  const [reviewStats, setReviewStats] = useState<{ avg: number; count: number; dist: Record<number, number> }>({ avg: 0, count: 0, dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  const [reviewName, setReviewName] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  async function loadReviews() {
    const oid = (offer as any)?.id;
    if (!oid) return;
    try {
      const res: any = await reviewsApi.list({ offerId: String(oid), limit: 100 });
      const data = res?.data ?? res;
      const itemsRaw: any[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      // Only show approved/published reviews
      const items = itemsRaw.filter((r) => {
        const s = String(r.status ?? "published").toLowerCase();
        return s === "published" || s === "approved" || s === "active" || s === "";
      });
      const mapped: UserReview[] = items.map((r) => ({
        name: r.userName || r.user_name || r.name || "مستخدم",
        date: String(r.created_at || r.createdAt || "").slice(0, 10),
        rating: Number(r.rating) || 0,
        text: r.comment || r.text || "",
      }));
      setUserReviews(mapped);
      const count = mapped.length;
      const sum = mapped.reduce((a, b) => a + (b.rating || 0), 0);
      const avg = typeof data?.average === "number" ? Number(data.average) : (count ? sum / count : 0);
      const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      mapped.forEach((m) => { const k = Math.round(m.rating); if (dist[k] != null) dist[k] += 1; });
      setReviewStats({ avg: Math.round(avg * 10) / 10, count: Number(data?.total ?? count), dist });
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(offer as any)?.id]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (reviewText.trim().length < 5 || reviewRating < 1) {
      toast.error("اكتب تقييم لا يقل عن 5 أحرف وحدد عدد النجوم");
      return;
    }
    if (!isAuthenticated) {
      toast.error("لازم تسجل دخول الأول عشان تضيف تقييم");
      navigate({ to: "/login" });
      return;
    }
    const offerIdVal = (offer as any)?.id;
    if (!offerIdVal) {
      toast.error("تعذّر تحديد العرض");
      return;
    }
    setReviewSubmitting(true);
    try {
      await reviewsApi.create(
        { offerId: String(offerIdVal) },
        { rating: reviewRating, comment: reviewText.trim() },
      );
      toast.success("شكرًا لتقييمك! هيظهر بعد مراجعة الإدارة");
      setReviewName("");
      setReviewText("");
      setReviewRating(0);
      setReviewSubmitted(true);
      setTimeout(() => setReviewSubmitted(false), 2500);
      // Refresh list — newly approved reviews will appear after admin moderation
      loadReviews();
    } catch (err: any) {
      const msg = err?.message || "تعذّر إرسال التقييم";
      toast.error(msg);
    } finally {
      setReviewSubmitting(false);
    }
  }

  const gallery = useMemo(() => {
    const own = Array.isArray((offer as any).gallery)
      ? ((offer as any).gallery as string[]).filter(Boolean)
      : [];
    const all = [offer.image, ...own].filter(Boolean);
    // de-dup while preserving order
    return Array.from(new Set(all));
  }, [offer]);

  const related = useMemo(
    () => sameCategoryOffers.filter((o) => o.id !== offer.id).slice(0, 3),
    [offer, sameCategoryOffers]
  );

  const savings = offer.priceBefore - offer.priceAfter;
  const total = offer.priceAfter * qty;
  // Online deposit = platform commission (admin's share). Center collects rest.
  const depositPct = offer.vendor.commissionPct ?? offer.vendor.depositPct ?? 10;
  const depositAmount = Math.round((total * depositPct) / 100);
  const remainingAmount = total - depositAmount;
  const { add: addToCartHook } = useCart();
  const { lang: _lang } = useLang();

  // ===== Abandoned-cart tracking (persisted to backend) =====
  // Once the visitor has filled in their contact details + a date/time we
  // upsert a partial cart record so the admin can send a reminder later.
  // No login required — backend identifies the visitor via X-Session-Id.
  const abandonedKey = "demo_admin_abandoned_carts"; // legacy local fallback
  const cartLocalId = useMemo(() => {
    let sid = "anon";
    try {
      if (typeof window !== "undefined") {
        // getSid() يولّد UUID ويخزّنه لو مش موجود — يضمن إن لكل زائر سجل فريد
        sid = getSid() || sid;
      }
    } catch {}
    return `abc-${sid}-${offer.id}`;
  }, [offer.id]);

  const removeAbandoned = () => {
    // Best-effort cleanup, both backend + legacy local store.
    publicApi.clearAbandonedCart(cartLocalId).catch(() => {});
    try {
      const raw = localStorage.getItem(abandonedKey);
      const list: any[] = raw ? JSON.parse(raw) : [];
      const next = list.filter((c: any) => c.cart_id !== cartLocalId);
      localStorage.setItem(abandonedKey, JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());
    const phoneOk = customerPhone.replace(/\D/g, "").length >= 9;
    const nameOk = customerName.trim().length >= 2;
    if (!date || !time || !nameOk || !emailOk || !phoneOk) return;
    const t = setTimeout(() => {
      const item = {
        offerId: offer.id,
        offerTitle: offer.title,
        vendorName: offer.vendor.name,
        vendorCity: offer.vendor.city,
        bookingDate: date,
        bookingTime: time,
        qty,
        price: offer.priceAfter,
        lineTotal: total,
        depositAmount,
        remainingAmount,
        depositPct,
      };
      // Persist to backend (database). Fall back silently to legacy local
      // store so the admin demo page still has something to show if the
      // external endpoint is unreachable.
      publicApi
        .saveAbandonedCart({
          cartId: cartLocalId,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          items: [item],
          subtotal: total,
        })
        .catch(() => {
          try {
            const raw = localStorage.getItem(abandonedKey);
            const list: any[] = raw ? JSON.parse(raw) : [];
            const entry = {
              cart_id: cartLocalId,
              customer_name: customerName.trim(),
              customer_email: customerEmail.trim(),
              customer_phone: customerPhone.trim(),
              item_count: 1,
              total_qty: qty,
              subtotal: total,
              updatedAt: new Date().toISOString(),
              items: [{ ...item, serviceTitle: offer.title, planName: offer.vendor.name }],
            };
            const idx = list.findIndex((c: any) => c.cart_id === cartLocalId);
            if (idx >= 0) list[idx] = entry;
            else list.unshift(entry);
            localStorage.setItem(abandonedKey, JSON.stringify(list.slice(0, 50)));
          } catch {}
        });
    }, 800);
    return () => clearTimeout(t);
  }, [date, time, qty, customerName, customerEmail, customerPhone, total, depositAmount, remainingAmount, depositPct, offer, cartLocalId]);

  function validateBookingForm(): string[] {
    const missing: string[] = [];
    if (!date) missing.push("التاريخ");
    if (!time) missing.push("الوقت");
    if (!customerName.trim()) missing.push("الاسم الكامل");
    if (!customerEmail.trim()) missing.push("البريد الإلكتروني");
    if (!customerPhone.trim()) missing.push("رقم الجوال");
    return missing;
  }

  function handleAddToCart() {
    const missing = validateBookingForm();
    if (missing.length > 0) {
      toast.error("بيانات ناقصة", {
        description: `أكمل بياناتك قبل إضافة العرض للسلة: ${missing.join("، ")}`,
      });
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());
    if (!emailOk) {
      toast.error("البريد الإلكتروني غير صحيح", {
        description: "أدخل بريد إلكتروني صالح مثل name@example.com",
      });
      return;
    }
    if (customerPhone.replace(/\D/g, "").length < 9) {
      toast.error("رقم الجوال غير صحيح", {
        description: "أدخل رقم جوال صحيح (مثال: 05XXXXXXXX)",
      });
      return;
    }
    if (dayOff) {
      toast.error("هذا اليوم غير متاح", { description: "المركز غير متاح في هذا اليوم — يرجى اختيار تاريخ آخر." });
      return;
    }
    if (blockedSlots.includes(time)) {
      toast.error("هذا الموعد غير متاح", { description: "تم تعطيل هذا الوقت من قِبَل المركز — يرجى اختيار وقت آخر." });
      return;
    }

    addToCartHook({
      serviceSlug: `offer:${offer.id}`,
      serviceTitle: offer.title,
      planName: offer.vendor.name,
      price: offer.priceAfter,
      qty,
      vendorName: offer.vendor.name,
      offerId: offer.id,
      partnerId: null,
      bookingDate: date,
      bookingTime: time,
      commissionPct: depositPct,
    });
    toast.success("تمت إضافة الحجز للسلة", {
      description: `${offer.title} — ${date} ${time}`,
      action: { label: "الذهاب للسلة", onClick: () => navigate({ to: "/cart" as any }) },
    });
    // ملاحظة: لا نمسح سجل السلة المتروكة هنا. الإضافة للسلة لا تعني إتمام
    // الحجز — يتم المسح فقط بعد نجاح الدفع/تأكيد الحجز.
  }


  function goToReview(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!date) missing.push("التاريخ");
    if (!time) missing.push("الوقت");
    if (!customerName.trim()) missing.push("الاسم الكامل");
    if (!customerEmail.trim()) missing.push("البريد الإلكتروني");
    if (!customerPhone.trim()) missing.push("رقم الجوال");

    if (missing.length > 0) {
      toast.error("بيانات ناقصة", {
        description: `من فضلك املأ: ${missing.join("، ")}`,
      });
      return;
    }

    if (date && dayOff) {
      toast.error("هذا اليوم غير متاح", { description: "المركز غير متاح في هذا اليوم — يرجى اختيار تاريخ آخر." });
      return;
    }
    if (date && time && blockedSlots.includes(time)) {
      toast.error("هذا الموعد غير متاح", { description: "تم تعطيل هذا الوقت من قِبَل المركز — يرجى اختيار وقت آخر." });
      return;
    }


    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());
    if (!emailOk) {
      toast.error("البريد الإلكتروني غير صحيح", {
        description: "أدخل بريد إلكتروني صالح مثل name@example.com",
      });
      return;
    }

    const phoneDigits = customerPhone.replace(/\D/g, "");
    if (phoneDigits.length < 9) {
      toast.error("رقم الجوال غير صحيح", {
        description: "أدخل رقم جوال صحيح (مثال: 05XXXXXXXX)",
      });
      return;
    }

    setStep("review");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function confirmBooking() {
    if (!agreed) return;
    setLoading(true);
    const bookingId = "BK-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
    const payload = {
      bookingId,
      verifyCode,
      offerId: offer.id,
      // ---- Offer snapshot (so display pages don't depend on @/data/offers) ----
      offerTitle: offer.title,
      offerImage: offer.image,
      vendorName: offer.vendor?.name,
      vendorCity: offer.vendor?.city,
      vendorAddress: offer.vendor?.address,
      vendorPhone: offer.vendor?.phone,
      vendorMapsUrl: (offer.vendor as any)?.mapsUrl,
      priceAfter: offer.priceAfter,
      date,
      time,
      qty,
      total,
      depositAmount,
      remainingAmount,
      depositPct,
      customerName,
      customerEmail,
      customerPhone,
      createdAt: new Date().toISOString(),
    };
    try {
      sessionStorage.setItem(`booking:${bookingId}`, JSON.stringify(payload));
      const raw = localStorage.getItem("myBookings");
      const list = raw ? JSON.parse(raw) : [];
      list.push(payload);
      localStorage.setItem("myBookings", JSON.stringify(list));
    } catch {}
    removeAbandoned();
    setTimeout(() => {
      navigate({ to: "/booking/pay/$bookingId", params: { bookingId } });
    }, 400);
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: offer.title, text: offer.description, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {}
  }

  const highlights = [
    { icon: BadgePercent, label: `خصم ${offer.discountPercent}%`, tint: "from-rose-500 to-rose-600" },
    {
      icon: Clock,
      label: offer.durationMinutes > 0 ? `${offer.durationMinutes} دقيقة` : "خدمة فورية",
      tint: "from-primary to-primary",
    },
    { icon: Star, label: offer.vendor.reviewsCount > 0 ? `${offer.vendor.rating} (${offer.vendor.reviewsCount})` : "جديد", tint: "from-amber-500 to-orange-500" },
    { icon: ShieldCheck, label: "متجر موثّق", tint: "from-emerald-500 to-emerald-600" },
  ];

  if (isLoading) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">جاري التحميل…</p></main>
        <SiteFooter />
      </div>
    );
  }
  if (!offerData) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">العرض غير موجود.</p></main>
        <SiteFooter />
      </div>
    );
  }
  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {/* Ambient background */}
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,theme(colors.primary/15),transparent_60%)]" />

        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="mb-5 flex items-center gap-1 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-primary">الرئيسية</Link>
            <ChevronLeft className="h-3 w-3" />
            {category && (
              <>
                <Link
                  to="/offers/category/$slug"
                  params={{ slug: category.slug }}
                  className="hover:text-primary"
                >
                  {category.nameAr}
                </Link>
                <ChevronLeft className="h-3 w-3" />
              </>
            )}
            <span className="truncate text-foreground">{offer.title}</span>
          </div>

          <div className="grid gap-5 sm:gap-8 lg:grid-cols-3">
            {/* ===== Left ===== */}
            <div className="order-2 lg:order-1 lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
              {/* Gallery */}
              <div>
                <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
                  <img
                    src={gallery[activeImg]}
                    alt={offer.title}
                    className="h-56 w-full object-cover sm:h-80 md:h-[28rem]"
                  />
                  {/* gradient overlay */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  {/* Discount badge */}
                  <div className="absolute end-4 top-4 flex items-center gap-2 rounded-2xl bg-gradient-to-br from-[#E0254D] to-[#A23A8A] px-4 py-2.5 text-white shadow-xl ring-1 ring-white/20">
                    <BadgePercent className="h-5 w-5" />
                    <div className="leading-tight">
                      <div className="text-xl font-extrabold">{offer.discountPercent}%</div>
                      <div className="text-[10px] opacity-90">خصم اليوم</div>
                    </div>
                  </div>
                  {/* Category pill */}
                  {category && (
                    <Link
                      to="/offers/category/$slug"
                      params={{ slug: category.slug }}
                      className="absolute start-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-foreground backdrop-blur hover:bg-white"
                    >
                      <span className="inline-flex h-4 w-4 items-center justify-center overflow-hidden">{renderCategoryIcon(category.icon)}</span>
                      {category.nameAr}
                    </Link>
                  )}
                  {/* Bottom overlay actions */}
                  <div className="absolute bottom-4 end-4 flex gap-2">
                    <button
                      type="button"
                      onClick={toggleFavorite}
                      aria-label="حفظ"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-foreground shadow-lg backdrop-blur transition hover:scale-105"
                    >
                      <Heart className={`h-5 w-5 ${favorite ? "fill-rose-500 text-rose-500" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={handleShare}
                      aria-label="مشاركة"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-foreground shadow-lg backdrop-blur transition hover:scale-105"
                    >
                      <Share2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Thumbs */}
                {gallery.length > 1 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {gallery.map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveImg(i)}
                        className={`relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition ${
                          activeImg === i ? "border-primary shadow-md" : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title + highlights */}
              <div className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm">
                <h1 className="text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
                  {offer.title}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{offer.vendor.name} · {offer.vendor.city}</span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {highlights.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-2xl border border-border bg-muted/30 px-3 py-2.5"
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${h.tint} text-white shadow`}>
                        <h.icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-foreground">{h.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="rounded-3xl border border-border bg-card shadow-sm">
                <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
                  {[
                    { id: "overview", label: "نظرة عامة" },
                    { id: "terms", label: "الشروط" },
                    { id: "location", label: "الموقع والمنشأة" },
                    { id: "reviews", label: offer.vendor.reviewsCount > 0 ? `التقييمات (${offer.vendor.reviewsCount})` : "التقييمات" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id as typeof tab)}
                      className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${
                        tab === t.id
                          ? "bg-primary text-primary-foreground shadow"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {tab === "overview" && (
                    <div className="space-y-5">
                      {offer.description && (
                        <p className="leading-7 text-muted-foreground whitespace-pre-line">{offer.description}</p>
                      )}
                      {Array.isArray((offer as any).overview) && (offer as any).overview.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {(offer as any).overview.map((b: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 rounded-xl bg-muted/30 p-3 text-sm">
                              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <span className="text-foreground">{b}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "terms" && (
                    <ul className="space-y-3">
                      {(Array.isArray((offer as any).terms) ? (offer as any).terms : []).map((t: string, i: number) => (
                        <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3 text-sm text-foreground">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                          <span>{t}</span>
                        </li>
                      ))}
                      {(!Array.isArray((offer as any).terms) || (offer as any).terms.length === 0) && (
                        <li className="text-sm text-muted-foreground">لا توجد شروط مضافة لهذا العرض.</li>
                      )}
                    </ul>
                  )}

                  {tab === "location" && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border bg-muted/30 p-5">
                        <div className="text-lg font-extrabold text-foreground">{offer.vendor.name}</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                            <span>{offer.vendor.address}، {offer.vendor.city}</span>
                          </div>
                          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10 transition">
                            <MapPin className="h-4 w-4" /> فتح على خرائط Google
                          </a>
                          <div className="flex items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 text-primary" />
                            <span>السجل التجاري: <span dir="ltr">{offer.vendor.commercialNumber}</span></span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Star className="mt-0.5 h-4 w-4 text-amber-500" />
                            <span>{offer.vendor.reviewsCount > 0 ? `${offer.vendor.rating} · ${offer.vendor.reviewsCount} تقييم` : "لا توجد تقييمات بعد"}</span>
                          </div>

                        </div>
                      </div>

                      <div className="relative h-56 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-background">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(63,42,107,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(63,42,107,0.08)_1px,transparent_1px)] bg-[size:24px_24px]" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex flex-col items-center gap-2 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                              <MapPin className="h-7 w-7" />
                            </div>
                            <div className="text-sm font-bold text-foreground">{offer.vendor.city}</div>
                            <div className="text-xs text-muted-foreground">سيظهر العنوان التفصيلي بعد تأكيد الحجز</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {tab === "reviews" && (
                    <div className="space-y-4">
                      {(() => {
                        const displayCount = reviewStats.count || offer.vendor.reviewsCount || 0;
                        const displayAvg = reviewStats.count ? reviewStats.avg : offer.vendor.rating;
                        return (
                        <div className="flex items-center gap-4 rounded-2xl border border-border bg-muted/20 p-5">
                          <div className="text-center">
                            <div className="text-4xl font-black text-foreground">{displayCount > 0 ? displayAvg : "—"}</div>
                            <div className="mt-1 flex justify-center text-amber-500">
                              {Array.from({ length: 5 }).map((_, i) => {
                                const filled = displayCount > 0 && i < Math.round(displayAvg);
                                return (
                                  <Star key={i} className={`h-4 w-4 ${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                                );
                              })}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {displayCount > 0 ? `${displayCount} تقييم` : "لا توجد تقييمات"}
                            </div>
                          </div>
                          <div className="flex-1 space-y-1.5">
                            {[5, 4, 3, 2, 1].map((l) => {
                              const c = reviewStats.dist[l] || 0;
                              const pct = reviewStats.count ? Math.round((c / reviewStats.count) * 100) : 0;
                              return (
                                <div key={l} className="flex items-center gap-2 text-xs">
                                  <span className="w-3 font-bold text-foreground">{l}</span>
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="w-8 text-end text-muted-foreground">{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })()}

                      {/* Write a review */}
                      <form
                        onSubmit={submitReview}
                        className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-extrabold text-foreground">شاركنا تجربتك</div>
                            <div className="text-xs text-muted-foreground">تقييمك يساعد غيرك يأخذ القرار الصح</div>
                          </div>
                          {reviewSubmitted && (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
                              تم النشر ✓
                            </span>
                          )}
                        </div>

                        <div className="mb-3 flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => {
                            const val = i + 1;
                            const filled = (hoverRating || reviewRating) >= val;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setReviewRating(val)}
                                onMouseEnter={() => setHoverRating(val)}
                                onMouseLeave={() => setHoverRating(0)}
                                aria-label={`${val} نجوم`}
                                className="p-0.5 transition hover:scale-110"
                              >
                                <Star
                                  className={`h-7 w-7 ${
                                    filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                                  }`}
                                />
                              </button>
                            );
                          })}
                          <span className="ms-2 text-xs font-bold text-foreground">{reviewRating}/5</span>
                        </div>

                        {!isAuthenticated && (
                          <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                            سجّل دخول أولاً عشان تقدر تضيف تقييم
                          </div>
                        )}
                        <textarea
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          placeholder="اكتب تجربتك بالتفصيل…"
                          required
                          rows={3}
                          className="mb-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                        />
                        <button
                          type="submit"
                          disabled={reviewSubmitting}
                          className="w-full rounded-xl bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] py-2.5 text-sm font-extrabold text-white shadow transition hover:scale-[1.01] disabled:opacity-60"
                        >
                          {reviewSubmitting ? "جاري الإرسال…" : "إرسال التقييم"}
                        </button>
                      </form>

                      {userReviews.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                          لا توجد تقييمات بعد — كن أول من يشارك تجربته!
                        </div>
                      ) : (
                        userReviews.map((rv, i) => (
                          <div key={i} className="rounded-2xl border border-border bg-card p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                  {rv.name.charAt(0)}
                                </div>
                                <div className="text-sm font-bold text-foreground">{rv.name}</div>
                              </div>
                              <div className="text-xs text-muted-foreground">{rv.date}</div>
                            </div>
                            <div className="mt-2 flex text-amber-500">
                              {Array.from({ length: 5 }).map((_, j) => (
                                <Star
                                  key={j}
                                  className={`h-3.5 w-3.5 ${
                                    j < rv.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{rv.text}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* FAQ */}
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-extrabold text-foreground">أسئلة شائعة</h3>
                <div className="space-y-2">
                  {((Array.isArray((site as any)?.faqs) && (site as any).faqs.length) ? (site as any).faqs : FAQ).map((f: { q: string; a: string }, i: number) => (
                    <div key={i} className="rounded-2xl border border-border bg-muted/20">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="flex w-full items-center justify-between gap-3 p-4 text-end"
                      >
                        <span className="text-sm font-bold text-foreground">{f.q}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${openFaq === i ? "rotate-180" : ""}`} />
                      </button>
                      {openFaq === i && (
                        <div className="border-t border-border px-4 py-3 text-sm leading-6 text-muted-foreground">
                          {f.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ===== Right: Booking card ===== */}
            <aside className="order-1 lg:order-2 lg:sticky lg:top-24 h-fit min-w-0">
              <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
                {/* Price header */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#3F2A6B] via-[#6B3FA8] to-[#E0254D] p-5 sm:p-6 text-white">
                  {/* Decorative glow */}
                  <div className="pointer-events-none absolute -end-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                  <div className="pointer-events-none absolute -start-8 -bottom-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider opacity-90">
                        {step === "review" ? "مراجعة الحجز" : "السعر بعد الخصم"}
                      </div>
                      <div className="mt-2 flex items-baseline gap-2" dir="ltr">
                        <span className="text-5xl font-black leading-none tracking-tight">{offer.priceAfter}</span>
                        <div className="flex flex-col items-start leading-tight">
                          <SarIcon className="h-5 text-white" />
                          <span className="mt-0.5 text-[10px] font-bold opacity-80">ر.س</span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2" dir="ltr">
                        <span className="text-sm text-white/60 line-through">{offer.priceBefore} ر.س</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-extrabold text-emerald-100 ring-1 ring-emerald-200/30">
                          وفّر {savings} ر.س
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl bg-white/15 px-3 py-2 backdrop-blur ring-1 ring-white/20">
                      <span className="text-2xl font-black leading-none">{offer.discountPercent}%</span>
                      <span className="mt-1 text-[10px] font-bold opacity-90">خصم</span>
                    </div>
                  </div>
                </div>

                {step === "form" && (
                  <form onSubmit={goToReview} noValidate className="space-y-5 p-5 sm:p-6">
                    {/* Date + time */}
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`group relative flex cursor-pointer flex-col rounded-2xl border-2 bg-card p-3 transition ${date ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${date ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                            <Calendar className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-bold text-muted-foreground">التاريخ</span>
                        </div>
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          required
                          min={new Date().toISOString().split("T")[0]}
                          className="mt-2 w-full bg-transparent text-sm font-extrabold text-foreground outline-none [color-scheme:light]"
                        />
                      </label>
                      <label className={`group relative flex cursor-pointer flex-col rounded-2xl border-2 bg-card p-3 transition ${time ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${time ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                            <Clock className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-bold text-muted-foreground">الوقت</span>
                        </div>
                        <select
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          required
                          className="mt-2 w-full bg-transparent text-sm font-extrabold text-foreground outline-none"
                        >
                          <option value="">اختر الوقت</option>
                          {TIME_SLOTS.map((s) => {
                            const blocked = dayOff || blockedSlots.includes(s);
                            return (
                              <option key={s} value={s} disabled={blocked}>
                                {s}{blocked ? " — غير متاح" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    </div>

                    {dayOff && (
                      <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                        المركز غير متاح في هذا اليوم — يرجى اختيار تاريخ آخر.
                      </div>
                    )}

                    {/* Upcoming days strip — blocked days are struck through */}
                    <div>
                      <div className="mb-2 text-sm font-bold text-foreground">
                        أيام قريبة
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {upcomingDays.map((d) => {
                          const isSelected = date === d.iso;
                          return (
                            <button
                              key={d.iso}
                              type="button"
                              onClick={() => !d.blocked && setDate(d.iso)}
                              disabled={d.blocked}
                              title={d.blocked ? "المركز غير متاح في هذا اليوم" : undefined}
                              className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-xs font-bold transition ${
                                d.blocked
                                  ? "cursor-not-allowed border-dashed border-rose-300 bg-rose-50/60 text-rose-400 line-through opacity-70"
                                  : isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5"
                              }`}
                            >
                              <span className="text-[10px] opacity-80">{d.weekday}</span>
                              <span className="mt-0.5 text-sm">{d.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>


                    {/* Quick time slots */}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm font-bold text-foreground">
                        <span>مواعيد متاحة قريبة</span>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          مدة الجلسة: {offer.durationMinutes} د
                        </span>
                      </div>
                      {!date && (
                        <p className="mb-2 text-xs text-muted-foreground">اختر التاريخ أولاً لمعرفة المواعيد المتاحة</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {TIME_SLOTS.map((s) => {
                          const blocked = dayOff || blockedSlots.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => !blocked && setTime(s)}
                              disabled={blocked}
                              title={blocked ? (dayOff ? "اليوم غير متاح بالكامل" : "هذا الموعد غير متاح") : undefined}
                              className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                                blocked
                                  ? "cursor-not-allowed border-dashed border-rose-300 bg-rose-50 text-rose-500 line-through opacity-80"
                                  : time === s
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5"
                              }`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>


                    {/* Quantity */}
                    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3">
                      <span className="text-base font-bold text-foreground">عدد الجلسات</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQty((q) => Math.max(1, q - 1))}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-7 text-center text-base font-bold">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty((q) => Math.min(10, q + 1))}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Contact */}
                    {isAuthenticated ? (
                      <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-bold text-muted-foreground">بيانات التواصل</span>
                          <Link to="/account/profile" className="text-[11px] font-bold text-primary hover:underline">تعديل</Link>
                        </div>
                        <div className="font-bold text-foreground">{customerName || user?.name}</div>
                        {customerPhone && <div className="text-xs text-muted-foreground" dir="ltr">{customerPhone}</div>}
                        {customerEmail && <div className="text-xs text-muted-foreground" dir="ltr">{customerEmail}</div>}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-2 block text-sm font-bold text-foreground">الاسم الكامل</label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            required
                            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-bold text-foreground">البريد الإلكتروني</label>
                          <input
                            type="email"
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            required
                            placeholder="you@example.com"
                            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none focus:border-primary"
                            dir="ltr"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">هنرسل تأكيد الحجز والباركود على إيميلك</p>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-bold text-foreground">رقم الجوال</label>
                          <input
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            required
                            placeholder="05XXXXXXXX"
                            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none focus:border-primary"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    )}

                    {/* Deposit summary */}
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>الإجمالي شامل الضريبة</span>
                        <span className="font-bold text-foreground" dir="ltr">{total} ر.س</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="font-bold text-foreground">عربون الحجز ({depositPct}%)</span>
                        <span className="font-extrabold text-primary" dir="ltr">{depositAmount} ر.س</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>المتبقي عند الخدمة</span>
                        <span dir="ltr">{remainingAmount} ر.س</span>
                      </div>
                    </div>


                    <div className="space-y-2">
                      <button
                        type="submit"
                        className="w-full rounded-xl bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] py-4 text-base font-extrabold text-white shadow-lg shadow-primary/30 transition hover:scale-[1.01]"
                      >
                        احجز الآن — دفع العربون ←
                      </button>
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary/5 py-3 text-sm font-extrabold text-primary transition hover:bg-primary/10"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        أضف للسلة (طلب جماعي)
                      </button>
                      <p className="text-center text-[11px] text-muted-foreground">
                        أضف عدة عروض من مراكز مختلفة وادفع عربون موحّد مرة واحدة.
                      </p>
                    </div>
                  </form>
                )}

                {step === "review" && (
                  <div className="space-y-4 p-5 sm:p-6">
                    {/* Service & schedule */}
                    <section className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">الخدمة والموعد</div>
                      <div className="text-base font-extrabold text-foreground leading-snug">{offer.title}</div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /><span className="font-bold">{date}</span></div>
                        <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /><span className="font-bold">{time}</span></div>
                        <div className="col-span-2 flex items-center gap-2 text-muted-foreground"><span className="text-xs">عدد الجلسات:</span><span className="font-bold text-foreground">{qty}</span></div>
                      </div>
                    </section>

                    {/* Vendor */}
                    <section className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">بيانات التاجر</div>
                      <div className="text-base font-extrabold text-foreground">{offer.vendor.name}</div>
                      <div className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{offer.vendor.address}، {offer.vendor.city}</span>
                      </div>
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10">
                        <MapPin className="h-3.5 w-3.5" /> فتح على خرائط Google
                      </a>

                    </section>

                    {/* Customer */}
                    <section className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">بيانات العميل</div>
                      <div className="space-y-1 text-sm">
                        <div className="font-bold text-foreground">{customerName}</div>
                        <div className="text-muted-foreground" dir="ltr">{customerPhone}</div>
                        <div className="text-muted-foreground" dir="ltr">{customerEmail}</div>
                      </div>
                    </section>

                    {/* Payment breakdown */}
                    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-primary mb-3">تفاصيل الدفع</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>سعر الجلسة × {qty}</span>
                          <span dir="ltr">{total} ر.س</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-600">
                          <span>وفّرت</span>
                          <span dir="ltr">{savings * qty} ر.س</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-border pt-2 text-base font-bold text-foreground">
                          <span>الإجمالي شامل الضريبة</span>
                          <span dir="ltr">{total} ر.س</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 text-base font-extrabold text-primary">
                          <span>عربون الآن ({depositPct}%)</span>
                          <span dir="ltr">{depositAmount} ر.س</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>المتبقي يُدفع عند الخدمة</span>
                          <span dir="ltr">{remainingAmount} ر.س</span>
                        </div>
                      </div>
                    </section>

                    {/* Cancellation policy */}
                    <section className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">شروط الإلغاء</div>
                      <ul className="space-y-1.5 text-xs text-muted-foreground leading-6">
                        {cancellationTerms.map((t, i) => (
                          <li key={i}>• {t}</li>
                        ))}
                      </ul>

                    </section>

                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-1 h-4 w-4 accent-primary"
                      />
                      <span className="text-muted-foreground">أوافق على شروط وأحكام الحجز وسياسة الإلغاء.</span>
                    </label>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setStep("form")}
                        className="flex-1 rounded-xl border border-border bg-background py-3.5 text-base font-bold text-foreground transition hover:bg-muted"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={confirmBooking}
                        disabled={loading || !agreed}
                        className="flex-[2] rounded-xl bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] py-3.5 text-base font-extrabold text-white shadow-lg shadow-primary/30 transition hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
                      >
                        {loading ? "جاري تأكيد الحجز…" : `تأكيد ودفع العربون — ${depositAmount} ر.س`}
                      </button>
                    </div>
                  </div>
                )}

                {/* Trust strip */}
                <div className="grid grid-cols-3 gap-2 border-t border-border bg-muted/20 p-4 text-center text-[11px] text-muted-foreground">
                  <div className="flex flex-col items-center gap-1">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>دفع آمن</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <QrCode className="h-4 w-4 text-primary" />
                    <span>باركود فوري</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <RotateCcw className="h-4 w-4 text-rose-500" />
                    <span>إلغاء مرن</span>
                  </div>
                </div>
              </div>

              {/* Booked counter */}
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-bold text-foreground">{Math.max(12, offer.vendor.reviewsCount % 80)}+</span> شخص حجز هذا العرض هذا الأسبوع
                </div>
              </div>
            </aside>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-16">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-foreground">عروض مشابهة</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    اكتشف عروضاً أخرى في {category?.nameAr || "نفس الفئة"}
                  </p>
                </div>
                {category && (
                  <Link
                    to="/offers/category/$slug"
                    params={{ slug: category.slug }}
                    className="hidden text-sm font-bold text-primary hover:underline sm:block"
                  >
                    عرض الكل ←
                  </Link>
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((o: any) => (
                  <OfferCard key={o.id} offer={o} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
