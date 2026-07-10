import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Lock, ChevronLeft, Loader2, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SarIcon } from "@/components/ui/SarIcon";
import { account } from "@/lib/api/account";
import { useLang } from "@/i18n/LanguageProvider";
import mada from "@/assets/payments/mada.png";
import visaMc from "@/assets/payments/visa-mastercard.png";
import applePay from "@/assets/payments/apple-pay.jpg";
import cod from "@/assets/payments/cod.png";
import tabby from "@/assets/payments/tabby.webp";

import stcPay from "@/assets/payments/stc-pay.png";
import { checkout, type PaymentMethodInfo } from "@/lib/api/checkout";

export const Route = createFileRoute("/booking/pay/$bookingId")({
  head: () => ({ meta: [{ title: "اختر طريقة الدفع | بوكينج" }] }),
  component: BookingPayPage,
});

type Booking = {
  bookingId: string;
  bookingNumber?: string;
  serverBookingId?: string;
  offerId: string;
  offerTitle?: string;
  date: string;
  time: string;
  qty?: number;
  total?: number;
  depositAmount?: number;
  remainingAmount?: number;
  depositPct?: number;
  priceAfter?: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  branchId?: string | null;
  branchName?: string | null;
  createdAt: string;
};

type UiMethod = { id: string; label: string; img?: string; desc: string };

type MethodMeta = { labelAr: string; labelEn: string; img?: string; descAr: string; descEn: string };

const METHOD_META: Record<string, MethodMeta> = {
  myfatoorah: { labelAr: "ماي فاتورة (بطاقات / Apple Pay / STC Pay)", labelEn: "MyFatoorah (Cards / Apple Pay / STC Pay)", img: visaMc, descAr: "ادفع بأمان عبر بوابة MyFatoorah", descEn: "Pay securely via the MyFatoorah gateway" },
  mada: { labelAr: "مدى", labelEn: "Mada", img: mada, descAr: "بطاقة مدى البنكية", descEn: "Mada bank card" },
  visa: { labelAr: "Visa / Mastercard", labelEn: "Visa / Mastercard", img: visaMc, descAr: "بطاقة ائتمانية", descEn: "Credit card" },
  applepay: { labelAr: "Apple Pay", labelEn: "Apple Pay", img: applePay, descAr: "ادفع بـ Apple Pay", descEn: "Pay with Apple Pay" },
  stcpay: { labelAr: "STC Pay", labelEn: "STC Pay", img: stcPay, descAr: "ادفع عبر محفظة STC Pay", descEn: "Pay via STC Pay wallet" },
  tabby: { labelAr: "تابي", labelEn: "Tabby", img: tabby, descAr: "قسّمها على 4 دفعات بدون فوائد", descEn: "Split it into 4 interest-free payments" },
  cod: { labelAr: "الدفع عند الاستلام", labelEn: "Cash on delivery", img: cod, descAr: "ادفع نقداً عند الخدمة", descEn: "Pay cash at service" },
};

