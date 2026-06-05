import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, MapPin, Phone, Calendar, Clock, Download, Printer, Home, Clock3, XCircle, AlertCircle, PlayCircle, Star, UserX } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useOffer } from "@/hooks/useCatalog";
import { SarIcon } from "@/components/ui/SarIcon";

export const Route = createFileRoute("/booking/$bookingId")({
  component: BookingConfirmation,
});

type Booking = {
  bookingId: string;
  verifyCode?: string;
  offerId: string;
  // Optional snapshot fields persisted at creation time
  offerTitle?: string;
  vendorName?: string;
  vendorCity?: string;
  vendorAddress?: string;
  vendorPhone?: string;
  vendorMapsUrl?: string;
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

function getStatusMeta(status?: string): StatusMeta {
  switch (status) {
    case "confirmed":
      return {
        label: "تم تأكيد حجزك بنجاح 🎉",
        subtitle: "أظهر الباركود التالي عند وصولك للمنشأة لاستخدام الخدمة.",
        badge: "مؤكد",
        Icon: Check,
        iconWrap: "bg-emerald-100 text-emerald-600 shadow-emerald-200",
        badgeClass: "bg-emerald-100 text-emerald-700",
      };
    case "in_progress":
      return {
        label: "الخدمة قيد التنفيذ",
        subtitle: "بدأ تقديم الخدمة في المنشأة.",
        badge: "قيد التنفيذ",
        Icon: PlayCircle,
        iconWrap: "bg-sky-100 text-sky-600 shadow-sky-200",
        badgeClass: "bg-sky-100 text-sky-700",
      };
    case "review":
      return {
        label: "بانتظار المراجعة",
        subtitle: "تمت الخدمة وبانتظار تقييمك.",
        badge: "مراجعة",
        Icon: Star,
        iconWrap: "bg-violet-100 text-violet-600 shadow-violet-200",
        badgeClass: "bg-violet-100 text-violet-700",
      };
    case "completed":
      return {
        label: "تم إكمال الحجز",
        subtitle: "شكراً لاستخدامك المنصة.",
        badge: "مكتمل",
        Icon: Check,
        iconWrap: "bg-emerald-100 text-emerald-600 shadow-emerald-200",
        badgeClass: "bg-emerald-100 text-emerald-700",
      };
    case "cancelled":
      return {
        label: "تم إلغاء الحجز",
        subtitle: "تم إلغاء هذا الحجز ولن يتم تقديم الخدمة.",
        badge: "ملغي",
        Icon: XCircle,
        iconWrap: "bg-rose-100 text-rose-600 shadow-rose-200",
        badgeClass: "bg-rose-100 text-rose-700",
      };
    case "no_show":
      return {
        label: "لم يتم الحضور",
        subtitle: "تم تسجيل عدم الحضور لهذا الحجز.",
        badge: "لم يحضر",
        Icon: UserX,
        iconWrap: "bg-zinc-100 text-zinc-600 shadow-zinc-200",
        badgeClass: "bg-zinc-100 text-zinc-700",
      };
    case "pending":
    default:
      return {
        label: "حجزك قيد المراجعة",
        subtitle: "سيتم تأكيد الحجز بعد إتمام الدفع أو مراجعة المنشأة.",
        badge: "بانتظار التأكيد",
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
  const { bookingId } = Route.useParams();
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`booking:${bookingId}`);
      if (raw) {
        setBooking(JSON.parse(raw));
        return;
      }
      const all = localStorage.getItem("myBookings");
      if (all) {
        const list: Booking[] = JSON.parse(all);
        const b = list.find((x) => x.bookingId === bookingId);
        if (b) setBooking(b);
      }
    } catch {}
  }, [bookingId]);

  const liveOffer = useOffer(booking?.offerId).offer;

  if (!booking) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <p className="text-muted-foreground">لم يتم العثور على بيانات الحجز.</p>
            <Link to="/" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
              <Home className="h-4 w-4" /> العودة للرئيسية
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }


  // Prefer snapshot fields baked into booking; fall back to live offer fetch.
  const offer = {
    title: booking.offerTitle ?? liveOffer?.title ?? "خدمة",
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

  // Derive effective status: trust explicit booking.status, otherwise infer
  // from payment state (paid → confirmed, otherwise pending).
  const effectiveStatus = booking.status ?? (isPaid ? "confirmed" : "pending");
  const statusMeta = getStatusMeta(effectiveStatus);
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
    <div dir="rtl" className="flex min-h-screen flex-col bg-muted/30">
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

          {/* Ticket card */}
          <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-xl">
            {/* Header strip */}
            <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider opacity-80">رقم الحجز</div>
                  <div className="mt-1 text-2xl font-black tracking-wider" dir="ltr">{booking.bookingId}</div>
                </div>
                <div className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusMeta.badgeClass}`}>
                  {statusMeta.badge}
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-[1fr,auto] sm:items-center">
              {/* Details */}
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">الخدمة</div>
                  <div className="mt-1 text-base font-extrabold text-foreground">{offer.title}</div>
                </div>

                <div className="grid gap-3 text-sm">
                  <Row icon={<Calendar className="h-4 w-4 text-primary" />} label="التاريخ">
                    {booking.date}
                  </Row>
                  <Row icon={<Clock className="h-4 w-4 text-primary" />} label="الوقت">
                    {booking.time}
                  </Row>
                  <Row icon={<MapPin className="h-4 w-4 text-primary" />} label="المنشأة">
                    <div>
                      <div className="font-bold text-foreground">{offer.vendor.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {offer.vendor.address}، {offer.vendor.city}
                      </div>
                      {(() => {
                        const mapsUrl = (offer.vendor as any).mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${offer.vendor.name} ${offer.vendor.address} ${offer.vendor.city}`)}`;
                        return (
                          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10">
                            <MapPin className="h-3 w-3" /> الذهاب للفرع عبر خرائط جوجل
                          </a>
                        );
                      })()}
                    </div>
                  </Row>
                  <Row icon={<Phone className="h-4 w-4 text-primary" />} label="هاتف المنشأة">
                    <span dir="ltr">{offer.vendor.phone}</span>
                  </Row>
                </div>

                <div className="border-t border-dashed border-border pt-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    بيانات العميل
                  </div>
                  <div className="text-sm font-bold text-foreground">{booking.customerName}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{booking.customerPhone}</div>
                </div>

                {hasDeposit ? (
                  <div className="space-y-2 border-t border-dashed border-border pt-4 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>الإجمالي</span>
                      <span dir="ltr" className="font-bold text-foreground">{fmtMoney(booking.total)} ر.س</span>
                    </div>
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 font-extrabold ${isPaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      <span>{isPaid ? "العربون المدفوع" : "العربون المطلوب"}{booking.depositPct ? ` (${booking.depositPct}%)` : ""}</span>
                      <span dir="ltr">{fmtMoney(derivedDeposit)} ر.س</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>يُدفع عند الخدمة</span>
                      <span dir="ltr">{fmtMoney(derivedRemaining)} ر.س</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between border-t border-dashed border-border pt-4">
                    <span className="text-sm font-bold text-foreground">المبلغ المدفوع</span>
                    <span className="flex items-baseline gap-1" dir="ltr">
                      <span className="text-2xl font-black text-primary">{offer.priceAfter}</span>
                      <SarIcon className="h-[0.9em] text-primary" />
                    </span>
                  </div>
                )}
              </div>

              {/* QR code */}
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/30 p-5">
                <QRCodeSVG value={qrPayload} size={180} level="H" includeMargin />
                {booking.verifyCode && (
                  <div className="w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 p-2 text-center">
                    <div className="text-[10px] font-bold text-muted-foreground">رمز التأكيد</div>
                    <div dir="ltr" className="text-xl font-black tracking-[0.35em] text-primary">{booking.verifyCode}</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-[11px] font-bold text-muted-foreground">امسح الباركود أو أعطِ الرمز</div>
                  <div className="text-[10px] text-muted-foreground">للمركز عند الوصول</div>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex flex-col gap-2 border-t border-border bg-muted/30 p-4 sm:flex-row">
              <button
                onClick={() => window.print()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-white py-3 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"
              >
                <Printer className="h-4 w-4" /> طباعة
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-white py-3 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"
              >
                <Download className="h-4 w-4" /> حفظ PDF
              </button>
              <Link
                to="/"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                <Home className="h-4 w-4" /> الرئيسية
              </Link>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            تم إرسال نسخة من بيانات الحجز إلى رقم جوالك.
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
