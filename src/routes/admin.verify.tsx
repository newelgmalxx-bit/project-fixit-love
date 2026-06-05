import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import {
  ShieldCheck, Search, Loader2, CheckCircle2, XCircle,
  User as UserIcon, Phone, Calendar, Clock, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { adminBookingsApi, type AdminBooking } from "@/lib/api/adminBookings";

export const Route = createFileRoute("/admin/verify")({
  head: () => ({ meta: [{ title: "التحقق من الحجز | الإدارة" }] }),
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
function pickDate(b: any): string {
  return String(b?.booking_date || b?.bookingDate || (b?.scheduledAt ? new Date(b.scheduledAt).toLocaleDateString() : "") || "");
}
function pickTime(b: any): string {
  return String(b?.booking_time || b?.bookingTime || (b?.scheduledAt ? new Date(b.scheduledAt).toLocaleTimeString() : "") || "");
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
    if (!idQ || codeQ.length < 4) { toast.error("أدخل رقم الحجز ورمز التحقق"); return; }
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
    if (pickStatus(b) === "cancelled") { toast.error("هذا الحجز ملغي"); return; }
    setRedeeming(true);
    try {
      // Backend has no dedicated /redeem endpoint for admin — use the status endpoint
      // (same one used by the bookings list "تأكيد" button which is known to work).
      try {
        await adminBookingsApi.redeem(b.id, code.trim());
      } catch {
        await adminBookingsApi.setStatus(b.id, "completed");
      }
      const stamped: any = { ...b, status: "completed", redeemed_at: new Date().toISOString() };
      setItems((prev) => prev.map((x) => x.id === b.id ? stamped : x));
      setResult({ status: "ok", booking: stamped, alreadyRedeemed: true });
      toast.success(`تم تأكيد حضور: ${pickCustomerName(b)}`);
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
  const totalWithVat = b ? pickAmount(b) : null;
  const paidOnline = b ? Number(pickDepositAmount(b) ?? 0) : 0;
  const remaining = totalWithVat != null ? Math.max(0, +(totalWithVat - paidOnline).toFixed(2)) : null;

  return (
    <AdminLayout
      title="التحقق من الحجز"
      subtitle="تحقق من رقم الحجز ورمز التأكيد واطّلع على كامل تفاصيل الحجز"
    >
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
                <VRow icon={UserIcon} label="العميل" value={pickCustomerName(b) || "—"} />
                <VRow icon={Tag} label="العرض" value={pickOfferTitle(b) || "—"} />
                <VRow icon={Phone} label="الجوال" value={pickCustomerPhone(b) || "—"} ltr />
                <VRow icon={Calendar} label="التاريخ" value={pickDate(b) || "—"} ltr />
                <VRow icon={Clock} label="الوقت" value={pickTime(b) || "—"} ltr />
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