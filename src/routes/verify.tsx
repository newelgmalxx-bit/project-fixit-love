import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Search, CheckCircle2, XCircle, ArrowLeft, Calendar, Clock, User, Phone, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { pushVerifyEvent, playSuccessChime } from "@/lib/verifyFeed";
import { useLang } from "@/i18n/LanguageProvider";


function formatDate(s: string): string {
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const yy = y.length === 2 ? `20${y}` : y;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${yy}`;
  }
  return s;
}

export const Route = createFileRoute("/verify")({
  head: () => ({ meta: [{ title: "التحقق من حجز | بوكينج" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    b: typeof s.b === "string" ? s.b : undefined,
    c: typeof s.c === "string" ? s.c : undefined,
    demo: typeof s.demo === "string" ? s.demo : undefined,
  }),
  component: VerifyPage,
});

type StoredBooking = {
  bookingId: string;
  verifyCode: string;
  offerId: string;
  offerTitle?: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  total?: number;
  depositAmount?: number;
  remainingAmount?: number;
  redeemedAt?: string;
  paymentStatus?: "paid" | "deposit_paid" | "unpaid";
};

function getPaymentStatus(b: StoredBooking, lang: "ar" | "en"): { key: "paid" | "deposit_paid" | "unpaid"; label: string; cls: string } {
  let key: "paid" | "deposit_paid" | "unpaid" = b.paymentStatus ?? "unpaid";
  if (!b.paymentStatus) {
    const total = Number(b.total ?? 0);
    const deposit = Number(b.depositAmount ?? 0);
    const remaining = Number(b.remainingAmount ?? 0);
    if (total > 0 && remaining === 0 && (deposit > 0 || total > 0)) key = "paid";
    else if (deposit > 0) key = "deposit_paid";
    else key = "unpaid";
  }
  const labels = {
    paid: { ar: "مدفوع بالكامل", en: "Fully paid" },
    deposit_paid: { ar: "عربون مدفوع", en: "Deposit paid" },
    unpaid: { ar: "غير مدفوع", en: "Unpaid" },
  } as const;
  if (key === "paid") return { key, label: labels.paid[lang], cls: "bg-emerald-100 text-emerald-800 border-emerald-300" };
  if (key === "deposit_paid") return { key, label: labels.deposit_paid[lang], cls: "bg-amber-100 text-amber-800 border-amber-300" };
  return { key, label: labels.unpaid[lang], cls: "bg-rose-100 text-rose-800 border-rose-300" };
}

function loadAll(): StoredBooking[] {
  try {
    const raw = localStorage.getItem("myBookings");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(list: StoredBooking[]) {
  try {
    localStorage.setItem("myBookings", JSON.stringify(list));
  } catch {}
}

function emitRedemption(b: StoredBooking, source: "qr" | "manual") {
  pushVerifyEvent({
    bookingId: b.bookingId,
    verifyCode: b.verifyCode,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    offerId: b.offerId,
    offerTitle: b.offerTitle,
    bookingDate: b.date,
    bookingTime: b.time,
    redeemedAt: b.redeemedAt || new Date().toISOString(),
    source,
  });
  playSuccessChime();
}

function decodeDemo(demo?: string): Partial<StoredBooking> | null {
  if (!demo) return null;
  try {
    const json = decodeURIComponent(escape(atob(demo)));
    const d = JSON.parse(json);
    return {
      bookingId: d.b,
      verifyCode: d.c,
      offerId: d.o,
      customerName: d.n,
      customerPhone: d.p,
      date: d.d,
      time: d.t,
      remainingAmount: d.r,
    };
  } catch {
    return null;
  }
}

function VerifyPage() {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { b, c, demo } = Route.useSearch();
  const [bookingId, setBookingId] = useState(b ?? "");
  const [code, setCode] = useState(c ?? "");
  const [result, setResult] = useState<
    | { status: "idle" }
    | { status: "ok"; booking: StoredBooking; alreadyRedeemed: boolean; redeemedNow?: boolean }
    | { status: "notfound" }
    | { status: "wrong" }
  >({ status: "idle" });
  const autoRanRef = useRef(false);

  useEffect(() => {
    if (!b || !c || autoRanRef.current) return;
    autoRanRef.current = true;
    const all = loadAll();
    let found = all.find((x) => x.bookingId.toUpperCase() === b.toUpperCase());

    if (!found || found.verifyCode !== c) {
      const decoded = decodeDemo(demo);
      const synthetic: StoredBooking = {
        bookingId: (decoded?.bookingId || b).toUpperCase(),
        verifyCode: c,
        offerId: decoded?.offerId || found?.offerId || "",
        date: decoded?.date || found?.date || "",
        time: decoded?.time || found?.time || "",
        customerName: decoded?.customerName || found?.customerName || L("عميل", "Customer"),
        customerPhone: decoded?.customerPhone || found?.customerPhone || "",
        remainingAmount: decoded?.remainingAmount ?? found?.remainingAmount,
      };
      const next = found
        ? all.map((x) => x.bookingId === found!.bookingId ? { ...x, ...synthetic } : x)
        : [...all, synthetic];
      saveAll(next);
      found = synthetic;
    }

    if (found.redeemedAt) {
      setResult({ status: "ok", booking: found, alreadyRedeemed: true, redeemedNow: true });
      return;
    }
    const stamped = { ...found, redeemedAt: new Date().toISOString() };
    saveAll(loadAll().map((x) => x.bookingId === found!.bookingId ? stamped : x));
    emitRedemption(stamped, "qr");
    setResult({ status: "ok", booking: stamped, alreadyRedeemed: false, redeemedNow: true });
  }, [b, c, demo]);

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const id = bookingId.trim().toUpperCase();
    const cv = code.trim();
    if (!id || !cv) return;
    const all = loadAll();
    const found = all.find((x) => x.bookingId.toUpperCase() === id);
    if (!found) return setResult({ status: "notfound" });
    if (found.verifyCode !== cv) return setResult({ status: "wrong" });
    setResult({ status: "ok", booking: found, alreadyRedeemed: !!found.redeemedAt });
  }

  function markRedeemed() {
    if (result.status !== "ok") return;
    const all = loadAll();
    const stamped = { ...result.booking, redeemedAt: new Date().toISOString() };
    saveAll(all.map((x) => x.bookingId === stamped.bookingId ? stamped : x));
    emitRedemption(stamped, "manual");
    setResult({ status: "ok", booking: stamped, alreadyRedeemed: true, redeemedNow: true });
  }

  function reset() {
    setBookingId("");
    setCode("");
    setResult({ status: "idle" });
  }

  const isSuccessFromQr = result.status === "ok" && !!result.redeemedNow;

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-muted/30">
      <SiteHeader />
      <main className="flex-1 py-10">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Link to="/" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
            <ArrowLeft className={`h-3.5 w-3.5 ${dir === "ltr" ? "rotate-180" : ""}`} /> {L("الرئيسية", "Home")}
          </Link>

          {isSuccessFromQr ? (
            <SuccessHero booking={(result as any).booking} lang={lang} L={L} />
          ) : null}

          <div className={`rounded-3xl border border-border bg-white shadow-xl overflow-hidden ${isSuccessFromQr ? "hidden" : ""}`}>
            <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold">{L("التحقق من حجز العميل", "Verify a customer booking")}</h1>
                  <p className="text-xs text-white/85">{L("للمراكز فقط — أدخل رقم الحجز ورمز التأكيد", "Centers only — enter the booking number and confirmation code")}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{L("رقم الحجز", "Booking number")}</label>
                <input
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  placeholder="BK-XXXXXX"
                  dir="ltr"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base font-bold tracking-wider text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{L("رمز التأكيد (6 أرقام)", "Confirmation code (6 digits)")}</label>
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                <Search className="h-4 w-4" /> {L("تحقّق", "Verify")}
              </button>
            </form>

            {result.status === "notfound" && (
              <div className="mx-6 mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                <XCircle className="h-5 w-5 shrink-0" />
                <div className="text-sm font-bold">{L("رقم الحجز غير موجود.", "Booking number not found.")}</div>
              </div>
            )}
            {result.status === "wrong" && (
              <div className="mx-6 mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                <XCircle className="h-5 w-5 shrink-0" />
                <div className="text-sm font-bold">{L("رمز التأكيد غير صحيح.", "Confirmation code is incorrect.")}</div>
              </div>
            )}
            {result.status === "ok" && !isSuccessFromQr && (
              <div className="mx-6 mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50">
                <div className="flex items-center gap-3 bg-emerald-100/60 px-4 py-3 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <div className="text-sm font-extrabold">
                    {result.alreadyRedeemed ? L("تم استخدام هذا الحجز مسبقاً", "This booking was already redeemed") : L("الحجز صحيح ومؤكد", "Booking is valid and confirmed")}
                  </div>
                </div>
                <div className="space-y-2 p-4 text-sm text-foreground">
                  {(() => { const ps = getPaymentStatus(result.booking, lang); return (
                    <div className={`mb-2 flex items-center justify-between rounded-xl border px-3 py-2 ${ps.cls}`}>
                      <span className="text-xs font-bold">{L("حالة الدفع", "Payment status")}</span>
                      <span className="text-sm font-extrabold">{ps.label}</span>
                    </div>
                  ); })()}
                  <Row icon={User} label={L("العميل", "Customer")} value={result.booking.customerName} />
                  <Row icon={Phone} label={L("الجوال", "Phone")} value={result.booking.customerPhone} ltr />
                  <Row icon={Calendar} label={L("التاريخ", "Date")} value={formatDate(result.booking.date)} ltr />
                  <Row icon={Clock} label={L("الوقت", "Time")} value={result.booking.time} ltr />
                  {result.booking.remainingAmount ? (
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-amber-800">
                      <span className="text-xs font-bold">{L("يتبقى عند الخدمة", "Remaining at service")}</span>
                      <span dir="ltr" className="font-extrabold">{result.booking.remainingAmount} {L("ر.س", "SAR")}</span>
                    </div>
                  ) : null}
                  <div className="flex gap-2 pt-3">
                    {!result.alreadyRedeemed && (
                      <button
                        onClick={markRedeemed}
                        className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                      >
                        {L("تأكيد استخدام الحجز", "Confirm booking redemption")}
                      </button>
                    )}
                    <button
                      onClick={reset}
                      className="flex-1 rounded-xl border border-border bg-white py-2.5 text-sm font-bold text-foreground hover:border-primary"
                    >
                      {L("تحقّق من حجز آخر", "Verify another booking")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {L("نسخة تجريبية — البيانات محلية لهذا الجهاز. سيتم ربطها بقاعدة البيانات لاحقاً.", "Demo version — data is local to this device. Will be linked to the database later.")}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function SuccessHero({ booking, lang, L }: { booking: StoredBooking; lang: "ar" | "en"; L: (a: string, e: string) => string }) {
  const offerTitle = booking.offerTitle || L("خدمة", "Service");
  const redeemedAt = booking.redeemedAt ? new Date(booking.redeemedAt) : new Date();
  const ps = getPaymentStatus(booking, lang);
  return (
    <div className="mb-6 overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 shadow-xl">
      <div className="relative bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-8 text-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 shadow-inner ring-4 ring-white/20">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">
              <Sparkles className="h-3 w-3" /> {L("نجحت قراءة الباركود", "Barcode scanned successfully")}
            </div>
            <h2 className="mt-1 text-2xl font-black">{L("تم تأكيد الخدمة بنجاح", "Service confirmed successfully")}</h2>
            <p className="text-xs text-white/90">{L("تم تسجيل استخدام الحجز ووصل التنبيه إلى لوحة المركز والإدارة.", "Booking redemption logged and notification sent to the center and admin dashboards.")}</p>
          </div>
        </div>
      </div>
      <div className="px-5 pt-4">
        <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${ps.cls}`}>
          <span className="text-xs font-bold">{L("حالة الدفع", "Payment status")}</span>
          <span className="text-base font-extrabold">{ps.label}</span>
        </div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <InfoBox label={L("العميل", "Customer")} value={booking.customerName} icon={User} />
        <InfoBox label={L("الجوال", "Phone")} value={booking.customerPhone} icon={Phone} ltr />
        <InfoBox label={L("الخدمة", "Service")} value={offerTitle} icon={Sparkles} />
        <InfoBox label={L("رقم الحجز", "Booking #")} value={booking.bookingId} icon={ShieldCheck} ltr />
        <InfoBox label={L("موعد الحجز", "Booking time")} value={`${formatDate(booking.date)} · ${booking.time}`} icon={Calendar} ltr />
        <InfoBox label={L("وقت التأكيد", "Confirmed at")} value={redeemedAt.toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })} icon={Clock} ltr />
      </div>
    </div>
  );
}

function InfoBox({ icon: Icon, label, value, ltr }: { icon: any; label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-2xl border border-emerald-200/70 bg-white p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 truncate text-sm font-extrabold text-foreground" dir={ltr ? "ltr" : undefined}>{value}</div>
    </div>
  );
}

function Row({ icon: Icon, label, value, ltr }: { icon: any; label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-emerald-200/60 pb-1.5 last:border-0">
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="font-bold text-foreground" dir={ltr ? "ltr" : undefined}>{value}</div>
    </div>
  );
}
