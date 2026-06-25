import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import {
  ShieldCheck, Search, Loader2, CheckCircle2, XCircle,
  User as UserIcon, Phone, Calendar, Clock, Tag, Hash, CreditCard, MapPin, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { adminBookingsApi, type AdminBooking } from "@/lib/api/adminBookings";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/admin/verify")({
  head: () => ({ meta: [{ title: "Verify Booking | Admin" }] }),
  component: AdminVerifyPage,
});

function pickRef(b: any): string {
  return String(
    b?.qrCode || b?.qr_code || b?.bookingNumber || b?.booking_number || ""
  );
}
function pickVerifyCode(b: any): string {
  return String(b?.verifyCode || b?.verify_code || "");
}
function pickOfferTitle(b: any): string | undefined {
  return b?.offerTitle || b?.offer_title || b?.offer?.title || b?.offer?.titleAr;
}
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
function pickDate(b: any): string {
  const raw = String(b?.booking_date || b?.bookingDate || "");
  if (raw) return formatDate(raw);
  if (b?.scheduledAt) {
    const d = new Date(b.scheduledAt);
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
  }
  return "";
}
function pickTime(b: any, lang: "ar" | "en"): string {
  const am = lang === "en" ? "AM" : "ص";
  const pm = lang === "en" ? "PM" : "م";
  const raw = String(b?.booking_time || b?.bookingTime || "");
  if (raw) {
    const m = raw.match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      const hh = parseInt(m[1]);
      const mm = m[2];
      const ampm = hh >= 12 ? pm : am;
      const h12 = ((hh + 11) % 12) + 1;
      return `${h12}:${mm} ${ampm}`;
    }
    return raw;
  }
  if (b?.scheduledAt) {
    const d = new Date(b.scheduledAt);
    if (!isNaN(d.getTime())) {
      const hh = d.getHours();
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ampm = hh >= 12 ? pm : am;
      const h12 = ((hh + 11) % 12) + 1;
      return `${h12}:${mm} ${ampm}`;
    }
  }
  return "";
}
function pickCustomerName(b: any): string {
  return b?.customerName || b?.customer_name || "";
}
function pickCustomerPhone(b: any): string {
  return b?.customerPhone || b?.customer_phone || "";
}
function pickAmount(b: any): number | null {
  const v = b?.amount ?? b?.total ?? b?.total_amount ?? b?.totalAmount;
  return v == null || v === "" ? null : Number(v);
}
function pickDepositAmount(b: any): number | null {
  const v = b?.deposit_amount ?? b?.depositAmount ?? b?.commission ?? b?.commissionAmount ?? b?.commission_amount;
  return v == null || v === "" ? null : Number(v);
}
function pickStatus(b: any): string {
  return String(b?.status || "").toLowerCase();
}
function pickRedeemedAt(b: any): string | null {
  return b?.redeemed_at || b?.redeemedAt || null;
}
function pickPaymentStatus(b: any): string {
  return String(b?.payment_status || b?.paymentStatus || "").toLowerCase();
}
function pickPaymentMethod(b: any): string {
  return String(b?.payment_method || b?.paymentMethod || "").toLowerCase();
}
function pickPartnerName(b: any): string {
  return b?.partner_name || b?.partnerName || b?.vendor_name || b?.vendorName || b?.partner?.name || "";
}
function pickPartnerCity(b: any): string {
  return b?.partner_city || b?.partnerCity || b?.city || b?.partner?.city || "";
}
function statusBadge(st: string, L: (a: string, e: string) => string): { label: string; cls: string } {
  if (st === "completed" || st === "redeemed") return { label: L("مكتمل", "Completed"), cls: "bg-emerald-100 text-emerald-800 border-emerald-300" };
  if (st === "cancelled" || st === "canceled") return { label: L("ملغي", "Cancelled"), cls: "bg-rose-100 text-rose-800 border-rose-300" };
  if (st === "confirmed") return { label: L("مؤكد", "Confirmed"), cls: "bg-emerald-100 text-emerald-800 border-emerald-300" };
  if (st === "pending") return { label: L("قيد الانتظار", "Pending"), cls: "bg-amber-100 text-amber-800 border-amber-300" };
  if (st === "no_show") return { label: L("لم يحضر", "No show"), cls: "bg-rose-100 text-rose-800 border-rose-300" };
  return { label: st || "—", cls: "bg-slate-100 text-slate-800 border-slate-300" };
}
function payBadge(ps: string, remaining: number | null, L: (a: string, e: string) => string): { label: string; cls: string } {
  if (ps === "paid" || ps === "completed" || ps === "success") return { label: L("مدفوع بالكامل", "Paid in full"), cls: "bg-emerald-100 text-emerald-800 border-emerald-300" };
  if (ps === "deposit_paid" || (remaining != null && remaining > 0 && ps && ps !== "unpaid" && ps !== "pending")) return { label: L("عربون مدفوع", "Deposit paid"), cls: "bg-amber-100 text-amber-800 border-amber-300" };
  if (ps === "pending") return { label: L("قيد الدفع", "Payment pending"), cls: "bg-amber-100 text-amber-800 border-amber-300" };
  if (ps === "failed") return { label: L("فشل الدفع", "Payment failed"), cls: "bg-rose-100 text-rose-800 border-rose-300" };
  if (ps === "refunded") return { label: L("مُسترجَع", "Refunded"), cls: "bg-slate-100 text-slate-800 border-slate-300" };
  return { label: L("غير مدفوع", "Unpaid"), cls: "bg-rose-100 text-rose-800 border-rose-300" };
}
function methodLabel(m: string, L: (a: string, e: string) => string): string {
  if (m === "tamara") return L("تمارا", "Tamara");
  if (m === "tabby") return L("تابي", "Tabby");
  if (m === "myfatoorah") return L("ماي فاتورة", "MyFatoorah");
  if (m === "cod") return L("الدفع عند الخدمة", "Pay at venue");
  if (!m) return "—";
  return m;
}

