import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, PanelCard, Pill, PrimaryButton, GhostButton } from "@/components/admin/AdminLayout";
import {
  CalendarCheck, Loader2, Search, Eye, RefreshCw,
  ChevronLeft, ChevronRight, X, CheckCircle2, Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { adminBookingsApi, type AdminBooking } from "@/lib/api/adminBookings";
import { adminCategoriesApi, type AdminCategory } from "@/lib/api/adminContent";
import { adminPartnersApi } from "@/lib/api/adminPartners";
import { PartnerSelect } from "@/components/admin/PartnerSelect";

export const Route = createFileRoute("/admin/bookings")({
  head: () => ({ meta: [{ title: "الحجوزات | الإدارة" }] }),
  component: BookingsPage,
});

// Backend status values are used raw; these are display hints only.
function statusTone(s: string): "amber" | "primary" | "emerald" | "rose" | "violet" | "muted" {
  const v = s.toLowerCase();
  if (v === "pending") return "amber";
  if (v === "confirmed") return "primary";
  if (v === "completed") return "violet";
  if (v === "redeemed" || v === "paid") return "emerald";
  if (v === "cancelled" || v === "refunded" || v === "no_show") return "rose";
  return "muted";
}
const STATUS_OPTIONS = ["pending", "confirmed", "completed", "redeemed", "cancelled", "no_show", "refunded"];

const STATUS_LABELS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  completed: "مكتمل",
  redeemed: "تم الاستخدام",
  paid: "مدفوع",
  cancelled: "ملغي",
  no_show: "لم يحضر",
  refunded: "مسترجع",
  unpaid: "غير مدفوع",
};
const STATUS_LABELS_EN: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  redeemed: "Redeemed",
  paid: "Paid",
  cancelled: "Cancelled",
  no_show: "No-show",
  refunded: "Refunded",
  unpaid: "Unpaid",
};
function statusLabel(s: string, lang: string) {
  const map = lang === "en" ? STATUS_LABELS_EN : STATUS_LABELS_AR;
  return map[s?.toLowerCase()] || s;
}
function num(v: any): number | undefined {
  return v == null || v === "" ? undefined : Number(v);
}
function pickDeposit(b: any): number | undefined {
  return num(b?.deposit_amount ?? b?.depositAmount ?? b?.deposit ?? b?.amountPaid ?? b?.amount_paid ?? b?.paidAmount ?? b?.paid_amount);
}
function pickDepositPct(b: any): number | undefined {
  return num(b?.depositPct ?? b?.deposit_pct);
}
function pickCommissionPct(b: any): number | undefined {
  return num(b?.commissionPct ?? b?.commission_pct);
}
function pickCommissionAmount(b: any): number | undefined {
  return num(b?.commissionAmount ?? b?.commission_amount);
}
function pickPartnerAmount(b: any): number | undefined {
  return num(b?.partnerAmount ?? b?.partner_amount);
}
function pickServicesCount(b: any): number | undefined {
  const direct = b?.servicesCount ?? b?.services_count ?? b?.itemsCount ?? b?.items_count ?? b?.qty ?? b?.quantity;
  if (direct != null && direct !== "") return Number(direct);
  if (Array.isArray(b?.items)) {
    return b.items.reduce((s: number, it: any) => s + Number(it?.qty ?? it?.quantity ?? 1), 0);
  }
  return undefined;
}
function pickServicesValue(b: any): number | undefined {
  const v = b?.total_amount ?? b?.totalAmount ?? b?.total ?? b?.servicesValue ?? b?.services_value ?? b?.offerPrice ?? b?.offer_price ?? b?.subtotal;
  if (v != null && v !== "") return Number(v);
  if (Array.isArray(b?.items)) {
    return b.items.reduce((s: number, it: any) => s + Number(it?.price ?? 0) * Number(it?.qty ?? it?.quantity ?? 1), 0);
  }
  return undefined;
}
function pickPartnerName(b: any): string | undefined {
  return b?.partnerName || b?.partner_name || b?.partner?.name || b?.partner?.nameAr || b?.centerName || b?.center_name || b?.center?.name;
}
function pickCity(b: any): string | undefined {
  return b?.city || b?.partnerCity || b?.partner_city || b?.partner?.city || b?.center?.city || b?.cityName || b?.city_name;
}
function pickMapsUrl(b: any): string | undefined {
  return b?.mapsUrl || b?.maps_url || b?.partner?.mapsUrl || b?.partner?.maps_url || b?.center?.mapsUrl || b?.center?.maps_url;
}
function pickOfferTitle(b: any): string | undefined {
  return b?.offerTitle || b?.offer_title || b?.offer?.title || b?.offer?.titleAr || b?.offerName || b?.offer_name;
}

