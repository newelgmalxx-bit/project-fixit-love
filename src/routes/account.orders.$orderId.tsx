import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Package, Download, MessageSquarePlus, ChevronLeft, ChevronRight, Calendar, CreditCard,
  CheckCircle2, Circle, FileText, Receipt, Loader2, Wallet, Check,
} from "lucide-react";
import { AccountLayout, StatusBadge } from "@/components/account/AccountLayout";
import { statusLabels, statusFlow, formatCurrency, paymentName, paymentIcon, paymentMethods, type Order, type PaymentMethod } from "@/data/account";
import { downloadInvoice } from "@/lib/invoice";
import { useLang } from "@/i18n/LanguageProvider";
import type { TKey } from "@/i18n/translations";
import { account } from "@/lib/api";
import { normalizeOrder } from "@/lib/api/normalize";
import { useAuth } from "@/hooks/useAuth";

const GATEWAY_METHODS: PaymentMethod[] = ["mayfatoorah", "tabby", "tamara"];

export const Route = createFileRoute("/account/orders/$orderId")({
  head: () => ({ meta: [{ title: "Order Details | koswmat" }] }),
  notFoundComponent: NotFoundOrder,
  errorComponent: ({ error }) => <ErrorOrder message={error.message} />,
  component: OrderDetail,
});

function NotFoundOrder() {
  const { t } = useLang();
  return (
    <AccountLayout title={t("account.order.notFound.title")}>
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">{t("account.order.notFound.desc")}</p>
        <Link to={"/account/orders" as any} className="mt-4 inline-flex items-center text-sm text-primary hover:underline">
          {t("account.order.backToList")}
        </Link>
      </div>
    </AccountLayout>
  );
}

function ErrorOrder({ message }: { message: string }) {
  const { t } = useLang();
  return (
    <AccountLayout title={t("account.order.error")}>
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">{message}</div>
    </AccountLayout>
  );
}