function metaToUi(key: string, lang: "ar" | "en", overrideImg?: string): UiMethod {
  const m = METHOD_META[key];
  return {
    id: key,
    label: lang === "en" ? m.labelEn : m.labelAr,
    img: overrideImg || m.img,
    desc: lang === "en" ? m.descEn : m.descAr,
  };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function toMoney(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function BookingPayPage() {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { bookingId } = Route.useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const fallback = useMemo<UiMethod[]>(() => [metaToUi("myfatoorah", lang)], [lang]);
  const [methods, setMethods] = useState<UiMethod[]>(fallback);
  const [method, setMethod] = useState<string>("myfatoorah");
  const [processing, setProcessing] = useState(false);

  // Keep fallback labels localized when language toggles
  useEffect(() => { setMethods((prev) => prev.length === 1 && prev[0].id === "myfatoorah" ? fallback : prev); }, [fallback]);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = sessionStorage.getItem(`booking:${bookingId}`);
      if (raw) {
        setBooking(JSON.parse(raw));
      } else {
        const all = localStorage.getItem("myBookings");
        if (!all) return;
        const list: Booking[] = JSON.parse(all);
        const b = list.find((x) => x.bookingId === bookingId);
        if (b) setBooking(b);
      }
    } catch {}

    (async () => {
      try {
        const r: any = await account.bookingDetail(bookingId);
        const row = r?.data?.booking ?? r?.booking ?? r?.data ?? null;
        if (!row || cancelled) return;
        const mapped: Booking = {
          bookingId: String(row.qr_code ?? row.qrCode ?? row.booking_number ?? row.bookingNumber ?? row.id ?? bookingId),
          bookingNumber: String(row.qr_code ?? row.qrCode ?? row.booking_number ?? row.bookingNumber ?? "") || undefined,
          serverBookingId: String(row.id ?? row.booking_id ?? row.bookingId ?? bookingId),
          offerId: String(row.offer_id ?? row.offerId ?? ""),
          offerTitle: row.offer_title ?? row.offerTitle ?? undefined,
          priceAfter: row.price_after != null ? Number(row.price_after) : undefined,
          date: String(row.booking_date ?? row.bookingDate ?? row.date ?? ""),
          time: String(row.booking_time ?? row.bookingTime ?? row.time ?? ""),
          qty: row.qty != null ? Number(row.qty) : 1,
          total: row.total_amount != null ? Number(row.total_amount) : (row.totalAmount != null ? Number(row.totalAmount) : undefined),
          depositAmount: row.deposit_amount != null ? Number(row.deposit_amount) : (row.depositAmount != null ? Number(row.depositAmount) : undefined),
          remainingAmount: row.remaining_amount != null ? Number(row.remaining_amount) : (row.remainingAmount != null ? Number(row.remainingAmount) : undefined),
          depositPct: row.deposit_pct != null ? Number(row.deposit_pct) : (row.depositPct != null ? Number(row.depositPct) : undefined),
          customerName: String(row.customer_name ?? row.customerName ?? ""),
          customerPhone: String(row.customer_phone ?? row.customerPhone ?? ""),
          customerEmail: row.customer_email ?? row.customerEmail ?? undefined,
          branchId: row.branch_id ?? row.branchId ?? row.branch?.id ?? null,
          branchName: row.branch_name ?? row.branchName ?? row.branch?.nameAr ?? row.branch?.name_ar ?? row.branch?.nameEn ?? null,
          createdAt: String(row.created_at ?? row.createdAt ?? ""),
        };
        setBooking(mapped);
        try { sessionStorage.setItem(`booking:${bookingId}`, JSON.stringify(mapped)); } catch {}
      } catch {
        // First-time locally-created bookings do not exist on the server yet.
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  // Show only: MyFatoorah, Tabby, Tamara, STC Pay, Mada (in that order).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await checkout.paymentMethods();
        const items: PaymentMethodInfo[] = r.data?.items || [];

        const classify = (m: PaymentMethodInfo): string | null => {
          const hay = `${m.id} ${m.name || ""} ${m.type || ""}`.toLowerCase();
          if (/myfatoorah|mayfatoorah|فاتور/.test(hay)) return "myfatoorah";
          if (/tabby|تابي/.test(hay)) return "tabby";
          
          if (/stc/.test(hay) || String(m.id) === "12") return "stcpay";
          if (/mada|مدى/.test(hay) || String(m.id) === "6") return "mada";
          return null;
        };

        const found = new Map<string, PaymentMethodInfo>();
        for (const m of items) {
          const key = classify(m);
          if (key && !found.has(key)) found.set(key, m);
        }
        // If backend exposes any MyFatoorah child (visa/mada/applepay/stcpay), expose a top-level MyFatoorah option too.
        if (!found.has("myfatoorah") && items.some((m) => ["2", "6", "11", "12", "13"].includes(String(m.id)))) {
          found.set("myfatoorah", { id: "myfatoorah", name: METHOD_META.myfatoorah.labelAr } as PaymentMethodInfo);
        }

        const order = ["myfatoorah"];
        const mapped: UiMethod[] = order
          .filter((k) => found.has(k))
          .map((k) => {
            const m = found.get(k)!;
            return metaToUi(k, lang, m.logo || undefined);
          });

        if (!cancelled && mapped.length) {
          setMethods(mapped);
          setMethod(mapped[0].id);
        }
      } catch {
        /* keep fallback */
      }
    })();
    return () => { cancelled = true; };
  }, []);


  async function handlePay() {
    if (!booking) return;
    setProcessing(true);

    // Persist chosen method locally
    try {
      const updated = { ...booking, paymentMethod: method };
      sessionStorage.setItem(`booking:${bookingId}`, JSON.stringify(updated));
    } catch {}

    // Map UI method → backend value. Backend (checkout.php) accepts:
    // "tamara" | "tabby" | "cod" | numeric MyFatoorah PaymentMethodId | "myfatoorah"
    const mfIdMap: Record<string, number> = { mada: 6, visa: 2, applepay: 11, stcpay: 12 };
    const paymentMethodId: number | undefined = mfIdMap[method];

    try {
      // Two flows:
      // 1) Booking already exists on server (re-pay) → POST /bookings/{id}/pay
      // 2) First-time pay (booking only exists locally) → POST /checkout to create + pay
      const serverBookingRef = firstString(
        (booking as any).bookingNumber,
        (booking as any).serverBookingId,
      );

      let res: any;
      if (serverBookingRef) {
        res = await checkout.payExistingBooking(serverBookingRef, paymentMethodId);
      } else {
        const backendMethod: string =
          method === "cod" ? "cod"
          : paymentMethodId != null ? String(paymentMethodId)
          : "myfatoorah";
        let sessionId: string | undefined;
        try { sessionId = localStorage.getItem("guestSessionId") || undefined; } catch {}
        res = await checkout.create({
          paymentMethod: backendMethod as any,
          contactName: booking.customerName,
          contactEmail: booking.customerEmail ?? "",
          contactPhone: booking.customerPhone,
          date: booking.date,
          time: booking.time,
          sessionId,
          notes: `Booking ${booking.bookingId} — ${booking.date} ${booking.time}`,
          items: [
            {
              offerId: booking.offerId,
              offerTitle: booking.offerTitle ?? L("حجز", "Booking"),
              price: (booking as any).priceAfter ?? booking.total ?? 0,
              qty: booking.qty ?? 1,
            },
          ],
        });
      }

      const data = res?.data ?? res ?? {};
      const nestedData = data?.data ?? {};
      const firstBooking = Array.isArray(data?.bookings) ? data.bookings[0] : undefined;
      const url = firstString(
        data.paymentUrl,
        data.payment_url,
        data.invoiceUrl,
        data.invoice_url,
        data.PaymentURL,
        data.InvoiceURL,
        nestedData.paymentUrl,
        nestedData.payment_url,
        nestedData.invoiceUrl,
        nestedData.invoice_url,
        nestedData.PaymentURL,
        nestedData.InvoiceURL,
      );
      const bookingNumber = firstString(data.bookingNumber, data.bookingNo, data.orderNumber, firstBooking?.bookingNo);
      const serverBookingId = firstString(data.bookingId, data.orderId, firstBooking?.bookingId);

      try {
        const merged = {
          ...booking,
          paymentMethod: method,
          bookingNumber: bookingNumber ?? (booking as any).bookingNumber,
          serverBookingId: serverBookingId ?? (booking as any).serverBookingId,
        };
        sessionStorage.setItem(`booking:${bookingId}`, JSON.stringify(merged));
      } catch {}

      if (url) {
        window.location.href = url;
        return;
      }

      alert(L("تم إنشاء طلب الدفع لكن الباك إند لم يرجع رابط الدفع paymentUrl", "Payment request created but the backend did not return a paymentUrl"));
      setProcessing(false);
    } catch (e: any) {
      console.error("Pay error", e);
      alert(e?.message || L("تعذّر بدء الدفع، حاول مرة أخرى", "Could not start payment, please try again"));
      setProcessing(false);
    }
  }

  if (!booking) {
    return (
      <div dir={dir} className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-16">
          <p className="text-sm text-muted-foreground">{L("لم نعثر على بيانات الحجز…", "Booking not found…")}</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const offer = booking.offerTitle ? { title: booking.offerTitle } : null;
  const savedDeposit = toMoney(booking.depositAmount);
  const totalForDeposit = toMoney(booking.total ?? booking.priceAfter);
  const pctForDeposit = toMoney(booking.depositPct);
  const deposit = savedDeposit > 0
    ? savedDeposit
    : totalForDeposit > 0 && pctForDeposit > 0
      ? toMoney((totalForDeposit * pctForDeposit) / 100)
      : 0;

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="mb-5 flex items-center gap-1 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-primary">{L("الرئيسية", "Home")}</Link>
            <ChevronLeft className={`h-3 w-3 ${dir === "ltr" ? "rotate-180" : ""}`} />
            <span className="text-foreground">{L("الدفع", "Payment")}</span>
          </div>

          <h1 className="text-2xl font-extrabold sm:text-3xl">{L("اختر طريقة الدفع", "Choose payment method")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {L("ادفع العربون لتأكيد حجزك. المبلغ المتبقي يُدفع عند الخدمة.", "Pay the deposit to confirm your booking. The remaining amount is paid at the service.")}
          </p>

          {/* Summary strip */}
          <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{L("رقم الحجز", "Booking #")}</div>
                <div className="font-extrabold tracking-wider">{booking.bookingId}</div>
                {offer && <div className="mt-1 truncate text-sm font-bold">{offer.title}</div>}
                <div className="mt-1 text-xs text-muted-foreground">
                  {booking.date} • {booking.time}
                </div>
              </div>
              <div className="text-end">
                <div className="text-xs text-muted-foreground">{L("المطلوب الآن (عربون)", "Due now (deposit)")}</div>
                <div className="inline-flex items-center gap-1 text-2xl font-black text-primary">
                  <span dir="ltr">{deposit}</span>
                  <SarIcon className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Methods */}
          <div className="mt-5 space-y-2.5">
            {methods.map((m: UiMethod) => {
              const active = method === m.id;
              return (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-card p-3 transition sm:p-4 ${
                    active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="pay"
                    className="h-4 w-4 accent-primary"
                    checked={active}
                    onChange={() => setMethod(m.id)}
                  />
                  <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/5">
                    <img src={m.img} alt={m.label} className="max-h-7 max-w-full object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-foreground">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Trust badges */}
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> {L("دفع آمن ومشفّر", "Secure encrypted payment")}</span>
            <span className="inline-flex items-center gap-1.5"><Lock className="h-4 w-4" /> {L("بياناتك محمية", "Your data is protected")}</span>
          </div>

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={processing}
            className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-primary to-primary/90 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 transition hover:shadow-xl disabled:opacity-70"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> {L("جاري معالجة الدفع…", "Processing payment…")}
              </>
            ) : (
              <>{L("ادفع الآن", "Pay now")} — {deposit} {L("ر.س", "SAR")}</>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            {L('بالضغط على "ادفع الآن" فإنك توافق على شروط الحجز وسياسة الإلغاء.', 'By clicking "Pay now" you agree to the booking terms and cancellation policy.')}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