function matchBooking(x: any, rawIdQ: string, idQ: string): boolean {
  const id = String(x.id || "").toUpperCase();
  const idShort = id.replace(/-/g, "").slice(-6);
  const bn = pickRef(x)
    .replace(/\s+/g, "").replace(/^#/, "").replace(/^BK[-_ ]?/i, "").toUpperCase();
  const phone = pickCustomerPhone(x);
  return (
    id === idQ ||
    id.endsWith(idQ) ||
    idShort === idQ ||
    (bn !== "" && (bn === idQ || bn.endsWith(idQ))) ||
    (phone !== "" && phone.endsWith(rawIdQ))
  );
}

function AdminVerifyPage() {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const currency = L("ر.س", "SAR");
  const [bookingId, setBookingId] = useState("");
  const [code, setCode] = useState("");
  const [items, setItems] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<
    | { status: "idle" }
    | { status: "notfound" }
    | { status: "wrong" }
    | { status: "ok"; booking: AdminBooking; alreadyRedeemed: boolean }
  >({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const b: any = await adminBookingsApi.list({ limit: 300 });
      setItems(((b?.items || b || []) as AdminBooking[]));
    } catch {
      setItems([]);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rawIdQ = bookingId.trim();
    const codeQ = code.trim();
    const idQ = rawIdQ.replace(/\s+/g, "").replace(/^#/, "").replace(/^bk[-_ ]?/i, "").toUpperCase();
    if (!idQ || codeQ.length < 4) { toast.error(L("أدخل رقم الحجز ورمز التحقق", "Enter booking number and verification code")); return; }
    setSubmitting(true);
    let b: any = items.find((x) => matchBooking(x, rawIdQ, idQ));
    if (!b) {
      try {
        const r1: any = await adminBookingsApi.list({ q: rawIdQ, limit: 50 }).catch(() => ({ items: [] }));
        const r2: any = rawIdQ !== idQ
          ? await adminBookingsApi.list({ q: idQ, limit: 50 }).catch(() => ({ items: [] }))
          : { items: [] };
        const r3: any = await adminBookingsApi.list({ q: codeQ, limit: 50 }).catch(() => ({ items: [] }));
        const pool = [...(r1.items || []), ...(r2.items || []), ...(r3.items || [])];
        b = pool.find((x: any) => matchBooking(x, rawIdQ, idQ));
      } catch { /* ignore */ }
    }
    if (!b) { setResult({ status: "notfound" }); setSubmitting(false); return; }
    if ((pickVerifyCode(b) || "") !== codeQ) { setResult({ status: "wrong" }); setSubmitting(false); return; }
    const st = pickStatus(b);
    const already = !!pickRedeemedAt(b) || st === "completed" || st === "redeemed";
    setResult({ status: "ok", booking: b, alreadyRedeemed: already });
    setSubmitting(false);
  }

  async function confirmRedeem() {
    if (result.status !== "ok") return;
    const b = result.booking;
    if (pickStatus(b) === "cancelled") { toast.error(L("هذا الحجز ملغي", "This booking is cancelled")); return; }
    setRedeeming(true);
    try {
      try {
        await adminBookingsApi.redeem(b.id, code.trim());
      } catch {
        await adminBookingsApi.setStatus(b.id, "completed");
      }
      const stamped: any = { ...b, status: "completed", redeemed_at: new Date().toISOString() };
      setItems((prev) => prev.map((x) => x.id === b.id ? stamped : x));
      setResult({ status: "ok", booking: stamped, alreadyRedeemed: true });
      toast.success(L(`تم تأكيد حضور: ${pickCustomerName(b)}`, `Check-in confirmed: ${pickCustomerName(b)}`));
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر تأكيد الحجز", "Failed to confirm booking"));
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
  const totalWithVat = b ? pickAmount(b) : null;
  const paidOnline = b ? Number(pickDepositAmount(b) ?? 0) : 0;
  const remaining = totalWithVat != null ? Math.max(0, +(totalWithVat - paidOnline).toFixed(2)) : null;

  return (
    <AdminLayout
      title={L("التحقق من الحجز", "Verify Booking")}
      subtitle={L("تحقق من رقم الحجز ورمز التأكيد واطّلع على كامل تفاصيل الحجز", "Verify a booking by reference and code, and review full booking details")}
    >
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-xl">
          <div className="bg-gradient-to-r from-[#3F2A6B] to-[#5a3d8f] p-6 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold">{L("التحقق من حجز العميل", "Verify customer booking")}</h2>
                <p className="text-xs text-white/85">{L("للمراكز فقط — أدخل رقم الحجز ورمز التأكيد", "Merchants only — enter the booking number and verification code")}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground text-right">{L("رقم الحجز", "Booking number")}</label>
              <input
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                placeholder="BK-XXXXXX"
                dir="ltr"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base font-bold tracking-wider text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground text-right">{L("رمز التأكيد (6 أرقام)", "Verification code (6 digits)")}</label>
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
              {submitting || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} {L("تحقّق", "Verify")}
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
              <div className="text-sm font-bold">{L("رمز التأكيد غير صحيح.", "Incorrect verification code.")}</div>
            </div>
          )}

          {result.status === "ok" && b && (
            <div className="mx-6 mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-3 bg-emerald-100/60 px-4 py-3 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <div className="text-sm font-extrabold">
                  {result.alreadyRedeemed ? L("تم استخدام هذا الحجز مسبقاً", "This booking has already been redeemed") : L("الحجز صحيح ومؤكد", "Booking is valid and confirmed")}
                </div>
              </div>
              <div className="space-y-2 p-4 text-sm">
                {(() => {
                  const st = pickStatus(b);
                  const ps = pickPaymentStatus(b);
                  const sb = statusBadge(st, L);
                  const pb = payBadge(ps, remaining, L);
                  return (
                    <div className="mb-2 grid grid-cols-2 gap-2">
                      <div className={`flex items-center justify-between rounded-xl border px-3 py-2 ${sb.cls}`}>
                        <span className="text-[11px] font-bold">{L("حالة الحجز", "Booking status")}</span>
                        <span className="text-xs font-extrabold">{sb.label}</span>
                      </div>
                      <div className={`flex items-center justify-between rounded-xl border px-3 py-2 ${pb.cls}`}>
                        <span className="text-[11px] font-bold">{L("حالة الدفع", "Payment status")}</span>
                        <span className="text-xs font-extrabold">{pb.label}</span>
                      </div>
                    </div>
                  );
                })()}
                <VRow icon={Hash} label={L("رقم الحجز", "Booking #")} value={pickRef(b) || String(b?.id || "—")} ltr />
                <VRow icon={UserIcon} label={L("العميل", "Customer")} value={pickCustomerName(b) || "—"} />
                <VRow icon={Tag} label={L("العرض", "Offer")} value={pickOfferTitle(b) || "—"} />
                <VRow icon={Phone} label={L("الجوال", "Phone")} value={pickCustomerPhone(b) || "—"} ltr />
                <VRow icon={Calendar} label={L("التاريخ", "Date")} value={pickDate(b) || "—"} ltr />
                <VRow icon={Clock} label={L("الوقت", "Time")} value={pickTime(b, lang as any) || "—"} ltr />
                {pickPartnerName(b) && (
                  <VRow icon={Building2} label={L("المركز", "Merchant")} value={pickPartnerName(b)} />
                )}
                {pickPartnerCity(b) && (
                  <VRow icon={MapPin} label={L("المدينة", "City")} value={pickPartnerCity(b)} />
                )}
                {pickPaymentMethod(b) && (
                  <VRow icon={CreditCard} label={L("طريقة الدفع", "Payment method")} value={methodLabel(pickPaymentMethod(b), L)} />
                )}

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2">
                    <div className="text-[11px] font-bold text-emerald-700">{L("إجمالي الحجز", "Booking total")}</div>
                    <div dir="ltr" className="mt-0.5 text-sm font-extrabold text-foreground">
                      {totalWithVat != null ? `${totalWithVat} ${currency}` : "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2">
                    <div className="text-[11px] font-bold text-emerald-700">{L("العربون المدفوع", "Deposit paid")}</div>
                    <div dir="ltr" className="mt-0.5 text-sm font-extrabold text-foreground">
                      {paidOnline > 0 ? `${paidOnline} ${currency}` : `0 ${currency}`}
                    </div>
                  </div>
                  <div className={`rounded-xl border px-3 py-2 ${remaining != null && remaining > 0 ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-white"}`}>
                    <div className={`text-[11px] font-bold ${remaining != null && remaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>{L("المتبقي عند المركز", "Remaining at merchant")}</div>
                    <div dir="ltr" className={`mt-0.5 text-sm font-extrabold ${remaining != null && remaining > 0 ? "text-amber-800" : "text-foreground"}`}>
                      {remaining != null ? `${remaining} ${currency}` : "—"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-3">
                  {!result.alreadyRedeemed && (
                    <button
                      type="button"
                      onClick={confirmRedeem}
                      disabled={redeeming}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {redeeming && <Loader2 className="h-4 w-4 animate-spin" />} {L("تأكيد استخدام الحجز", "Confirm redemption")}
                    </button>
                  )}
                  <button
                    type="button"
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
      </div>
    </AdminLayout>
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