function pickRef(b: any): string | undefined {
  return b?.qrCode || b?.qr_code || b?.reference || b?.referenceCode || b?.reference_code || b?.confirmationCode || b?.confirmation_code || b?.code;
}

const PAGE_SIZE = 20;

function BookingsPage() {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);

  // Filters — names match backend params exactly
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<AdminBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<AdminCategory[]>([]);

  const [viewing, setViewing] = useState<AdminBooking | null>(null);
  const [refundFor, setRefundFor] = useState<AdminBooking | null>(null);

  // Confirm-by-code form
  const [confirmCode, setConfirmCode] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function handleConfirmByCode(e: React.FormEvent) {
    e.preventDefault();
    const code = confirmCode.trim();
    if (!code) { toast.error(L("أدخل رقم التأكيد", "Enter confirmation #")); return; }
    setConfirming(true);
    try {
      const data = await adminBookingsApi.list({ q: code, limit: 10 });
      const match = (data.items || []).find((b: any) => {
        const ref = pickRef(b) || "";
        const id = String(b.id || "");
        const tail = id.slice(-6).toUpperCase();
        const c = code.toUpperCase();
        return ref.toUpperCase() === c || id.toUpperCase() === c || tail === c || id.toUpperCase().endsWith(c);
      }) || (data.items || [])[0];
      if (!match) { toast.error(L("لا يوجد حجز بهذا الرقم", "No booking found with this code")); return; }
      const st = String(match.status || "").toLowerCase();
      if (st === "cancelled" || st === "refunded") { toast.error(L("هذا الحجز ملغي/مسترجع", "Booking is cancelled/refunded")); return; }
      if (st === "confirmed" || st === "completed" || st === "redeemed") {
        toast.message(L("الحجز مؤكد بالفعل", "Booking already confirmed"));
      } else {
        await adminBookingsApi.setStatus(match.id, "confirmed");
        toast.success(L(`تم تأكيد حجز: ${match.customerName || match.id}`, `Confirmed: ${match.customerName || match.id}`));
      }
      setConfirmCode("");
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل التأكيد", "Confirm failed"));
    } finally {
      setConfirming(false);
    }
  }

  async function load(p = page) {
    setLoading(true);
    try {
      const data = await adminBookingsApi.list({
        status: status || undefined,
        city: city || undefined,
        category: category || undefined,
        partnerId: partnerId || undefined,
        from: from || undefined,
        to: to || undefined,
        q: q.trim() || undefined,
        page: p,
        limit: PAGE_SIZE,
      });
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || p);
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر تحميل الحجوزات", "Failed to load bookings"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    adminCategoriesApi.list().then((d) => setCategories(d.items || [])).catch(() => {});
  }, []);

  // Refetch on filter change
  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, city, category, partnerId, from, to]);

  function applySearch(e?: React.FormEvent) {
    e?.preventDefault();
    load(1);
  }

  function resetFilters() {
    setStatus(""); setCity(""); setCategory(""); setPartnerId("");
    setFrom(""); setTo(""); setQ("");
  }

  async function changeStatus(b: AdminBooking, s: string) {
    try {
      await adminBookingsApi.setStatus(b.id, s);
      toast.success(L("تم تحديث الحالة", "Status updated"));
      // Refetch list + currently viewed booking
      load();
      if (viewing && viewing.id === b.id) {
        try {
          const fresh = await adminBookingsApi.get(b.id);
          setViewing(fresh);
        } catch { /* ignore */ }
      }
    } catch (e: any) {
      toast.error(e?.message || L("فشل التحديث", "Update failed"));
    }
  }

  async function openDetails(b: AdminBooking) {
    setViewing(b);
    try {
      const fresh = await adminBookingsApi.get(b.id);
      let merged: any = fresh;
      // Backfill city + mapsUrl from partner if missing on booking
      if ((!pickCity(fresh) || !pickMapsUrl(fresh)) && (fresh as any).partnerId) {
        try {
          const p: any = await adminPartnersApi.get((fresh as any).partnerId);
          merged = {
            ...fresh,
            city: pickCity(fresh) || p?.city || p?.address || "",
            mapsUrl: pickMapsUrl(fresh) || p?.mapsUrl || p?.maps_url || "",
          };
        } catch { /* ignore */ }
      }
      setViewing(merged);
    } catch { /* keep list snapshot */ }
  }

  return (
    <AdminLayout
      title={L("الحجوزات", "Bookings")}
      subtitle={L("متابعة وإدارة كل حجوزات المراكز", "Track and manage all center bookings")}
      action={<GhostButton onClick={() => load()}><RefreshCw className="h-4 w-4" /> {L("تحديث", "Refresh")}</GhostButton>}
    >
      {/* Confirm by code */}
      <form onSubmit={handleConfirmByCode} className="mb-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-extrabold">{L("تأكيد حجز برقم التأكيد", "Confirm booking by code")}</div>
            <div className="text-[11px] text-muted-foreground">{L("ادخل رقم التأكيد الخاص بالحجز لتأكيده مباشرة", "Enter the booking confirmation number to confirm it instantly")}</div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value)}
            placeholder={L("رقم التأكيد / رقم الحجز", "Confirmation # / Booking #")}
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-bold tracking-wider"
            dir="ltr"
            maxLength={64}
          />
          <button type="submit" disabled={confirming}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60">
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {L("تأكيد الحجز", "Confirm booking")}
          </button>
        </div>
      </form>

      <PanelCard>
        {/* Filters */}
        <form onSubmit={applySearch} className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${dir === "rtl" ? "right-3" : "left-3"}`} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={L("ابحث برقم الحجز / العميل / الهاتف...", "Search booking #, customer, phone...")}
              className={`w-full rounded-xl border border-border bg-background py-2.5 text-sm ${dir === "rtl" ? "pr-10 pl-3" : "pl-10 pr-3"}`}
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="">{L("كل الحالات", "All statuses")}</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="">{L("كل التصنيفات", "All categories")}</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.nameAr}</option>)}
          </select>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={L("المدينة", "City")}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="lg:col-span-2">
            <PartnerSelect value={partnerId} onChange={(id) => setPartnerId(id)} />
          </div>
          <div className="flex gap-2">
            <PrimaryButton type="submit">{L("بحث", "Search")}</PrimaryButton>
            <GhostButton onClick={resetFilters}>{L("مسح", "Reset")}</GhostButton>
          </div>
        </form>

        {/* Table */}
        <div className="overflow-x-auto -mx-2">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className={`${dir === "rtl" ? "text-right" : "text-left"} text-xs text-muted-foreground border-b border-border whitespace-nowrap`}>
                <th className="px-3 py-3 font-medium">{L("رقم التأكيد", "Confirmation #")}</th>
                <th className="px-3 py-3 font-medium">{L("المركز", "Center")}</th>
                <th className="px-3 py-3 font-medium">{L("العميل", "Customer")}</th>
                <th className="px-3 py-3 font-medium">{L("بيانات التواصل", "Contact")}</th>
                <th className="px-3 py-3 font-medium">{L("العرض", "Offer")}</th>
                
                <th className="px-3 py-3 font-medium">{L("قيمة الخدمات", "Value")}</th>
                <th className="px-3 py-3 font-medium">{L("الموعد", "Schedule")}</th>
                <th className="px-3 py-3 font-medium">{L("العربون", "Deposit")}</th>
                <th className="px-3 py-3 font-medium">{L("الحالة", "Status")}</th>
                <th className="px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-xs text-muted-foreground">
                  <CalendarCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {L("لا توجد حجوزات", "No bookings")}
                </td></tr>
              ) : items.map((b) => {
                const shortId = String(b.id).slice(-6).toUpperCase();
                const ref = pickRef(b);
                const isPending = String(b.status || "").toLowerCase() === "pending";
                return (
                <tr key={b.id} className="border-b border-border hover:bg-muted/40">
                  <td className="px-3 py-3 font-mono text-xs" title={String(b.id)}>
                    <div className="font-bold text-primary">{ref || `#${shortId}`}</div>
                    {ref && <div className="text-[10px] text-muted-foreground">#{shortId}</div>}
                  </td>
                  <td className="px-3 py-3 text-xs font-bold">{pickPartnerName(b) || "—"}</td>
                  <td className="px-3 py-3 text-xs font-bold">{b.customerName || "—"}</td>
                  <td className="px-3 py-3 text-[11px]">
                    {b.customerPhone && <div dir="ltr">{b.customerPhone}</div>}
                    {b.customerEmail && <div className="text-muted-foreground" dir="ltr">{b.customerEmail}</div>}
                    {!b.customerPhone && !b.customerEmail && "—"}
                  </td>
                  <td className="px-3 py-3 text-xs">{pickOfferTitle(b) || "—"}</td>
                  
                  <td className="px-3 py-3 text-xs font-bold" dir="ltr">{pickServicesValue(b) ?? "—"}</td>
                  <td className="px-3 py-3 text-xs" dir="ltr">{b.scheduledAt ? new Date(b.scheduledAt).toLocaleString() : "—"}</td>
                  <td className="px-3 py-3 text-xs font-bold" dir="ltr">
                    {pickDeposit(b) ?? "—"}
                    {pickDepositPct(b) != null && <span className="ms-1 text-[10px] font-normal text-muted-foreground">({pickDepositPct(b)}%)</span>}
                  </td>
                  <td className="px-3 py-3"><Pill tone={statusTone(b.status)}>{statusLabel(b.status, lang)}</Pill></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      {isPending && (
                        <button onClick={() => changeStatus(b, "confirmed")}
                          title={L("تأكيد الحجز", "Confirm booking")}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-500 px-2 text-[11px] font-bold text-white hover:bg-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {L("تأكيد", "Confirm")}
                        </button>
                      )}
                      <button onClick={() => openDetails(b)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted text-primary">
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          <div className="text-xs text-muted-foreground" data-ltr-number>
            {L(`${total} إجمالي · صفحة ${page}/${totalPages}`, `${total} total · page ${page}/${totalPages}`)}
          </div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1 || loading} onClick={() => load(page - 1)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-bold disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5 rtl:hidden" />
              <ChevronLeft className="h-3.5 w-3.5 ltr:hidden" />
              {L("السابق", "Prev")}
            </button>
            <button disabled={page >= totalPages || loading} onClick={() => load(page + 1)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-bold disabled:opacity-40">
              {L("التالي", "Next")}
              <ChevronLeft className="h-3.5 w-3.5 rtl:hidden" />
              <ChevronRight className="h-3.5 w-3.5 ltr:hidden" />
            </button>
          </div>
        </div>
      </PanelCard>

      {/* Details drawer */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent dir={dir} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {L("تفاصيل الحجز", "Booking details")} <span className="font-mono text-xs text-muted-foreground">#{viewing?.id}</span>
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label={L("رقم التأكيد", "Confirmation #")}>
                  <span className="font-mono font-bold text-primary" dir="ltr">{pickRef(viewing) || `#${String(viewing.id).slice(-6).toUpperCase()}`}</span>
                </Info>
                <Info label={L("الحالة", "Status")}>
                  <Pill tone={statusTone(viewing.status)}>{statusLabel(viewing.status, lang)}</Pill>
                </Info>
                <Info label={L("العربون", "Deposit")}>
                  <span dir="ltr">{pickDeposit(viewing) ?? "—"}</span>
                  {pickDepositPct(viewing) != null && <span className="ms-1 text-[10px] text-muted-foreground">({pickDepositPct(viewing)}%)</span>}
                </Info>
                <Info label={L("العمولة", "Commission")}>
                  <span dir="ltr">{pickCommissionAmount(viewing) ?? "—"}</span>
                  {pickCommissionPct(viewing) != null && <span className="ms-1 text-[10px] text-muted-foreground">({pickCommissionPct(viewing)}%)</span>}
                </Info>
                <Info label={L("مستحق المركز", "Partner amount")}><span dir="ltr">{pickPartnerAmount(viewing) ?? "—"}</span></Info>
                <Info label={L("قيمة العرض", "Services value")}><span dir="ltr">{pickServicesValue(viewing) ?? "—"}</span></Info>
                <Info label={L("العميل", "Customer")}>{viewing.customerName || "—"}</Info>
                <Info label={L("الهاتف", "Phone")}><span dir="ltr">{viewing.customerPhone || "—"}</span></Info>
                <Info label={L("البريد", "Email")}><span dir="ltr">{viewing.customerEmail || "—"}</span></Info>
                <Info label={L("المدينة", "City")}>
                  {pickMapsUrl(viewing) ? (
                    <a href={pickMapsUrl(viewing)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline">
                      {pickCity(viewing) || L("فتح الموقع", "Open location")}
                    </a>
                  ) : (
                    pickCity(viewing) || "—"
                  )}
                </Info>
                <Info label={L("المركز", "Center")}>{pickPartnerName(viewing) || "—"}</Info>
                <Info label={L("العرض", "Offer")}>{pickOfferTitle(viewing) || "—"}</Info>
                <Info label={L("الموعد", "Schedule")}>
                  <span dir="ltr">{viewing.scheduledAt ? new Date(viewing.scheduledAt).toLocaleString() : "—"}</span>
                </Info>
                <Info label={L("أنشئ في", "Created")}>
                  <span dir="ltr">{viewing.createdAt ? new Date(viewing.createdAt).toLocaleString() : "—"}</span>
                </Info>
              </div>

              <div>
                <label className="text-xs font-bold">{L("تغيير الحالة", "Change status")}</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s} onClick={() => changeStatus(viewing, s)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${viewing.status === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"}`}>
                      {statusLabel(s, lang)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <GhostButton onClick={() => setViewing(null)}>{L("إغلاق", "Close")}</GhostButton>
            {viewing && (
              <>
                {String(viewing.status || "").toLowerCase() === "pending" && (
                  <button
                    onClick={() => changeStatus(viewing, "confirmed")}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-white shadow-sm hover:bg-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> {L("تأكيد الحجز", "Confirm booking")}
                  </button>
                )}
                <PrimaryButton onClick={() => setRefundFor(viewing)}>
                  {L("استرجاع المبلغ", "Refund")}
                </PrimaryButton>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RefundModal
        booking={refundFor}
        onClose={() => setRefundFor(null)}
        onDone={() => { setRefundFor(null); load(); }}
      />
    </AdminLayout>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function RefundModal({ booking, onClose, onDone }: { booking: AdminBooking | null; onClose: () => void; onDone: () => void }) {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (booking) { setAmount(booking.total != null ? String(booking.total) : ""); setReason(""); }
  }, [booking]);

  if (!booking) return null;

  async function submit() {
    if (!booking) return;
    setBusy(true);
    try {
      await adminBookingsApi.refund(booking.id, {
        amount: amount ? Number(amount) : undefined,
        reason: reason.trim() || undefined,
      });
      toast.success(L("تم تنفيذ الاسترجاع", "Refund submitted"));
      onDone();
    } catch (e: any) {
      toast.error(e?.message || L("فشل الاسترجاع", "Refund failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir={dir} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{L("استرجاع مبلغ الحجز", "Refund booking")} #{booking.id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="block">
            <div className="text-xs font-bold">{L("المبلغ", "Amount")}</div>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <div className="text-xs font-bold">{L("السبب (اختياري)", "Reason (optional)")}</div>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </label>
        </div>
        <DialogFooter className="gap-2">
          <GhostButton onClick={onClose}>{L("إلغاء", "Cancel")}</GhostButton>
          <PrimaryButton onClick={submit}>
            {busy ? L("جارٍ...", "Working...") : L("تأكيد الاسترجاع", "Confirm refund")}
          </PrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
