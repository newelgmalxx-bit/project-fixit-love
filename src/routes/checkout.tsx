import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronLeft, Lock, ShieldCheck, FileText, Loader2, AlertCircle } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useCart, isOfferBooking } from "@/hooks/useCart";
import { paymentMethods, type PaymentMethod, formatCurrency } from "@/data/account";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import api, { ApiError } from "@/lib/api";
import { toast } from "sonner";
import { useCheckoutStore } from "@/store/checkoutStore";


// Client-side stand-in for the previous server function. The site is a pure
// SPA now, so booking creation is simulated locally and the real persistence
// happens against the external API on the user's host.
async function submitBookingsLocal(payload: {
  data: {
    customer: { name: string; email: string; phone: string; notes: string | null };
    paymentMethod: string;
    items: Array<{
      offerId: string;
      offerTitle: string;
      partnerId: string | null;
      vendorName: string;
      bookingDate: string;
      bookingTime: string;
      qty: number;
      unitPrice: number;
      commissionPct: number;
    }>;
  };
}) {
  const orderGroupId =
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `og_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const bookings = payload.data.items.map((it) => {
    const amount = +(it.unitPrice * it.qty).toFixed(2);
    const deposit_amount = +((amount * it.commissionPct) / 100).toFixed(2);
    const remaining_amount = +(amount - deposit_amount).toFixed(2);
    return {
      id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      partner_id: it.partnerId,
      vendor_name: it.vendorName,
      offer_title: it.offerTitle,
      booking_date: it.bookingDate,
      booking_time: it.bookingTime,
      qty: it.qty,
      amount,
      deposit_amount,
      remaining_amount,
      status: "confirmed" as const,
    };
  });
  const depositTotal = +bookings.reduce((s, b) => s + b.deposit_amount, 0).toFixed(2);
  const remainingTotal = +bookings.reduce((s, b) => s + b.remaining_amount, 0).toFixed(2);
  const grandTotal = +bookings.reduce((s, b) => s + b.amount, 0).toFixed(2);
  return { orderGroupId, bookings, depositTotal, remainingTotal, grandTotal };
}

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Checkout | koswmat" }],
  }),
  component: CheckoutShell,
});

function CheckoutShell() {
  const location = useLocation();

  if (location.pathname !== "/checkout") {
    return <Outlet />;
  }

  return <CheckoutPage />;
}

function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, vat, total, clear } = useCart();
  const submitBookings = submitBookingsLocal;
  const bookingItems = items.filter(isOfferBooking);
  const hasBookings = bookingItems.length > 0;
  const hasInvalidBookingPct = bookingItems.some((it) => it.commissionPct == null || it.commissionPct <= 0);
  const depositTotal = bookingItems.reduce(
    (s, it) => s + (it.price * it.qty * (it.commissionPct ?? 0)) / 100,
    0,
  );
  const remainingTotal = bookingItems.reduce(
    (s, it) => s + it.price * it.qty * (1 - (it.commissionPct ?? 0) / 100),
    0,
  );
  const [step, setStep] = useState(0);
  const { t, lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { user } = useAuth();
  const steps = [t("checkout.steps.info"), t("checkout.steps.payment"), t("checkout.steps.review")];

  const [info, setInfo] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    company: "",
    notes: "",
    agree: true,
  });
  const [payment, setPayment] = useState<PaymentMethod>("mayfatoorah");
  const [submitting, setSubmitting] = useState(false);
  const [useSaved, setUseSaved] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // When the logged-in user toggles between saved data and new data, refill the form.
  const applyMode = (saved: boolean) => {
    setUseSaved(saved);
    if (saved) {
      setInfo((prev) => ({
        ...prev,
        name: user?.name || "",
        email: user?.email || "",
        phone: (user as any)?.phone || "",
      }));
    } else {
      setInfo((prev) => ({ ...prev, name: "", email: "", phone: "" }));
    }
  };

  if (submitting) {
    const isCod = payment === "cod";
    return (
      <div className="flex min-h-screen flex-col bg-muted/30">
        <SiteHeader />
        <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <h1 className="mt-6 text-xl font-bold">
            {isCod
              ? (lang === "ar" ? "جارٍ تأكيد طلبك..." : "Confirming your order...")
              : (lang === "ar" ? "جارٍ تحويلك لبوابة الدفع..." : "Redirecting to payment gateway...")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {lang === "ar" ? "من فضلك لا تغلق هذه الصفحة." : "Please do not close this page."}
          </p>
        </main>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/30">
        <SiteHeader />
        <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <h1 className="text-2xl font-bold">{t("checkout.empty.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("checkout.empty.desc")}</p>
          <Link to="/offers" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">
            {t("checkout.empty.cta")}
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const validateContact = (): boolean => {
    const errs: Record<string, string[]> = {};
    if (!info.name.trim()) errs.name = [lang === "ar" ? "الاسم مطلوب" : "Name is required"];
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim());
    if (!info.email.trim()) errs.email = [lang === "ar" ? "البريد الإلكتروني مطلوب" : "Email is required"];
    else if (!emailOk) errs.email = [lang === "ar" ? "صيغة البريد غير صحيحة" : "Invalid email format"];
    const phone = info.phone.replace(/[\s-]/g, "");
    if (!info.phone.trim()) errs.phone = [lang === "ar" ? "رقم الجوال مطلوب" : "Phone is required"];
    else if (!/^(05\d{8}|\+9665\d{8}|009665\d{8})$/.test(phone)) {
      errs.phone = [lang === "ar" ? "رقم الجوال يجب أن يبدأ بـ 05 أو +9665" : "Phone must start with 05 or +9665"];
    }
    if (!info.agree) errs.agree = [lang === "ar" ? "يجب الموافقة على الشروط" : "You must agree to the terms"];
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError(lang === "ar" ? "يرجى تصحيح الحقول المظلّلة" : "Please correct the highlighted fields");
      return false;
    }
    setError(null);
    return true;
  };

  const next = () => {
    if (step === 0 && !validateContact()) return;
    setStep((s) => Math.min(steps.length - 1, s + 1));
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const placeOrder = async () => {
    setError(null);
    setFieldErrors({});
    if (!info.name || !info.email || !info.phone) {
      setError(lang === "ar" ? "يرجى تعبئة بيانات التواصل" : "Please fill contact info");
      setStep(0);
      return;
    }
    const phone = info.phone.replace(/[\s-]/g, "");
    const saudiOk = /^(05\d{8}|\+9665\d{8}|009665\d{8})$/.test(phone);
    if (!saudiOk) {
      setError(
        lang === "ar"
          ? "رقم الجوال يجب أن يبدأ بـ 05 (مثال: 0512345678) أو +9665."
          : "Phone must start with 05 (e.g. 0512345678) or +9665.",
      );
      setStep(0);
      return;
    }
    if (hasInvalidBookingPct) {
      setError(lang === "ar" ? "يوجد حجز بنسبة عربون غير محددة. احذفه وأعد إضافته بعد ضبط نسبة المركز." : "A booking is missing its deposit percentage.");
      setStep(2);
      return;
    }
    setSubmitting(true);
    let keepRedirectScreen = false;
    try {
      // ===== Group booking flow (offers from cart) =====
      if (hasBookings) {
        // If user picked an online gateway (MyFatoorah / Tamara / Tabby / mada / etc.),
        // create the order on the backend and redirect to the payment URL.
        // Only "cod" stays on the local simulated confirmation flow.
        if (payment !== "cod") {
          try {
            const firstBk = bookingItems[0];
            const res: any = await api.checkout.create({
              paymentMethod: payment as any,
              contactName: info.name,
              contactEmail: info.email,
              contactPhone: info.phone,
              notes: info.notes || undefined,
              date: firstBk?.bookingDate,
              time: firstBk?.bookingTime || "00:00",
              items: bookingItems.map((it) => ({
                offerId: it.offerId,
                offerTitle: it.serviceTitle,
                offerSlug: it.serviceSlug,
                // Online amount = deposit (commission). Remainder is paid in person.
                price: +(it.price * (it.commissionPct ?? 0) / 100).toFixed(2),
                qty: it.qty,
                branchId: it.branchId ?? undefined,
              })),
            });
            const d = res?.data ?? res ?? {};
            let url: string | undefined = d.paymentUrl ?? d.payment_url ?? d.invoiceURL ?? d.url;
            const orderId: string | undefined = d.orderId ?? d.bookingId;
            if (!url && orderId) {
              try {
                const init: any = await api.checkout.initiateMyfatoorah(orderId);
                const dd = init?.data ?? init ?? {};
                url = dd.paymentUrl ?? dd.payment_url ?? dd.invoiceURL ?? dd.url;
              } catch { /* ignore */ }
            }
            if (url) {
              await clear();
              keepRedirectScreen = true;
              toast.success(lang === "ar" ? "جارٍ تحويلك لبوابة الدفع" : "Redirecting to payment");
              window.location.replace(url);
              return;
            }
            // No URL → surface a clear error instead of silently confirming.
            throw new Error(lang === "ar" ? "تعذّر بدء جلسة الدفع" : "Failed to start payment session");
          } catch (err: any) {
            const msg = err?.message || (lang === "ar" ? "فشل إنشاء جلسة الدفع" : "Failed to create payment session");
            setError(msg);
            toast.error(msg);
            setSubmitting(false);
            return;
          }
        }
        // COD: keep simulated local confirmation (deposit waived).
        try {
          const res = await submitBookings({
            data: {
              customer: {
                name: info.name,
                email: info.email,
                phone: info.phone,
                notes: info.notes || null,
              },
              paymentMethod: payment as any,
              items: bookingItems.map((it) => ({
                offerId: it.offerId!,
                offerTitle: it.serviceTitle,
                partnerId: it.partnerId ?? null,
                vendorName: it.vendorName || "—",
                bookingDate: it.bookingDate!,
                bookingTime: it.bookingTime || "00:00",
                qty: it.qty,
                unitPrice: it.price,
                commissionPct: it.commissionPct ?? 0,
              })),
            },
          });
          // Build confirmation group payload (simulated payment) and persist in sessionStorage.
          const confirmedBookings = (res.bookings ?? []).map((row: any, idx: number) => {
            const src = bookingItems[idx];
            const verifyCode = String(Math.floor(100000 + Math.random() * 900000));
            return {
              bookingId: row.id,
              verifyCode,
              offerId: src?.offerId ?? null,
              offerTitle: row.offer_title ?? src?.serviceTitle ?? "",
              vendorName: row.vendor_name ?? src?.vendorName ?? "—",
              vendorAddress: undefined,
              vendorCity: undefined,
              vendorPhone: undefined,
              bookingDate: row.booking_date ?? src?.bookingDate ?? "",
              bookingTime: row.booking_time ?? src?.bookingTime ?? "",
              qty: row.qty ?? src?.qty ?? 1,
              amount: Number(row.amount ?? 0),
              depositAmount: Number(row.deposit_amount ?? 0),
              remainingAmount: Number(row.remaining_amount ?? 0),
              depositPct: src?.commissionPct,
              customerName: info.name,
              customerPhone: info.phone,
              customerEmail: info.email,
            };
          });
          try {
            sessionStorage.setItem(
              `bookingGroup:${res.orderGroupId}`,
              JSON.stringify({
                orderGroupId: res.orderGroupId,
                bookings: confirmedBookings,
                depositTotal: res.depositTotal,
                remainingTotal: res.remainingTotal,
                grandTotal: res.grandTotal,
              }),
            );
          } catch {}
          await clear();
          toast.success(
            lang === "ar"
              ? `تم تأكيد ${res.bookings.length} حجز`
              : `Confirmed — ${res.bookings.length} booking(s)`,
          );
          navigate({
            to: "/bookings/confirmation" as any,
            search: { group: res.orderGroupId } as any,
          });
          return;
        } catch (err: any) {
          const msg = err?.message || (lang === "ar" ? "فشل تأكيد الحجز" : "Failed to confirm bookings");
          setError(msg);
          toast.error(msg);
          setSubmitting(false);
          return;
        }
      }

      if (user) {
        try {
          const updates: Record<string, string> = {};
          if (!useSaved) {
            if (info.name && info.name !== user.name) updates.name = info.name;
            if (info.phone && info.phone !== (user as any).phone) updates.phone = info.phone;
            if (info.email && info.email !== user.email) updates.email = info.email;
          } else if (info.phone && !(user as any).phone) {
            updates.phone = info.phone;
          }
          if (Object.keys(updates).length > 0) {
            await api.account.updateProfile(updates);
          }
        } catch { /* non-blocking */ }
      }
      const res = await api.checkout.submit({
        contact: {
          name: info.name,
          email: info.email,
          phone: info.phone,
          city: undefined,
          address: undefined,
        },
        paymentMethod: payment as any,
        notes: info.notes || undefined,
        items: items.map((it) => {
          const offerId = it.offerId
            ?? (it.serviceSlug.startsWith("offer:") ? it.serviceSlug.slice(6) : undefined);
          return {
            offerId,
            offerTitle: it.serviceTitle,
            offerSlug: it.serviceSlug,
            price: it.price,
            qty: it.qty,
            branchId: it.branchId ?? undefined,
          };
        }),
      });
      try {
        useCheckoutStore.getState().setLastOrder({
          orderId: res.orderId,
          orderNumber: res.orderNumber,
          total,
          payment,
          items: items.map((it) => ({
            serviceSlug: it.serviceSlug,
            serviceTitle: it.serviceTitle,
            planId: it.planId,
            planName: it.planName,
            price: it.price,
            qty: it.qty,
          })),
          info: {
            name: info.name,
            email: info.email,
            phone: info.phone,
            notes: info.notes || undefined,
          },
        });
      } catch {}
      await clear();
      const isCod = payment === "cod";
      const isTamara = payment === "tamara";
      // Online gateway (MyFatoorah / Tamara): redirect to the payment URL.
      if (!isCod) {
        let url = res.paymentUrl as string | null | undefined;
        if (!url && res.orderId && !isTamara) {
          try {
            const init: any = await api.checkout.initiateMyfatoorah(res.orderId);
            const d = init?.data ?? init ?? {};
            url = d.paymentUrl ?? d.payment_url ?? d.invoiceURL ?? d.url ?? null;
          } catch { /* ignore — fall through to success page */ }
        }
        if (url) {
          keepRedirectScreen = true;
          toast.success(lang === "ar" ? "جارٍ تحويلك لبوابة الدفع" : "Redirecting to payment");
          // Per Tamara contract: do NOT modify the payment URL.
          window.location.replace(url);
          return;
        }
        // No payment URL available — send user to success page (will offer Pay now).
        toast.message(lang === "ar" ? "تم إنشاء الطلب — أكمل الدفع" : "Order created — complete payment");
        navigate({
          to: "/checkout/success" as any,
          search: { order: res.orderId, o: res.orderNumber } as any,
        });
        return;
      }
      // Cash on delivery: go straight to success page.
      toast.success(lang === "ar" ? "تم استلام طلبك بنجاح" : "Order placed successfully");
      navigate({
        to: "/checkout/success" as any,
        search: { order: res.orderId, o: res.orderNumber, cod: "true" } as any,
      });
    } catch (err) {
      // Auth errors and validation errors should still surface to the user.
      if (err instanceof ApiError && (err.status === 401 || err.status === 422)) {
        if (err.status === 401) {
          setError(lang === "ar" ? "يجب تسجيل الدخول لإتمام الطلب." : "Please sign in to place an order.");
        } else {
          setError(err.message || (lang === "ar" ? "تحقق من البيانات أدناه." : "Please review the highlighted fields."));
        }
        if (err.errors) setFieldErrors(err.errors as any);
        toast.error(error || (lang === "ar" ? "فشل إتمام الطلب" : "Checkout failed"));
      } else if (payment === "tamara") {
        // Tamara: never invent a local order id. Surface the real API error.
        const msg = (err as any)?.message || (lang === "ar" ? "فشل إنشاء جلسة الدفع" : "Failed to create payment session");
        setError(
          lang === "ar"
            ? `فشل إنشاء جلسة الدفع\nالسبب: ${msg}`
            : `Failed to create payment session\nReason: ${msg}`,
        );
        toast.error(msg);
      } else {
        // For any other backend issue (cart sync, server error, network),
        // still take the user to the order summary page with local data
        // so they always see their order details after checkout.
        const localOrderNumber = `LOCAL-${Date.now().toString(36).toUpperCase()}`;
        try {
          useCheckoutStore.getState().setLastOrder({
            orderId: null,
            orderNumber: localOrderNumber,
            total,
            payment,
            items: items.map((it) => ({
              serviceSlug: it.serviceSlug,
              serviceTitle: it.serviceTitle,
              planId: it.planId,
              planName: it.planName,
              price: it.price,
              qty: it.qty,
            })),
            info: {
              name: info.name,
              email: info.email,
              phone: info.phone,
              notes: info.notes || undefined,
            },
          });
        } catch {}
        await clear();
        toast.success(lang === "ar" ? "تم استلام طلبك" : "Order received");
        navigate({
          to: "/checkout/success" as any,
          search: { o: localOrderNumber } as any,
        });
        return;
      }
    } finally {
      if (!keepRedirectScreen) setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Link to={"/cart" as any} className="hover:text-primary">{t("checkout.crumb.cart")}</Link>
            <span>/</span>
            <span className="text-foreground">{t("checkout.crumb.checkout")}</span>
          </div>

          {/* Stepper */}
          <div className="mb-8 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-4">
              {steps.map((label, i) => {
                const done = i < step;
                const active = i === step;
                return (
                  <div key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                        done
                          ? "bg-primary text-primary-foreground"
                          : active
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                    <div className={`text-xs sm:text-sm font-bold ${active || done ? "text-foreground" : "text-muted-foreground"}`}>
                      {label}
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 rounded-full ${done ? "bg-primary" : "bg-border"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-7 shadow-sm min-h-[400px]">
              {error && (
                <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <div className="font-bold">{error}</div>
                    {Object.keys(fieldErrors).length > 0 && (
                      <ul className="mt-1 list-disc ps-5 text-xs">
                        {Object.entries(fieldErrors).flatMap(([f, msgs]) =>
                          (Array.isArray(msgs) ? msgs : [String(msgs)]).map((m, i) => (
                            <li key={`${f}-${i}`}><span className="font-semibold">{f}:</span> {m}</li>
                          )),
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              {step === 0 && (
                <div className="space-y-5">
                  <h2 className="text-lg font-bold">{t("checkout.contact")}</h2>
                  {user && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => applyMode(true)}
                        className={`rounded-xl border-2 p-3 text-right text-sm font-bold transition ${
                          useSaved ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        }`}
                      >
                        {lang === "ar" ? "استخدم بياناتي المحفوظة" : "Use my saved info"}
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMode(false)}
                        className={`rounded-xl border-2 p-3 text-right text-sm font-bold transition ${
                          !useSaved ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        }`}
                      >
                        {lang === "ar" ? "إدخال بيانات جديدة" : "Enter new info"}
                      </button>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("checkout.fullName")} value={info.name} onChange={(v) => setInfo({ ...info, name: v })} />
                    <Field label={t("checkout.email")} type="email" value={info.email} onChange={(v) => setInfo({ ...info, email: v })} />
                    <Field label={t("checkout.phone")} value={info.phone} onChange={(v) => setInfo({ ...info, phone: v })} dir="ltr" type="tel" />
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={info.agree}
                      onChange={(e) => setInfo({ ...info, agree: e.target.checked })}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <span className="text-muted-foreground">
                      {t("checkout.agree")}
                    </span>
                  </label>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold">{t("checkout.payment.title")}</h2>
                    <p className="text-sm text-muted-foreground">{t("checkout.payment.desc")}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {paymentMethods.map((m) => {
                      const Icon = m.icon;
                      const active = payment === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setPayment(m.id)}
                          type="button"
                          className={`relative text-right rounded-2xl border-2 p-4 transition-all ${
                            active
                              ? "border-primary bg-primary/5 shadow-[0_10px_30px_-15px_rgba(0,174,198,0.5)]"
                              : "border-border bg-card hover:border-primary/50"
                          }`}
                        >
                          {m.badge && (
                            <span className="absolute -top-2 right-4 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                              {m.badge}
                            </span>
                          )}
                          <div className="flex items-center gap-3">
                            <div className={`flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl ${m.logo ? "bg-white border border-border p-1" : active ? "bg-primary text-white" : "bg-primary-light text-primary"}`}>
                              {m.logo ? (
                                <img src={m.logo} alt={m.name} className="max-h-8 w-auto object-contain" />
                              ) : (
                                <Icon className="h-5 w-5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold">{m.name}</div>
                              <div className="text-xs text-muted-foreground">{m.desc}</div>
                              {m.brands && (
                                <div className="mt-2 flex items-center gap-1.5">
                                  {m.brands.map((b) =>
                                    b.logo ? (
                                      <span key={b.name} className="inline-flex h-6 items-center rounded-md border border-border bg-white px-1.5">
                                        <img src={b.logo} alt={b.name} className="h-4 w-auto object-contain" />
                                      </span>
                                    ) : (
                                      <span key={b.name} className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-white px-2 text-[10px] font-bold text-foreground/70">
                                        {b.icon && <b.icon className="h-3 w-3" />}
                                        {b.name}
                                      </span>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                                active ? "border-primary bg-primary" : "border-border"
                              }`}
                            >
                              {active && <Check className="h-3 w-3 text-white" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-primary-light/60 p-3 text-xs text-primary-dark">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>{t("checkout.payment.note")}</span>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <h2 className="text-lg font-bold">{t("checkout.review.title")}</h2>
                  <ReviewBlock title={t("checkout.review.customer")}>
                    <ReviewRow label={t("checkout.review.name")} value={info.name} />
                    <ReviewRow label={t("checkout.review.email")} value={info.email} />
                    <ReviewRow label={t("checkout.review.phone")} value={info.phone} ltr />
                    {info.company && <ReviewRow label={t("checkout.review.company")} value={info.company} />}
                    {info.notes && <ReviewRow label={t("checkout.review.notes")} value={info.notes} />}
                  </ReviewBlock>
                  <ReviewBlock title={t("checkout.review.payment")}>
                    <ReviewRow label={t("checkout.review.method")} value={paymentMethods.find((m) => m.id === payment)?.name ?? ""} />
                  </ReviewBlock>
                  <ReviewBlock title={t("checkout.review.items")}>
                    {items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between border-b border-dashed border-border py-2 last:border-0 text-sm">
                        <div>
                          <div className="font-bold">{it.serviceTitle}</div>
                          <div className="text-xs text-muted-foreground">{(it.serviceSlug && !it.serviceSlug.startsWith("plan:")) ? (lang === "en" ? "Service" : "خدمة") : t("cart.planLabel")} {it.planName} • {lang === "en" ? "Meters" : "عدد الأمتار"}: <span data-ltr-number>{it.qty}</span></div>
                        </div>
                        <div className="font-bold text-primary" data-ltr-number>{formatCurrency(it.price * it.qty)}</div>
                      </div>
                    ))}
                  </ReviewBlock>
                </div>
              )}

              {/* Nav buttons */}
              <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
                <button
                  onClick={prev}
                  disabled={step === 0}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-5 py-2.5 text-sm font-bold disabled:opacity-40 hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("checkout.prev")}
                </button>
                {step < steps.length - 1 ? (
                  <button
                    onClick={next}
                    disabled={false}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
                  >
                    {t("checkout.next")}
                  </button>
                ) : (
                  <button
                    onClick={placeOrder}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    {submitting
                      ? t("checkout.confirming")
                      : hasBookings
                        ? `${lang === "ar" ? "ادفع العربون" : "Pay deposit"} — ${formatCurrency(depositTotal)}`
                        : `${t("checkout.confirm.full")} — ${formatCurrency(total)}`}
                  </button>
                )}
              </div>
            </div>

            {/* Sidebar summary */}
            <aside className="space-y-4">
              <div className="sticky top-24 rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h3 className="text-base font-bold">{t("checkout.summary.short")}</h3>
                <div className="mt-4 max-h-64 space-y-3 overflow-auto">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold line-clamp-1">{it.serviceTitle}</div>
                        <div className="text-xs text-muted-foreground">{it.planName} • {lang === "en" ? "Meters" : "عدد الأمتار"}: <span data-ltr-number>{it.qty}</span></div>
                      </div>
                      <div className="text-xs font-bold text-primary whitespace-nowrap" data-ltr-number>{formatCurrency(it.price * it.qty)}</div>
                    </div>
                  ))}
                </div>
                <div className="my-4 h-px bg-border" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("checkout.summary.subtotal")}</span><span data-ltr-number>{formatCurrency(subtotal)}</span></div>
                  <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                    <span>{t("checkout.summary.total")}</span>
                    <span className="text-primary" data-ltr-number>{formatCurrency(total)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-end">{L("السعر شامل ضريبة القيمة المضافة", "Price includes VAT")}</p>
                  {hasBookings && (
                    <div className="mt-3 space-y-1.5 rounded-xl bg-primary/5 p-3 text-xs">
                      <div className="flex justify-between font-bold text-primary">
                        <span>{lang === "ar" ? "العربون (يُدفع الآن)" : "Deposit (pay now)"}</span>
                        <span data-ltr-number>{formatCurrency(depositTotal)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{lang === "ar" ? "الباقي في المركز" : "Remaining at center"}</span>
                        <span data-ltr-number>{formatCurrency(remainingTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  {t("checkout.invoice.note")}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({ label, value, onChange, type = "text", dir }: { label: string; value: string; onChange: (v: string) => void; type?: string; dir?: "ltr" | "rtl" }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold">{label}</label>
      <input
        type={type}
        value={value}
        dir={dir}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${dir === "ltr" ? "text-left" : ""}`}
      />
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <h3 className="mb-2 text-sm font-bold text-primary">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span dir={ltr ? "ltr" : undefined} className="font-medium text-foreground text-left">{value}</span>
    </div>
  );
}