import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, MapPin, Phone, Calendar, Clock, Download, Printer, Home, Clock3, XCircle, AlertCircle, PlayCircle, Star, UserX, CreditCard } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useOffer } from "@/hooks/useCatalog";
import { SarIcon } from "@/components/ui/SarIcon";
import { account } from "@/lib/api/account";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/booking/$bookingId")({
  component: BookingConfirmation,
});

type Booking = {
  bookingId: string;
  verifyCode?: string;
  offerId: string;
  offerTitle?: string;
  vendorName?: string;
  vendorCity?: string;
  vendorAddress?: string;
  vendorPhone?: string;
  vendorMapsUrl?: string;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  branchPhone?: string;
  branchMapsUrl?: string;
  priceAfter?: number;
  date: string;
  time: string;
  qty?: number;
  total?: number;
  depositAmount?: number;
  remainingAmount?: number;
  depositPct?: number;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  paid?: boolean;
  paymentStatus?: string;
  paymentMethod?: string;
  status?: string;
};

type StatusMeta = {
  label: string;
  subtitle: string;
  badge: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconWrap: string;
  badgeClass: string;
};

function getStatusMeta(status: string | undefined, lang: "ar" | "en"): StatusMeta {
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  switch (status) {
    case "confirmed":
      return {
        label: L("تم تأكيد حجزك بنجاح 🎉", "Your booking is confirmed 🎉"),
        subtitle: L("أظهر الباركود التالي عند وصولك للمنشأة لاستخدام الخدمة.", "Show the QR below at the venue to use the service."),
        badge: L("مؤكد", "Confirmed"),
        Icon: Check,
        iconWrap: "bg-emerald-100 text-emerald-600 shadow-emerald-200",
        badgeClass: "bg-emerald-100 text-emerald-700",
      };
    case "in_progress":
      return {
        label: L("الخدمة قيد التنفيذ", "Service in progress"),
        subtitle: L("بدأ تقديم الخدمة في المنشأة.", "Service has started at the venue."),
        badge: L("قيد التنفيذ", "In progress"),
        Icon: PlayCircle,
        iconWrap: "bg-sky-100 text-sky-600 shadow-sky-200",
        badgeClass: "bg-sky-100 text-sky-700",
      };
    case "review":
      return {
        label: L("بانتظار المراجعة", "Awaiting review"),
        subtitle: L("تمت الخدمة وبانتظار تقييمك.", "Service completed — waiting for your rating."),
        badge: L("مراجعة", "Review"),
        Icon: Star,
        iconWrap: "bg-violet-100 text-violet-600 shadow-violet-200",
        badgeClass: "bg-violet-100 text-violet-700",
      };
    case "completed":
      return {
        label: L("تم إكمال الحجز", "Booking completed"),
        subtitle: L("شكراً لاستخدامك المنصة.", "Thanks for using the platform."),
        badge: L("مكتمل", "Completed"),
        Icon: Check,
        iconWrap: "bg-emerald-100 text-emerald-600 shadow-emerald-200",
        badgeClass: "bg-emerald-100 text-emerald-700",
      };
    case "cancelled":
      return {
        label: L("تم إلغاء الحجز", "Booking cancelled"),
        subtitle: L("تم إلغاء هذا الحجز ولن يتم تقديم الخدمة.", "This booking is cancelled and the service will not be provided."),
        badge: L("ملغي", "Cancelled"),
        Icon: XCircle,
        iconWrap: "bg-rose-100 text-rose-600 shadow-rose-200",
        badgeClass: "bg-rose-100 text-rose-700",
      };
    case "no_show":
      return {
        label: L("لم يتم الحضور", "No show"),
        subtitle: L("تم تسجيل عدم الحضور لهذا الحجز.", "A no-show has been recorded for this booking."),
        badge: L("لم يحضر", "No show"),
        Icon: UserX,
        iconWrap: "bg-zinc-100 text-zinc-600 shadow-zinc-200",
        badgeClass: "bg-zinc-100 text-zinc-700",
      };
    case "pending":
    default:
      return {
        label: L("حجزك قيد المراجعة", "Your booking is under review"),
        subtitle: L("سيتم تأكيد الحجز بعد إتمام الدفع أو مراجعة المنشأة.", "It will be confirmed after payment or venue review."),
        badge: L("بانتظار التأكيد", "Awaiting confirmation"),
        Icon: Clock3,
        iconWrap: "bg-amber-100 text-amber-600 shadow-amber-200",
        badgeClass: "bg-amber-100 text-amber-700",
      };
  }
}

