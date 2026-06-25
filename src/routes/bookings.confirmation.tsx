import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, MapPin, Phone, Calendar, Clock, Printer, Home, Download } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useLang } from "@/i18n/LanguageProvider";

type ConfirmedBooking = {
  bookingId: string;
  verifyCode: string;
  offerId?: string | null;
  offerTitle: string;
  vendorName: string;
  vendorAddress?: string;
  vendorCity?: string;
  vendorPhone?: string;
  bookingDate: string;
  bookingTime: string;
  qty: number;
  amount: number;
  depositAmount: number;
  remainingAmount: number;
  depositPct?: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
};

type GroupData = {
  orderGroupId: string;
  bookings: ConfirmedBooking[];
  depositTotal: number;
  remainingTotal: number;
  grandTotal: number;
};

export const Route = createFileRoute("/bookings/confirmation")({
  validateSearch: (s: Record<string, unknown>) => ({
    group: (s.group as string) || "",
  }),
  component: BookingsConfirmation,
});

function BookingsConfirmation() {
  const { group } = useSearch({ from: "/bookings/confirmation" });
  const [data, setData] = useState<GroupData | null>(null);
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const sar = L("ر.س", "SAR");

  useEffect(() => {
    if (!group) return;
    try {
      const raw = sessionStorage.getItem(`bookingGroup:${group}`);
      if (raw) setData(JSON.parse(raw));
    } catch {}
  }, [group]);

  if (!data) {
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

  const headerTitle = data.bookings.length > 1
    ? L(`تم تأكيد ${data.bookings.length} حجوزات بنجاح 🎉`, `${data.bookings.length} bookings confirmed successfully 🎉`)
    : L("تم تأكيد حجزك بنجاح 🎉", "Your booking is confirmed 🎉");

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-muted/30">
      <SiteHeader />
      <main className="flex-1 py-10 print:py-2">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-lg shadow-emerald-200">
              <Check className="h-8 w-8" strokeWidth={3} />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-foreground sm:text-3xl">
              {headerTitle}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {L("أظهر الباركود الخاص بكل حجز عند وصولك للمركز.", "Show the QR code for each booking when you arrive at the center.")}
            </p>
          </div>

          {/* Totals strip */}
          <div className="mb-6 grid grid-cols-3 gap-3 rounded-2xl border border-border bg-card p-4 text-center text-sm">
            <div>
              <div className="text-[11px] font-bold text-muted-foreground">{L("الإجمالي", "Total")}</div>
              <div className="mt-1 font-extrabold text-foreground" dir="ltr">{data.grandTotal} {sar}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 py-1 text-emerald-700">
              <div className="text-[11px] font-bold">{L("العربون المدفوع", "Deposit paid")}</div>
              <div className="mt-1 font-extrabold" dir="ltr">{data.depositTotal} {sar}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-muted-foreground">{L("يُدفع في المركز", "Paid at center")}</div>
              <div className="mt-1 font-extrabold text-foreground" dir="ltr">{data.remainingTotal} {sar}</div>
            </div>
          </div>

          {/* Booking tickets */}
          <div className="space-y-6">
            {data.bookings.map((b, idx) => (
              <BookingTicket key={b.bookingId} b={b} index={idx + 1} count={data.bookings.length} L={L} sar={sar} />
            ))}
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-2 sm:flex-row print:hidden">
            <button
              onClick={() => window.print()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"
            >
              <Printer className="h-4 w-4" /> {L("طباعة الكل", "Print all")}
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"
            >
              <Download className="h-4 w-4" /> {L("حفظ PDF", "Save PDF")}
            </button>
            <Link
              to={"/account/bookings" as any}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              {L("حجوزاتي", "My bookings")}
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {L("تم إرسال نسخة من بيانات الحجوزات إلى رقم جوالك وبريدك الإلكتروني.", "A copy of the booking details was sent to your phone and email.")}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function BookingTicket({ b, index, count, L, sar }: { b: ConfirmedBooking; index: number; count: number; L: (a: string, e: string) => string; sar: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrPayload = `${origin}/verify?b=${encodeURIComponent(b.bookingId)}&c=${encodeURIComponent(b.verifyCode)}`;
  const mapsUrl = b.vendorAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.vendorName} ${b.vendorAddress} ${b.vendorCity ?? ""}`)}`
    : null;

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl print:break-inside-avoid">
      <div className="bg-gradient-to-r from-primary to-primary/80 p-5 text-primary-foreground">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
              {L(`حجز ${index} من ${count} — رقم الحجز`, `Booking ${index} of ${count} — Booking #`)}
            </div>
            <div className="mt-1 text-xl font-black tracking-wider" dir="ltr">
              {b.bookingId.slice(0, 8).toUpperCase()}
            </div>
          </div>
          <div className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold">
            {L("عربون مدفوع", "Deposit paid")}
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 sm:grid-cols-[1fr,auto] sm:items-center">
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{L("الخدمة", "Service")}</div>
            <div className="mt-1 text-base font-extrabold text-foreground">{b.offerTitle}</div>
            {b.qty > 1 && (
              <div className="mt-0.5 text-xs text-muted-foreground">{L("العدد", "Quantity")}: <span dir="ltr">{b.qty}</span></div>
            )}
          </div>

          <div className="grid gap-3 text-sm">
            <Row icon={<Calendar className="h-4 w-4 text-primary" />} label={L("التاريخ", "Date")}>
              <span dir="ltr">{b.bookingDate}</span>
            </Row>
            <Row icon={<Clock className="h-4 w-4 text-primary" />} label={L("الوقت", "Time")}>
              <span dir="ltr">{b.bookingTime}</span>
            </Row>
            <Row icon={<MapPin className="h-4 w-4 text-primary" />} label={L("المركز", "Center")}>
              <div>
                <div className="font-bold text-foreground">{b.vendorName}</div>
                {(b.vendorAddress || b.vendorCity) && (
                  <div className="text-xs text-muted-foreground">
                    {[b.vendorAddress, b.vendorCity].filter(Boolean).join(L("، ", ", "))}
                  </div>
                )}
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10 print:hidden"
                  >
                    <MapPin className="h-3 w-3" /> {L("الذهاب عبر خرائط جوجل", "Open in Google Maps")}
                  </a>
                )}
              </div>
            </Row>
            {b.vendorPhone && (
              <Row icon={<Phone className="h-4 w-4 text-primary" />} label={L("هاتف المركز", "Center phone")}>
                <span dir="ltr">{b.vendorPhone}</span>
              </Row>
            )}
          </div>

          <div className="border-t border-dashed border-border pt-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              {L("بيانات العميل", "Customer details")}
            </div>
            <div className="text-sm font-bold text-foreground">{b.customerName}</div>
            <div className="text-xs text-muted-foreground" dir="ltr">{b.customerPhone}</div>
          </div>

          <div className="space-y-1.5 border-t border-dashed border-border pt-3 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{L("الإجمالي", "Total")}</span>
              <span dir="ltr" className="font-bold text-foreground">{b.amount} {sar}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 font-extrabold text-emerald-700">
              <span>{L("العربون المدفوع", "Deposit paid")}{b.depositPct ? ` (${b.depositPct}%)` : ""}</span>
              <span dir="ltr">{b.depositAmount} {sar}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{L("يُدفع عند الخدمة", "Paid at service")}</span>
              <span dir="ltr">{b.remainingAmount} {sar}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4">
          <QRCodeSVG value={qrPayload} size={160} level="H" includeMargin />
          <div className="w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 p-2 text-center">
            <div className="text-[10px] font-bold text-muted-foreground">{L("رمز التأكيد", "Confirmation code")}</div>
            <div dir="ltr" className="text-lg font-black tracking-[0.3em] text-primary">{b.verifyCode}</div>
          </div>
          <div className="text-center">
            <div className="text-[11px] font-bold text-muted-foreground">{L("امسح الباركود أو أعطِ الرمز", "Scan QR or share code")}</div>
            <div className="text-[10px] text-muted-foreground">{L("للمركز عند الوصول", "with the center on arrival")}</div>
          </div>
        </div>
      </div>
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
