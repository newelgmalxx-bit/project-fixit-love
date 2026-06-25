import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, CheckCircle2, Package, Download, FileText, Loader2, Receipt, Calendar, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useLang } from "@/i18n/LanguageProvider";
import { account, checkout as checkoutApi } from "@/lib/api";
import { normalizeOrder } from "@/lib/api/normalize";
import { downloadInvoice } from "@/lib/invoice";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, paymentMethods, paymentName, type Order, type PaymentMethod } from "@/data/account";
import { useCheckoutStore } from "@/store/checkoutStore";

const GATEWAY_METHODS: PaymentMethod[] = ["mayfatoorah", "tabby", "tamara"];

export const Route = createFileRoute("/checkout/success")({
  validateSearch: z.object({
    o: z.string().optional(),
    order: z.string().optional(),
    orderId: z.string().optional(),
    paymentId: z.string().optional(),
    Id: z.string().optional(),
    payUrl: z.string().optional(),
    paid: z.string().optional(),
    cod: z.string().optional(),
  }),
  head: () => ({ meta: [{ title: "Order Received | koswmat" }] }),
  component: SuccessPage,
});

function SuccessPage() {
  const { o, order: orderQ, orderId, paymentId, Id, payUrl, paid, cod } = Route.useSearch();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const id = orderId || orderQ || o;
  const actualPaymentId = paymentId || Id;
  const lastOrder = useCheckoutStore((s) => s.lastOrder);
  // Strip optional surrounding quotes from search params (some gateways encode them).
  const codFlag = (cod || "").replace(/^"|"$/g, "") === "true";
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [verifying, setVerifying] = useState(!!actualPaymentId);
  const [paidFlag, setPaidFlag] = useState<boolean>(paid === "1");
  const [showGateways, setShowGateways] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<PaymentMethod>("mayfatoorah");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Verify MyFatoorah payment if we have a paymentId/Id from gateway redirect
  useEffect(() => {
    if (!actualPaymentId) return;
    let alive = true;
    setVerifying(true);
    checkoutApi.verify(actualPaymentId)
      .then((res: any) => {
        if (!alive) return;
        const d = res?.data || res || {};
        if (d.paid === false && (d.paymentStatus === "failed" || d.status === "cancelled")) {
          navigate({
            to: "/checkout/failed" as any,
            search: { order: d.orderId || id } as any,
            replace: true,
          });
          return;
        }
        if (d.paid === true) setPaidFlag(true);
      })
      .catch(() => { /* keep page rendering */ })
      .finally(() => { if (alive) setVerifying(false); });
    return () => { alive = false; };
  }, [actualPaymentId, id, navigate]);

  // Fetch order details
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    account.orderDetail(id)
      .then((res: any) => {
        const raw = res?.data?.order ?? res?.order ?? res;
        if (!alive || !raw) return;
        try {
          const normalized = normalizeOrder(raw);
          setOrder(normalized);
        } catch { /* ignore */ }
      })
      .catch(() => { /* keep empty state, no redirects */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  // Fallback: rebuild a minimal Order from the lastOrder we saved before checkout
  // so the user always sees their order summary even if the API fetch fails.
  const fallbackOrder: Order | null = (() => {
    if (order) return null;
    if (!lastOrder) {
      if (!id && !o) return null;
      return {
        id: id || o || "",
        number: o || id || "",
        createdAt: new Date().toISOString(),
        status: "pending" as any,
        payment: codFlag ? "cod" : "mayfatoorah",
        paid: false,
        paymentStatus: "unpaid",
        invoice: null,
        items: [],
        subtotal: 0,
        vat: 0,
        total: 0,
        timeline: [],
      };
    }
    const matchesById = id && (lastOrder.orderId === id || lastOrder.orderNumber === id);
    const matchesByNumber = o && lastOrder.orderNumber === o;
    if (!matchesById && !matchesByNumber && id) return null;
    const subtotal = lastOrder.items.reduce((s, it) => s + it.price * it.qty, 0);
    const vat = 0; // Prices are VAT-inclusive — no extra VAT added.
    const total = lastOrder.total || subtotal;
    return {
      id: lastOrder.orderId || lastOrder.orderNumber || "",
      number: lastOrder.orderNumber || o || "",
      createdAt: new Date().toISOString(),
      status: "pending" as any,
      payment: (lastOrder.payment || "cod") as PaymentMethod,
      paid: paidFlag,
      paymentStatus: paidFlag ? "paid" : "unpaid",
      invoice: null,
      items: lastOrder.items.map((it, i) => ({
        id: it.id || `tmp-${i}`,
        serviceSlug: it.serviceSlug,
        serviceTitle: it.serviceTitle,
        planId: it.planId || "",
        planName: it.planName || "",
        price: it.price,
        qty: it.qty,
      })) as any,
      subtotal,
      vat,
      total,
      timeline: [],
    };
  })();

  const baseOrder = order || fallbackOrder;
  const displayOrder: Order | null = baseOrder ? (() => {
    const effectivePaid = codFlag ? false : (paidFlag || baseOrder.paid);
    return {
      ...baseOrder,
      paid: effectivePaid,
      paymentStatus: effectivePaid ? "paid" : "unpaid",
    };
  })() : null;

  const handlePayNow = async () => {
    if (!displayOrder) return;
    setPaying(true);
    setPayError(null);
    try {
      const res: any = await account.payOrder(displayOrder.id, { paymentMethod: selectedGateway });
      const url = res?.data?.paymentUrl || res?.paymentUrl;
      if (url) { window.location.href = url; return; }
      setPayError(lang === "ar" ? "تعذّر الحصول على رابط الدفع. اختر بوابة أخرى أو حاول لاحقًا." : "Could not get the payment URL. Choose another gateway or try later.");
    } catch (e: any) {
      setPayError(e?.message || (lang === "ar" ? "تعذّر بدء عملية الدفع" : "Could not start payment"));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_20px_50px_-15px_rgba(16,185,129,0.6)]">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-bold">{t("checkout.success.h1")}</h1>
          <p className="mt-2 max-w-md text-muted-foreground">{t("checkout.success.body")}</p>
          {(displayOrder?.number || o) && (
            <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-border bg-card px-5 py-2.5 shadow-sm">
              <span className="text-sm text-muted-foreground">{t("checkout.success.orderLabel")}</span>
              <span className="text-base font-bold text-primary" dir="ltr">{displayOrder?.number || o}</span>
            </div>
          )}
          {displayOrder?.paid && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100 px-4 py-1.5 text-xs font-bold text-emerald-800">
              {lang === "ar" ? "تم الدفع" : "Paid"}
            </div>
          )}
          {displayOrder && !displayOrder.paid && codFlag && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100 px-4 py-1.5 text-xs font-bold text-amber-800">
              {lang === "ar" ? "الدفع عند الاستلام — لم يتم الدفع بعد" : "Cash on delivery — payment pending"}
            </div>
          )}
          {displayOrder && !displayOrder.paid && !codFlag && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100 px-4 py-1.5 text-xs font-bold text-amber-800">
              {verifying ? (lang === "ar" ? "جارٍ التحقق من الدفع..." : "Verifying payment...") : (lang === "ar" ? "لم يتم الدفع بعد" : "Payment pending")}
            </div>
          )}
        </div>

        {((loading && !displayOrder) || (verifying && !displayOrder)) && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {displayOrder && (
          <div className="mt-8 space-y-5">
            {displayOrder.items.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
                <h3 className="mb-4 text-base font-bold">{t("account.order.items")}</h3>
                <div className="space-y-3">
                  {displayOrder.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold line-clamp-1">{it.serviceTitle}</div>
                          <p className="text-xs text-muted-foreground">
                            {t("account.order.plan")} {it.planName} • {t("account.order.qty")} <span data-ltr-number>{it.qty}</span>
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-end">
                        <div className="text-sm font-bold text-primary" data-ltr-number>{formatCurrency(it.price * it.qty, lang)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-bold">{t("account.order.summary")}</h3>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("account.order.subtotal")}</span>
                  <span className="font-medium" data-ltr-number>{formatCurrency(displayOrder.subtotal, lang)}</span>
                </div>
                <div className="my-2 h-px bg-border" />
                <div className="flex justify-between text-base font-bold">
                  <span>{t("account.order.total")}</span>
                  <span className="text-primary" data-ltr-number>{formatCurrency(displayOrder.total, lang)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground text-end">{lang === "ar" ? "السعر شامل ضريبة القيمة المضافة" : "Price includes VAT"}</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  <span>{paymentName(displayOrder.payment, lang)}</span>
                  {displayOrder.paid && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      {t("account.orders.paid")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span data-ltr-number>{displayOrder.createdAt}</span>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {!displayOrder.paid && payUrl && (
                <a
                  href={payUrl}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dark px-6 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-95"
                >
                  <Wallet className="h-4 w-4" />
                  {lang === "ar" ? "ادفع الآن" : "Pay now"}
                </a>
              )}
              {!displayOrder.paid && !payUrl && !showGateways && (
                <button
                  type="button"
                  onClick={() => setShowGateways(true)}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dark px-6 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-95"
                >
                  <Wallet className="h-4 w-4" />
                  {lang === "ar" ? "ادفع الآن" : "Pay now"}
                </button>
              )}
              {!displayOrder.paid && !payUrl && showGateways && (
                <div className="w-full rounded-2xl border border-border bg-card p-4 text-start shadow-sm">
                  <div className="mb-3 text-sm font-bold">{lang === "ar" ? "اختر بوابة الدفع" : "Choose a payment gateway"}</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {paymentMethods.filter((m) => GATEWAY_METHODS.includes(m.id)).map((m) => {
                      const Icon = m.icon;
                      const active = selectedGateway === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedGateway(m.id)}
                          className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-bold transition ${active ? "border-primary bg-primary-light text-primary" : "border-border bg-background hover:border-primary/50"}`}
                        >
                          {m.logo ? <img src={m.logo} alt={m.name} className="h-6 w-12 object-contain" /> : <Icon className="h-5 w-5" />}
                          <span className="flex-1">{m.name}</span>
                          {active && <Check className="h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>
                  {payError && <div className="mt-3 text-sm font-bold text-destructive">{payError}</div>}
                  <button
                    type="button"
                    onClick={handlePayNow}
                    disabled={paying}
                    className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dark px-6 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-95 disabled:opacity-60"
                  >
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    {lang === "ar" ? "المتابعة للدفع" : "Continue to payment"}
                  </button>
                </div>
              )}
              {displayOrder.paid && (
                <button
                  onClick={() => downloadInvoice(displayOrder, user?.name || "")}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
                >
                  <Download className="h-4 w-4" />
                  {t("account.orders.downloadInvoice")}
                </button>
              )}
              <Link
                to={"/account/orders/$orderId" as any}
                params={{ orderId: displayOrder.id } as any}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-bold hover:bg-muted"
              >
                <Package className="h-4 w-4" />
                {lang === "ar" ? "تفاصيل الطلب" : "Order details"}
              </Link>
              <Link
                to={"/account/orders" as any}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-bold hover:bg-muted"
              >
                {t("checkout.success.orders")}
              </Link>
            </div>
          </div>
        )}

        {!loading && !displayOrder && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={"/account/orders" as any}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
            >
              <Package className="h-4 w-4" />
              {t("checkout.success.orders")}
            </Link>
            <Link
              to={"/" as any}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-bold hover:bg-muted"
            >
              {t("checkout.success.home")}
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