// Format money keeping up to 2 decimals, no forced trailing zeros (e.g. 14.9 not 15).
function fmtMoney(n?: number) {
  if (n == null || isNaN(Number(n))) return "0";
  const v = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(v) ? String(v) : String(v).replace(/\.?0+$/, "");
}

function BookingConfirmation() {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const sar = L("ر.س", "SAR");
  const { bookingId } = Route.useParams();
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = sessionStorage.getItem(`booking:${bookingId}`);
      if (raw) {
        setBooking(JSON.parse(raw));
      } else {
        const all = localStorage.getItem("myBookings");
        if (all) {
          const list: Booking[] = JSON.parse(all);
          const b = list.find((x) => x.bookingId === bookingId);
          if (b) setBooking(b);
        }
      }
    } catch {}
    // Always try to refresh from server (overrides stale local data)
    (async () => {
      try {
        const r: any = await account.bookingDetail(bookingId);
        const row = r?.data?.booking ?? r?.booking ?? r?.data ?? null;
        if (!row || cancelled) return;
        const mapped: Booking = {
          bookingId: String(row.qr_code ?? row.qrCode ?? row.booking_number ?? row.bookingNumber ?? row.id ?? bookingId),
          verifyCode: row.verify_code ?? row.verifyCode ?? undefined,
          offerId: String(row.offer_id ?? row.offerId ?? ""),
          offerTitle: row.offer_title ?? row.offerTitle,
          vendorName: row.partner_name ?? row.vendorName,
          vendorCity: row.partner_city ?? row.vendorCity,
          vendorAddress: row.partner_address ?? row.vendorAddress,
          vendorPhone: row.partner_phone ?? row.vendorPhone,
          vendorMapsUrl: row.partner_maps_url ?? row.vendorMapsUrl,
          branchId: row.branch_id ?? row.branchId ?? row.branch?.id,
          branchName: row.branch_name ?? row.branchName ?? row.branch?.name_ar ?? row.branch?.nameAr,
          branchAddress: row.branch_address ?? row.branchAddress ?? row.branch?.address,
          branchPhone: row.branch_phone ?? row.branchPhone ?? row.branch?.phone,
          branchMapsUrl: row.branch_maps_url ?? row.branchMapsUrl ?? row.branch?.maps_url ?? row.branch?.mapsUrl,
          priceAfter: row.price_after != null ? Number(row.price_after) : undefined,
          date: String(row.booking_date ?? row.bookingDate ?? row.date ?? ""),
          time: String(row.booking_time ?? row.bookingTime ?? row.time ?? ""),
          qty: row.qty != null ? Number(row.qty) : 1,
          total: row.total_amount != null ? Number(row.total_amount) : undefined,
          depositAmount: row.deposit_amount != null ? Number(row.deposit_amount) : undefined,
          remainingAmount: row.remaining_amount != null ? Number(row.remaining_amount) : undefined,
          depositPct: row.deposit_pct != null ? Number(row.deposit_pct) : undefined,
          customerName: String(row.customer_name ?? row.customerName ?? ""),
          customerPhone: String(row.customer_phone ?? row.customerPhone ?? ""),
          createdAt: String(row.created_at ?? row.createdAt ?? ""),
          paid: row.payment_status === "paid" || row.payment_status === "deposit_paid",
          paymentStatus: row.payment_status ?? row.paymentStatus,
          paymentMethod: row.payment_method ?? row.paymentMethod,
          status: row.status,
        };
        setBooking(mapped);
        try { sessionStorage.setItem(`booking:${bookingId}`, JSON.stringify(mapped)); } catch {}
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  const liveOffer = useOffer(booking?.offerId).offer;

  if (!booking) {
    return (
      <div dir={dir} className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <p className="text-muted-foreground">{L("لم يتم العثور على بيانات الحجز.", "Booking data not found.")}</p>
            <Link to="/" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
              <Home className="h-4 w-4" /> {L("العودة للرئيسية", "Back to home")}
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }


  // Prefer snapshot fields baked into booking; fall back to live offer fetch.
  const offer = {
    title: booking.offerTitle ?? liveOffer?.title ?? L("خدمة", "Service"),
    priceAfter: booking.priceAfter ?? liveOffer?.priceAfter ?? 0,
    vendor: {
      name: booking.vendorName ?? liveOffer?.vendor?.name ?? "—",
      city: booking.vendorCity ?? liveOffer?.vendor?.city ?? "",
      address: booking.vendorAddress ?? liveOffer?.vendor?.address ?? "",
      phone: booking.vendorPhone ?? liveOffer?.vendor?.phone ?? "",
      mapsUrl: booking.vendorMapsUrl ?? (liveOffer?.vendor as any)?.mapsUrl,
    },
  };

  // Re-derive deposit/remaining client-side with 2-decimal precision so we
  // never round 14.9 → 15 just because the backend stored an integer.
  const totalNum = Number(booking.total ?? 0);
  const pctNum = Number(booking.depositPct ?? 0);
  const derivedDeposit = totalNum && pctNum
    ? Math.round((totalNum * pctNum) / 100 * 100) / 100
    : Number(booking.depositAmount ?? 0);
  const derivedRemaining = totalNum
    ? Math.round((totalNum - derivedDeposit) * 100) / 100
    : Number(booking.remainingAmount ?? 0);

  // Treat the booking as paid only when we have explicit evidence. COD or a
  // newly-created booking awaiting gateway redirect is NOT paid.
  const isPaid =
    booking.paid === true ||
    booking.paymentStatus === "paid" ||
    booking.paymentStatus === "deposit_paid";
  const hasDeposit = derivedDeposit > 0;

  // Unpaid bookings stay on this page so the user can see the status &
  // details, but we show a clear banner asking them to complete payment.
  const showPayBanner = hasDeposit && !isPaid;

  // Derive effective status: trust explicit booking.status, otherwise infer
  // from payment state (paid → confirmed, otherwise pending).
  const effectiveStatus = booking.status ?? (isPaid ? "confirmed" : "pending");
  const statusMeta = getStatusMeta(effectiveStatus, lang);
  const StatusIcon = statusMeta.Icon;

  const demoPayload = {
    b: booking.bookingId,
    c: booking.verifyCode ?? "",
    o: booking.offerId,
    n: booking.customerName,
    p: booking.customerPhone,
    d: booking.date,
    t: booking.time,
    r: booking.remainingAmount ?? 0,
  };
  const demoParam = typeof window !== "undefined"
    ? btoa(unescape(encodeURIComponent(JSON.stringify(demoPayload))))
    : "";
  const qrPayload = `${typeof window !== "undefined" ? window.location.origin : ""}/verify?b=${encodeURIComponent(booking.bookingId)}&c=${encodeURIComponent(booking.verifyCode ?? "")}&demo=${encodeURIComponent(demoParam)}`;

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-muted/30">
      <SiteHeader />
      <main className="flex-1 py-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {/* Status badge */}
          <div className="mb-6 text-center">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-lg ${statusMeta.iconWrap}`}>
              <StatusIcon className="h-8 w-8" strokeWidth={3} />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-foreground sm:text-3xl">
              {statusMeta.label}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {statusMeta.subtitle}
            </p>
          </div>

          {showPayBanner && (
            <div className="mb-6 flex flex-col items-stretch gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="text-sm">
                  <div className="font-extrabold">{L("لم يتم دفع العربون بعد", "Deposit not paid yet")}</div>
                  <div className="text-xs text-amber-800/80">
                    {L('حجزك غير مؤكد حتى تتم عملية الدفع. اضغط على "ادفع الآن" لإتمام الحجز.', 'Your booking is not confirmed until payment is completed. Click "Pay now" to finalize the booking.')}
                  </div>
                </div>
              </div>
              <Link
                to="/booking/pay/$bookingId"
                params={{ bookingId }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-amber-700"
              >
                <CreditCard className="h-4 w-4" /> {L("ادفع الآن", "Pay now")}
              </Link>
            </div>
          )}

          <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-xl">
            <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider opacity-80">{L("رقم الحجز", "Booking #")}</div>
                  <div className="mt-1 text-2xl font-black tracking-wider" dir="ltr">{booking.bookingId}</div>
                </div>
                <div className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusMeta.badgeClass}`}>
                  {statusMeta.badge}
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-[1fr,auto] sm:items-center">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{L("الخدمة", "Service")}</div>
                  <div className="mt-1 text-base font-extrabold text-foreground">{offer.title}</div>
                </div>

                <div className="grid gap-3 text-sm">
                  <Row icon={<Calendar className="h-4 w-4 text-primary" />} label={L("التاريخ", "Date")}>
                    {booking.date}
                  </Row>
                  <Row icon={<Clock className="h-4 w-4 text-primary" />} label={L("الوقت", "Time")}>
                    {booking.time}
                  </Row>
                  <Row icon={<MapPin className="h-4 w-4 text-primary" />} label={L("المنشأة", "Venue")}>
                    <div>
                      <div className="font-bold text-foreground">
                        {offer.vendor.name}
                        {booking.branchName && (
                          <span className="ms-2 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                            {L("فرع:", "Branch:")} {booking.branchName}
                          </span>
                        )}
                      </div>
                      {isPaid ? (
                        <>
                          <div className="text-xs text-muted-foreground">
                            {(booking.branchAddress || offer.vendor.address)}
                            {(booking.branchAddress || offer.vendor.address) && offer.vendor.city ? L("، ", ", ") : ""}
                            {offer.vendor.city}
                          </div>
                          {(() => {
                            const addr = booking.branchAddress || offer.vendor.address;
                            const mapsUrl = booking.branchMapsUrl || (offer.vendor as any).mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${offer.vendor.name} ${addr} ${offer.vendor.city}`)}`;
                            return (
                              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10">
                                <MapPin className="h-3 w-3" /> {L("الذهاب للفرع عبر خرائط جوجل", "Open in Google Maps")}
                              </a>
                            );
                          })()}
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {offer.vendor.city ? `${offer.vendor.city} — ` : ""}{L("سيظهر العنوان التفصيلي بعد إتمام الدفع", "The detailed address will appear after payment is completed")}
                        </div>
                      )}
                    </div>
                  </Row>
                  <Row icon={<Phone className="h-4 w-4 text-primary" />} label={L("هاتف المنشأة", "Venue phone")}>
                    <span dir="ltr">{booking.branchPhone || offer.vendor.phone}</span>
                  </Row>
                </div>

                <div className="border-t border-dashed border-border pt-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    {L("بيانات العميل", "Customer details")}
                  </div>
                  <div className="text-sm font-bold text-foreground">{booking.customerName}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{booking.customerPhone}</div>
                </div>

                {hasDeposit ? (
                  <div className="space-y-2 border-t border-dashed border-border pt-4 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{L("الإجمالي", "Total")}</span>
                      <span dir="ltr" className="font-bold text-foreground">{fmtMoney(booking.total)} {sar}</span>
                    </div>
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 font-extrabold ${isPaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      <span>{isPaid ? L("العربون المدفوع", "Deposit paid") : L("العربون المطلوب", "Deposit required")}{booking.depositPct ? ` (${booking.depositPct}%)` : ""}</span>
                      <span dir="ltr">{fmtMoney(derivedDeposit)} {sar}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{L("يُدفع عند الخدمة", "Paid at service")}</span>
                      <span dir="ltr">{fmtMoney(derivedRemaining)} {sar}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between border-t border-dashed border-border pt-4">
                    <span className="text-sm font-bold text-foreground">{L("المبلغ المدفوع", "Amount paid")}</span>
                    <span className="flex items-baseline gap-1" dir="ltr">
                      <span className="text-2xl font-black text-primary">{offer.priceAfter}</span>
                      <SarIcon className="h-[0.9em] text-primary" />
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/30 p-5">
                <QRCodeSVG value={qrPayload} size={180} level="H" includeMargin />
                {booking.verifyCode && (
                  <div className="w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 p-2 text-center">
                    <div className="text-[10px] font-bold text-muted-foreground">{L("رمز التأكيد", "Confirmation code")}</div>
                    <div dir="ltr" className="text-xl font-black tracking-[0.35em] text-primary">{booking.verifyCode}</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-[11px] font-bold text-muted-foreground">{L("امسح الباركود أو أعطِ الرمز", "Scan QR or share code")}</div>
                  <div className="text-[10px] text-muted-foreground">{L("للمركز عند الوصول", "with the center on arrival")}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border bg-muted/30 p-4 sm:flex-row">
              <button
                onClick={() => window.print()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-white py-3 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"
              >
                <Printer className="h-4 w-4" /> {L("طباعة", "Print")}
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-white py-3 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"
              >
                <Download className="h-4 w-4" /> {L("حفظ PDF", "Save PDF")}
              </button>
              <Link
                to="/"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                <Home className="h-4 w-4" /> {L("الرئيسية", "Home")}
              </Link>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {L("تم إرسال نسخة من بيانات الحجز إلى رقم جوالك.", "A copy of the booking details was sent to your phone.")}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}
