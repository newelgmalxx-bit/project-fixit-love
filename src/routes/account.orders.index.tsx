import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Search, Filter, Package, Download, Eye, Loader2, Wallet, X, Check } from "lucide-react";
import { AccountLayout, StatusBadge } from "@/components/account/AccountLayout";
import { statusLabels, formatCurrency, paymentName, paymentMethods as allPaymentMethods, type OrderStatus, type Order, type PaymentMethod } from "@/data/account";
import { downloadInvoice } from "@/lib/invoice";
import { useLang } from "@/i18n/LanguageProvider";
import type { TKey } from "@/i18n/translations";
import { account } from "@/lib/api";
import { normalizeOrder } from "@/lib/api/normalize";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const GATEWAY_METHODS: PaymentMethod[] = ["mayfatoorah", "tabby", "tamara"];

export const Route = createFileRoute("/account/orders/")({
  head: () => ({ meta: [{ title: "My Orders | koswmat" }] }),
  component: OrdersList,
});

const filters: { id: OrderStatus | "all"; key: TKey }[] = [
  { id: "all", key: "account.orders.filter.all" },
  { id: "in_progress", key: "account.orders.filter.in_progress" },
  { id: "review", key: "account.orders.filter.review" },
  { id: "completed", key: "account.orders.filter.completed" },
  { id: "cancelled", key: "account.orders.filter.cancelled" },
];

function OrdersList() {
  const { t, lang, dir } = useLang();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOrderState, setPayOrderState] = useState<Order | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<PaymentMethod>("mayfatoorah");
  const [paying, setPaying] = useState(false);

  const handlePayNow = async () => {
    if (!payOrderState || paying) return;
    setPaying(true);
    try {
      const res: any = await account.payOrder(payOrderState.id, { paymentMethod: selectedGateway });
      const url = res?.data?.paymentUrl || res?.paymentUrl;
      if (url) {
        window.location.href = url;
        return;
      }
      toast.error(t("account.orders.toast.payUrlFail"));
    } catch (e: any) {
      toast.error(e?.message || t("account.orders.toast.payStartFail"));
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    account.listOrders({ status: filter === "all" ? undefined : filter, limit: 50 })
      .then((res) => {
        if (!alive) return;
        const items = (res.items || []).map(normalizeOrder);
        setOrders(items);
      })
      .catch(() => { if (alive) setOrders([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filter]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchQ = !q || o.number.toLowerCase().includes(q.toLowerCase()) || o.items.some((i) => i.serviceTitle.includes(q));
      const matchF = filter === "all" || o.status === filter;
      return matchQ && matchF;
    });
  }, [q, filter, orders]);

  const sideClass = dir === "rtl" ? "right-3" : "left-3";
  const padSide = dir === "rtl" ? "pr-10 pl-3" : "pl-10 pr-3";
  return (
    <AccountLayout title={t("account.orders.title")} subtitle={t("account.orders.subtitle")}>
      {/* Filters bar */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className={`absolute ${sideClass} top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground`} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("account.orders.search")}
              className={`w-full rounded-lg border border-border bg-background py-2.5 ${padSide} text-sm focus:outline-none focus:ring-2 focus:ring-primary/30`}
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-auto">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition ${
                  filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70 hover:bg-accent"
                }`}
              >
                {t(f.key)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">{t("account.orders.empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr className={dir === "rtl" ? "text-right" : "text-left"}>
                  <th className="px-4 py-3 font-bold">{t("account.orders.col.order")}</th>
                  <th className="px-4 py-3 font-bold">{t("account.orders.col.services")}</th>
                  <th className="px-4 py-3 font-bold">{t("account.orders.col.date")}</th>
                  <th className="px-4 py-3 font-bold">{t("account.orders.col.status")}</th>
                  <th className="px-4 py-3 font-bold">{t("account.orders.col.total")}</th>
                  <th className="px-4 py-3 font-bold">{t("account.orders.col.payment")}</th>
                  <th className="px-4 py-3 font-bold">{t("account.orders.col.redeemed")}</th>
                  <th className="px-4 py-3 font-bold text-end">{t("account.orders.col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const s = statusLabels[o.status];
                  return (
                    <tr
                      key={o.id}
                      className="border-t border-border hover:bg-muted/30 transition cursor-pointer"
                      onClick={() => navigate({ to: "/account/orders/$orderId", params: { orderId: o.id } })}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-foreground" dir="ltr">{o.number}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{paymentName(o.payment, lang)}</div>
                      </td>
                      <td className="px-4 py-3 align-top max-w-[280px]">
                        <div className="text-xs text-foreground/80 line-clamp-2">
                          {o.items.map((i) => `${i.serviceTitle}${i.planName ? ` (${i.planName})` : ""}`).join(" • ")}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {o.items.length} {t("account.orders.servicesCount")}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap" data-ltr-number>
                        {o.createdAt}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge label={t(`order.status.${o.status}` as TKey)} color={s.color} />
                      </td>
                      <td className="px-4 py-3 align-top font-bold text-primary whitespace-nowrap" data-ltr-number>
                        {formatCurrency(o.total, lang)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {o.paid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                            <Check className="h-3 w-3" />
                            {t("account.orders.paid")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                            {t("account.orders.unpaid")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {o.redeemed ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                              <Check className="h-3 w-3" />
                              {t("account.orders.cell.redeemed")}
                            </span>
                            {o.redeemedAt && (
                              <span className="text-[10px] text-muted-foreground" data-ltr-number>{o.redeemedAt}</span>
                            )}
                          </div>
                        ) : o.status === "cancelled" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                            {t("account.orders.cell.notAvailable")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                            {t("account.orders.cell.notYet")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {!o.paid && o.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedGateway((o.payment as PaymentMethod) === "cod" ? "mayfatoorah" : (o.payment as PaymentMethod));
                                setPayOrderState(o);
                              }}
                              className="inline-flex h-8 items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 text-xs font-bold text-white shadow-sm hover:opacity-95"
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              {t("account.orders.cell.rePay")}
                            </button>
                          )}
                          {o.paid && (
                            <button
                              onClick={() => downloadInvoice(o, user?.name || "")}
                              title={t("account.orders.downloadInvoice")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background hover:bg-muted hover:text-primary transition"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <Link
                            to="/account/orders/$orderId"
                            params={{ orderId: o.id }}
                            className="inline-flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary-dark"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t("account.orders.details")}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {payOrderState && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !paying && setPayOrderState(null)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir={dir}
          >
            <button
              type="button"
              onClick={() => !paying && setPayOrderState(null)}
              className="absolute end-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground/70 hover:bg-secondary/80"
              aria-label="close"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-extrabold">
              {t("account.orders.payModal.title")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
              {payOrderState.number} • <span data-ltr-number>{formatCurrency(payOrderState.total, lang)}</span>
            </p>

            <div className="mt-5 grid gap-2">
              {allPaymentMethods.filter((m) => GATEWAY_METHODS.includes(m.id)).map((m) => {
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

            <button
              onClick={handlePayNow}
              disabled={paying}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-dark px-5 text-sm font-extrabold text-primary-foreground shadow-sm hover:opacity-95 disabled:opacity-60"
            >
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {t("account.orders.payModal.continue")}
            </button>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}