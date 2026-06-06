import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, QrCode, CheckCircle2, Ticket, X, Pencil, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useLang } from "@/i18n/LanguageProvider";
import { account } from "@/lib/api/account";


export const Route = createFileRoute("/account/bookings")({
  head: () => ({ meta: [{ title: "حجوزاتي | بوكينج" }] }),
  component: MyBookings,
});

type StoredBooking = {
  bookingId: string;
  bookingRef: string;
  verifyCode: string;
  offerId: string;
  offerTitle?: string;
  vendorName?: string;
  vendorCity?: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  total?: number;
  depositAmount?: number;
  remainingAmount?: number;
  redeemedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  status?: string;
  paymentStatus?: string;
};

function normalizeRow(r: any): StoredBooking {
  const ref = String(r.booking_number ?? r.bookingNumber ?? r.id ?? "");
  const display = String(r.qr_code ?? r.qrCode ?? ref);
  return {
    bookingId: display,
    bookingRef: ref || display,
    verifyCode: String(r.verify_code ?? r.verifyCode ?? ""),
    offerId: String(r.offer_id ?? r.offerId ?? ""),
    offerTitle: r.offer_title ?? r.offerTitle ?? undefined,
    vendorName: r.partner_name ?? r.vendorName ?? undefined,
    vendorCity: r.partner_city ?? r.vendorCity ?? undefined,
    date: String(r.booking_date ?? r.bookingDate ?? r.date ?? ""),
    time: String(r.booking_time ?? r.bookingTime ?? r.time ?? ""),
    customerName: String(r.customer_name ?? r.customerName ?? ""),
    customerPhone: String(r.customer_phone ?? r.customerPhone ?? ""),
    total: r.total_amount != null ? Number(r.total_amount) : (r.total != null ? Number(r.total) : undefined),
    depositAmount: r.deposit_amount != null ? Number(r.deposit_amount) : (r.depositAmount != null ? Number(r.depositAmount) : undefined),
    remainingAmount: r.remaining_amount != null ? Number(r.remaining_amount) : (r.remainingAmount != null ? Number(r.remainingAmount) : undefined),
    redeemedAt: r.redeemed_at ?? r.redeemedAt ?? undefined,
    cancelledAt: r.cancelled_at ?? r.cancelledAt ?? undefined,
    createdAt: String(r.created_at ?? r.createdAt ?? ""),
    status: r.status ?? undefined,
    paymentStatus: r.payment_status ?? r.paymentStatus ?? undefined,
  };
}

function loadLocal(): StoredBooking[] {
  try {
    const raw = localStorage.getItem("myBookings");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function MyBookings() {
  const { t } = useLang();
  const [items, setItems] = useState<StoredBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<StoredBooking | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const r: any = await account.bookings({ limit: 100 });
      const raw = r?.data?.items ?? r?.items ?? r?.data ?? [];
      const list: StoredBooking[] = Array.isArray(raw) ? raw.map(normalizeRow) : [];
      // Server is the source of truth. Drop any stale local cache from old flows.
      try { localStorage.removeItem("myBookings"); } catch {}
      setItems(list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
    } catch (e) {
      console.error("[account.bookings] fetch failed", e);
      toast.error("تعذّر تحميل الحجوزات من السيرفر");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function cancelBooking(id: string) {
    if (!confirm(t("account.bookings.confirmCancel"))) return;
    try {
      await account.cancelBooking(id);
      toast.success(t("account.bookings.toast.cancelled"));
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "تعذر إلغاء الحجز");
    }
  }

  function openEdit(b: StoredBooking) {
    setEdit(b);
    setEditDate(b.date);
    setEditTime(b.time);
  }

  async function saveEdit() {
    if (!edit) return;
    if (!editDate || !editTime) { toast.error(t("account.bookings.toast.pickDate")); return; }
    try {
      await account.updateBooking(edit.bookingRef, { date: editDate, time: editTime });
      toast.success(t("account.bookings.toast.modified"));
      setEdit(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "تعذر تعديل الحجز");
    }
  }

  return (
    <AccountLayout title={t("account.bookings.title")} subtitle={t("account.bookings.subtitle")}>
      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Ticket className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-extrabold">{t("account.bookings.empty.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("account.bookings.empty.desc")}</p>
          <Link to="/offers" className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
            {t("account.bookings.empty.cta")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((b) => {
            const offerTitle = b.offerTitle || t("account.home.serviceFallback");
            const venue = b.vendorName ? `${b.vendorName}${b.vendorCity ? ` — ${b.vendorCity}` : ""}` : "";
            const isPast = b.date && new Date(b.date) < new Date(new Date().toDateString());
            const isUnpaid = !!b.paymentStatus && b.paymentStatus !== "paid" && b.paymentStatus !== "completed" && b.paymentStatus !== "success";
            const canModify = !b.redeemedAt && !b.cancelledAt && !isPast;
            return (
              <div key={b.bookingId} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 px-5 py-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t("account.bookings.bookingNumber")}</div>
                    <div dir="ltr" className="text-base font-black tracking-wider text-foreground">{b.bookingId}</div>
                  </div>
                  {b.cancelledAt ? (
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">{t("account.bookings.status.cancelled")}</span>
                  ) : b.redeemedAt ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> {t("account.bookings.status.used")}
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isUnpaid ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">قيد الدفع</span>
                      ) : (
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">{t("account.bookings.status.confirmed")}</span>
                      )}
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isUnpaid ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {isUnpaid ? "غير مدفوع" : "مدفوع"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-[1fr,auto] sm:items-center">
                  <div className="space-y-2 text-sm">
                    <div className="font-extrabold text-foreground">{offerTitle}</div>
                    {venue && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {venue}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {b.date}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {b.time}</span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-1.5 text-amber-800">
                      <span className="text-[11px] font-bold">{t("account.bookings.confirmCode")}</span>
                      <span dir="ltr" className="font-black tracking-[0.3em]">{b.verifyCode}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isUnpaid && !b.cancelledAt && (
                      <Link
                        to="/booking/pay/$bookingId"
                        params={{ bookingId: b.bookingRef }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600"
                      >
                        <Wallet className="h-4 w-4" /> إعادة الدفع
                      </Link>
                    )}
                    <Link
                      to="/booking/$bookingId"
                      params={{ bookingId: b.bookingRef }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary bg-primary/5 px-4 py-2.5 text-xs font-bold text-primary hover:bg-primary/10"
                    >
                      <QrCode className="h-4 w-4" /> {t("account.bookings.actions.qr")}
                    </Link>
                    {canModify && (
                      <>
                        <button
                          onClick={() => openEdit(b)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" /> {t("account.bookings.actions.edit")}
                        </button>
                        <button
                          onClick={() => cancelBooking(b.bookingRef)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          <X className="h-3.5 w-3.5" /> {t("account.bookings.actions.cancel")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEdit(null)}>
          <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold">{t("account.bookings.editModal.title")}</h3>
              <button onClick={() => setEdit(null)} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold">{t("account.bookings.editModal.dateLabel")}</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold">{t("account.bookings.editModal.timeLabel")}</label>
                <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={saveEdit} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
                {t("account.bookings.editModal.save")}
              </button>
              <button onClick={() => setEdit(null)} className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold">
                {t("account.bookings.editModal.cancel")}
              </button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">{t("account.bookings.editModal.note")}</p>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}
