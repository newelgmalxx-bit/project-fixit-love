import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Lock, ChevronLeft, Loader2, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SarIcon } from "@/components/ui/SarIcon";
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
  offerId: string;
  offerTitle?: string;
  date: string;
  time: string;
  qty?: number;
  total?: number;
  depositAmount?: number;
  remainingAmount?: number;
  depositPct?: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  createdAt: string;
};

type UiMethod = { id: string; label: string; img?: string; desc: string };

const METHOD_META: Record<string, { label: string; img?: string; desc: string }> = {
  myfatoorah: { label: "ماي فاتورة (بطاقات / Apple Pay / STC Pay)", img: visaMc, desc: "ادفع بأمان عبر بوابة MyFatoorah" },
  mada: { label: "مدى", img: mada, desc: "بطاقة مدى البنكية" },
  visa: { label: "Visa / Mastercard", img: visaMc, desc: "بطاقة ائتمانية" },
  applepay: { label: "Apple Pay", img: applePay, desc: "ادفع بـ Apple Pay" },
  stcpay: { label: "STC Pay", img: stcPay, desc: "ادفع عبر محفظة STC Pay" },
  tabby: { label: "تابي", img: tabby, desc: "قسّمها على 4 دفعات بدون فوائد" },
  cod: { label: "الدفع عند الاستلام", img: cod, desc: "ادفع نقداً عند الخدمة" },
};

const FALLBACK_METHODS: UiMethod[] = [
  { id: "myfatoorah", ...METHOD_META.myfatoorah },
];

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function looksLikeBookingNumber(value: string | undefined) {
  return Boolean(value && /^BK-[A-Z0-9]+$/i.test(value));
}

function BookingPayPage() {
  const { bookingId } = Route.useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [methods, setMethods] = useState<UiMethod[]>(FALLBACK_METHODS);
  const [method, setMethod] = useState<string>("myfatoorah");
  const [processing, setProcessing] = useState(false);

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
          found.set("myfatoorah", { id: "myfatoorah", name: METHOD_META.myfatoorah.label } as PaymentMethodInfo);
        }

        const order = ["myfatoorah"];
        const mapped: UiMethod[] = order
          .filter((k) => found.has(k))
          .map((k) => {
            const m = found.get(k)!;
            const meta = METHOD_META[k];
            return {
              id: k,
              label: meta.label,
              img: meta.img || m.logo || undefined,
              desc: meta.desc,
            };
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
      const raw = localStorage.getItem("myBookings");
      const list = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((x: any) => x.bookingId === bookingId);
      if (idx >= 0) list[idx] = updated;
      else list.push(updated);
      localStorage.setItem("myBookings", JSON.stringify(list));
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
        looksLikeBookingNumber(booking.bookingId) ? booking.bookingId : undefined,
        looksLikeBookingNumber(bookingId) ? bookingId : undefined,
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
              offerTitle: booking.offerTitle ?? "حجز",
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

      alert("تم إنشاء طلب الدفع لكن الباك إند لم يرجع رابط الدفع paymentUrl");
      setProcessing(false);
    } catch (e: any) {
      console.error("Pay error", e);
      alert(e?.message || "تعذّر بدء الدفع، حاول مرة أخرى");
      setProcessing(false);
    }
  }

  if (!booking) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-16">
          <p className="text-sm text-muted-foreground">لم نعثر على بيانات الحجز…</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const offer = booking.offerTitle ? { title: booking.offerTitle } : null;
  const deposit = booking.depositAmount ?? 0;

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="mb-5 flex items-center gap-1 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-primary">الرئيسية</Link>
            <ChevronLeft className="h-3 w-3" />
            <span className="text-foreground">الدفع</span>
          </div>

          <h1 className="text-2xl font-extrabold sm:text-3xl">اختر طريقة الدفع</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ادفع العربون لتأكيد حجزك. المبلغ المتبقي يُدفع عند الخدمة.
          </p>

          {/* Summary strip */}
          <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">رقم الحجز</div>
                <div className="font-extrabold tracking-wider">{booking.bookingId}</div>
                {offer && <div className="mt-1 truncate text-sm font-bold">{offer.title}</div>}
                <div className="mt-1 text-xs text-muted-foreground">
                  {booking.date} • {booking.time}
                </div>
              </div>
              <div className="text-end">
                <div className="text-xs text-muted-foreground">المطلوب الآن (عربون)</div>
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
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> دفع آمن ومشفّر</span>
            <span className="inline-flex items-center gap-1.5"><Lock className="h-4 w-4" /> بياناتك محمية</span>
          </div>

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={processing}
            className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-primary to-primary/90 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 transition hover:shadow-xl disabled:opacity-70"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> جاري معالجة الدفع…
              </>
            ) : (
              <>ادفع الآن — {deposit} ر.س</>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            بالضغط على "ادفع الآن" فإنك توافق على شروط الحجز وسياسة الإلغاء.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