function OrderDetail() {
  const { t, lang, dir } = useLang();
  const { orderId } = Route.useParams();
  const { user } = useAuth();
  // navigation no longer needed; pay is inline
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [showGateways, setShowGateways] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<PaymentMethod>("mayfatoorah");
  const [payError, setPayError] = useState<string | null>(null);
  const handlePayNow = async () => {
    if (!order || paying) return;
    setPaying(true);
    setPayError(null);
    try {
      const res: any = await account.payOrder(order.id, { paymentMethod: selectedGateway });
      const url = res?.data?.paymentUrl || res?.paymentUrl;
      if (url) { window.location.href = url; return; }
      setPayError(t("account.order.payUrlFailLong"));
    } catch (e: any) {
      setPayError(e?.message || t("account.order.payStartFail"));
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    account.getOrder(orderId)
      .then((o) => { if (alive) setOrder(normalizeOrder(o)); })
      .catch(() => {
        if (!alive) return;
        setError("not_found");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [orderId]);

  if (loading) {
    return (
      <AccountLayout title={t("account.order.titleTpl")}>
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AccountLayout>
    );
  }
  if (error || !order) return <NotFoundOrder />;

  const s = statusLabels[order.status];
  const PayIcon = paymentIcon(order.payment);
  const currentIdx = statusFlow.indexOf(order.status);
  const Chev = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <AccountLayout title={`${t("account.order.titleTpl")} ${order.number}`} subtitle={`${t("account.order.createdAt")} ${order.createdAt}`}>
      <Link
        to={"/account/orders" as any}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className={`h-4 w-4 ${dir === "ltr" ? "rotate-180" : ""}`} />
        {t("account.order.backToList")}
      </Link>

      {/* Header card */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold" dir="ltr">{order.number}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge label={t(`order.status.${order.status}` as TKey)} color={s.color} />
                {order.paid ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{t("account.orders.paid")}</span>
                ) : (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">{t("account.orders.unpaid")}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {order.paid && (
              <button
                onClick={() => downloadInvoice(order, user?.name || "")}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
              >
                <Download className="h-4 w-4" />
                {t("account.orders.downloadInvoice")}
              </button>
            )}
            <Link
              to={"/account/tickets/new" as any}
              search={{ order: order.id } as any}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-bold hover:bg-muted"
            >
              <MessageSquarePlus className="h-4 w-4" />
              {t("account.order.openTicket")}
            </Link>
          </div>
        </div>
      </div>

      {/* Progress */}
      {order.status !== "cancelled" && (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <h3 className="mb-5 text-base font-bold">{t("account.order.stages")}</h3>
          <div className="relative grid grid-cols-5 gap-2">
            <div className="absolute right-[10%] left-[10%] top-4 h-1 rounded-full bg-muted">
              <div
                className={`h-full rounded-full bg-gradient-to-${dir === "rtl" ? "l" : "r"} from-primary to-primary-dark transition-all`}
                style={{ width: `${(currentIdx / (statusFlow.length - 1)) * 100}%` }}
              />
            </div>
            {statusFlow.map((st, i) => {
              const done = i <= currentIdx;
              const label = t(`order.status.${st}` as TKey);
              return (
                <div key={st} className="relative flex flex-col items-center gap-2">
                  <div
                    className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                      done
                        ? "bg-gradient-to-br from-primary to-primary-dark text-white shadow-[0_8px_20px_-6px_rgba(0,174,198,0.5)]"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </div>
                  <span className={`text-[10px] sm:text-xs text-center font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Items + timeline */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <h3 className="mb-4 text-base font-bold">{t("account.order.items")}</h3>
            <div className="space-y-3">
              {order.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold line-clamp-1">
                        {it.serviceTitle}
                      </div>
                      <p className="text-xs text-muted-foreground">{t("account.order.plan")} {it.planName} • {t("account.order.qty")} <span data-ltr-number>{it.qty}</span></p>
                    </div>
                  </div>
                  <div className={`shrink-0 ${dir === "rtl" ? "text-left" : "text-right"}`}>
                    <div className="text-sm font-bold text-primary" data-ltr-number>{formatCurrency(it.price * it.qty, lang)}</div>
                    <div className="text-[11px] text-muted-foreground" data-ltr-number>{formatCurrency(it.price, lang)} {t("account.order.perUnit")}</div>
                  </div>
                </div>
              ))}
            </div>

            {order.notes && (
              <div className={`mt-5 rounded-xl ${dir === "rtl" ? "border-r-4" : "border-l-4"} border-primary bg-primary-light/40 p-4`}>
                <h4 className="text-xs font-bold text-primary">{t("account.order.clientNotes")}</h4>
                <p className="mt-1 text-sm text-foreground/80">{order.notes}</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <h3 className="mb-4 text-base font-bold">{t("account.order.history")}</h3>
            <ol className={`relative space-y-5 ${dir === "rtl" ? "border-r-2 pr-5" : "border-l-2 pl-5"} border-border`}>
              {[...order.timeline].reverse().map((t, i) => {
                const ts = statusLabels[t.status];
                const stLabel = translateStatus(t.status, lang);
                return (
                  <li key={i} className="relative">
                    <div className={`absolute ${dir === "rtl" ? "-right-[27px]" : "-left-[27px]"} top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-background`} />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={stLabel} color={ts.color} />
                      <span className="text-xs text-muted-foreground">{t.at}</span>
                    </div>
                    {t.note && <p className="mt-1 text-sm text-foreground/80">{t.note}</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        {/* Summary */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-base font-bold">{t("account.order.summary")}</h3>
            <div className="mt-4 space-y-2 text-sm">
              <Row label={t("account.order.subtotal")} value={formatCurrency(order.subtotal, lang)} />
              <div className="my-2 h-px bg-border" />
              <div className="flex justify-between text-base font-bold">
                <span>{t("account.order.total")}</span>
                <span className="text-primary" data-ltr-number>{formatCurrency(order.total, lang)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground text-end">{t("account.order.priceVat")}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-base font-bold">{t("account.order.paymentInfo")}</h3>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-background p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                <PayIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold">{paymentName(order.payment, lang)}</div>
                <div className="text-xs text-muted-foreground">{order.paid ? t("account.order.paid") : t("account.order.awaitingPayment")}</div>
              </div>
            </div>
            {!order.paid && order.status !== "cancelled" && !showGateways && (
              <button
                onClick={() => setShowGateways(true)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-95"
              >
                <Wallet className="h-4 w-4" />
                {t("account.order.payNow")}
              </button>
            )}
            {!order.paid && order.status !== "cancelled" && showGateways && (
              <div className="mt-3 space-y-3">
                <div className="text-xs font-bold text-muted-foreground">{t("account.order.chooseGateway")}</div>
                <div className="grid gap-2">
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
                        <span className="flex-1 text-start">{m.name}</span>
                        {active && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
                {payError && <div className="text-sm font-bold text-destructive">{payError}</div>}
                <button
                  onClick={handlePayNow}
                  disabled={paying}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-95 disabled:opacity-60"
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  {t("account.order.continue")}
                </button>
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span data-ltr-number>{order.createdAt}</span>
            </div>
          </div>
          {order.paid && (
            <button
              onClick={() => downloadInvoice(order, user?.name || "")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary-light/30 p-4 text-sm font-bold text-primary hover:bg-primary-light/60 transition"
            >
              <Receipt className="h-4 w-4" />
              {t("account.order.taxInvoice")}
            </button>
          )}
        </aside>
      </div>
    </AccountLayout>
  );
}

function translateStatus(status: string, lang: "ar" | "en") {
  const map: Record<string, { ar: string; en: string }> = {
    pending: { ar: "بانتظار التأكيد", en: "Pending" },
    confirmed: { ar: "تم التأكيد", en: "Confirmed" },
    in_progress: { ar: "قيد التنفيذ", en: "In progress" },
    review: { ar: "قيد المراجعة", en: "Under review" },
    completed: { ar: "مكتمل", en: "Completed" },
    cancelled: { ar: "ملغي", en: "Cancelled" },
  };
  return map[status]?.[lang] ?? status;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium" data-ltr-number>{value}</span>
    </div>
  );
}