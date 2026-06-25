import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2, ShoppingBag, ArrowLeft, Loader2, AlertCircle, Store, Calendar, Clock } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useCart, MAX_QTY_PER_ITEM, isOfferBooking } from "@/hooks/useCart";
import { formatCurrency } from "@/data/account";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [{ title: "Booking Cart | koswmat" }, { name: "description", content: "Review your items and complete your purchase." }],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, remove, updateQty, subtotal, vat, total, count, loading, error, refresh } = useCart();
  const { t, lang, dir } = useLang();

  const L = (a: string, e: string) => (lang === "en" ? e : a);

  // Compute online deposit (= sum of commission for offer bookings).
  // Non-booking items are paid in full online.
  const hasInvalidBookingPct = items.some((it) => isOfferBooking(it) && (it.commissionPct == null || it.commissionPct <= 0));
  const depositTotal = items.reduce((s, it) => {
    if (isOfferBooking(it) && it.commissionPct != null) {
      return s + (it.price * it.qty * it.commissionPct) / 100;
    }
    return isOfferBooking(it) ? s : s + it.price * it.qty;
  }, 0);
  const remainingAtCenter = items.reduce((s, it) => {
    if (isOfferBooking(it) && it.commissionPct != null) {
      return s + it.price * it.qty * (1 - it.commissionPct / 100);
    }
    return s;
  }, 0);
  const hasBookings = items.some(isOfferBooking);

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">{t("common.home")}</Link>
            <span>/</span>
            <span className="text-foreground">{t("cart.title")}</span>
          </div>

          <div className="mb-8 flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold">{t("cart.title")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{count} {t("cart.itemCount")}</p>
            </div>
            <Link to="/offers" className="hidden sm:inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ArrowLeft className={`h-4 w-4 ${dir === "ltr" ? "rotate-180" : ""}`} />
              {t("cart.continueShopping")}
            </Link>
          </div>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div className="font-bold">{t("cart.loadError")}</div>
                <div className="text-xs opacity-80">{error}</div>
              </div>
              <button onClick={() => refresh()} className="rounded-md border border-rose-300 px-2.5 py-1 text-xs font-bold hover:bg-rose-100">
                {t("cart.retry")}
              </button>
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center rounded-3xl border border-dashed border-border bg-card p-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="ms-3 text-sm text-muted-foreground">{t("cart.loading")}</span>
            </div>
          ) : items.length === 0 ? (
            <EmptyCart t={t} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
              <div className="space-y-5">
                {(() => {
                  // Group items by vendor for clarity when the cart contains
                  // offers from multiple centers. Items without a vendorName
                  // fall back to a generic "Other" bucket.
                  const groups = new Map<string, typeof items>();
                  for (const it of items) {
                    const key = it.vendorName || L("منتجات وخدمات أخرى", "Other items");
                    if (!groups.has(key)) groups.set(key, [] as any);
                    (groups.get(key) as any).push(it);
                  }
                  return Array.from(groups.entries()).map(([vendor, group]) => (
                    <section key={vendor} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                      <header className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3 sm:px-5">
                        <Store className="h-4 w-4 text-primary" />
                        <h2 className="text-sm font-bold text-foreground">{vendor}</h2>
                        <span className="text-xs text-muted-foreground">· {group.length} {L("عنصر", "items")}</span>
                      </header>
                      <div className="divide-y divide-border">
                        {group.map((it) => {
                          const atMax = it.qty >= MAX_QTY_PER_ITEM;
                          return (
                            <div key={it.id} className="p-4 sm:p-5">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-muted-foreground">{t("cart.planLabel")} {it.planName}</div>
                                  <h3 className="mt-1 text-base font-bold text-foreground line-clamp-1">{it.serviceTitle}</h3>
                                  {isOfferBooking(it) && (
                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 font-bold text-primary">
                                        <Calendar className="h-3 w-3" /> {it.bookingDate}
                                      </span>
                                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 font-bold text-primary">
                                        <Clock className="h-3 w-3" /> {it.bookingTime}
                                      </span>
                                      {it.commissionPct != null && it.commissionPct > 0 ? (
                                        <span className="text-[11px] text-muted-foreground">
                                          {L("عربون الآن:", "Deposit now:")} <b className="text-primary" data-ltr-number>{formatCurrency((it.price * it.qty * it.commissionPct) / 100)}</b> · {L("الباقي عند الزيارة:", "Remaining at visit:")} <span data-ltr-number>{formatCurrency(it.price * it.qty * (1 - it.commissionPct / 100))}</span>
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-bold text-rose-600">{L("نسبة عربون هذا المركز غير محددة", "This center's deposit percentage is not set")}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center justify-between gap-4 sm:gap-6">
                                  <div className="inline-flex flex-col items-start gap-1">
                                    <input
                                      type="number"
                                      min={1}
                                      max={MAX_QTY_PER_ITEM}
                                      inputMode="numeric"
                                      value={it.qty}
                                      onChange={(e) => {
                                        const v = parseInt(e.target.value, 10);
                                        if (!Number.isNaN(v) && v > 0) updateQty(it.id, Math.min(MAX_QTY_PER_ITEM, v));
                                        else if (e.target.value === "") updateQty(it.id, 1);
                                      }}
                                      className="h-10 w-20 rounded-lg border border-border bg-background px-2 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                                      aria-label={L("الكمية", "Quantity")}
                                      data-ltr-number
                                    />
                                    {atMax && (
                                      <span className="text-[10px] font-bold text-amber-600">
                                        {L(`الحد الأقصى ${MAX_QTY_PER_ITEM}`, `Max ${MAX_QTY_PER_ITEM}`)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-[100px] text-left">
                                    <div className="text-base font-bold text-primary" data-ltr-number>{formatCurrency(it.price * it.qty)}</div>
                                    <div className="text-[11px] text-muted-foreground" data-ltr-number>{formatCurrency(it.price)} {t("cart.perUnit")}</div>
                                  </div>
                                  <button
                                    onClick={() => remove(it.id)}
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-rose-500 hover:bg-rose-50"
                                    aria-label={t("cart.delete")}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ));
                })()}
              </div>

              {/* Summary */}
              <aside className="space-y-4">
                <div className="sticky top-24 rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <h3 className="text-lg font-bold">{t("cart.summaryTitle")}</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <Row label={t("cart.subtotal")} value={formatCurrency(subtotal)} />
                    <div className="my-2 h-px bg-border" />
                    <div className="flex items-center justify-between text-base font-bold">
                      <span>{t("cart.total")}</span>
                      <span className="text-primary">{formatCurrency(total)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground text-end">{L("السعر شامل ضريبة القيمة المضافة", "Price includes VAT")}</p>
                    {hasBookings && (
                      <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-sm font-extrabold text-primary">
                          <span>{L("عربون يُدفع الآن أونلاين", "Deposit paid online now")}</span>
                          <span data-ltr-number>{formatCurrency(depositTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{L("الباقي يُدفع عند الزيارة للمركز", "Remainder paid at the center")}</span>
                          <span data-ltr-number>{formatCurrency(remainingAtCenter)}</span>
                        </div>
                      </div>
                    )}
                    {hasInvalidBookingPct && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{L("يوجد حجز بنسبة عربون غير محددة. احذفه وأعد إضافته بعد ضبط نسبة المركز.", "A booking has no deposit percentage set. Remove it and re-add after the center's percentage is configured.")}</span>
                      </div>
                    )}
                  </div>

                  {hasInvalidBookingPct ? (
                    <button disabled className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-muted text-base font-bold text-muted-foreground">
                      {L("لا يمكن الدفع قبل ضبط النسبة", "Cannot pay before percentage is set")}
                    </button>
                  ) : (
                    <Link
                      to={"/checkout" as any}
                      className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-[0_10px_30px_-10px_rgba(0,174,198,0.6)] hover:bg-primary-dark transition"
                    >
                      {hasBookings ? `${L("إتمام الدفع — عربون", "Pay deposit")} ${formatCurrency(depositTotal)}` : t("cart.checkout")}
                    </Link>
                  )}
                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    {hasBookings ? L("العربون يساوي عمولة المنصة، والمركز يستلم الباقي عند زيارتك.", "The deposit equals the platform fee, and the center collects the remainder at your visit.") : t("cart.summarySubtitle")}
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium" data-ltr-number>{value}</span>
    </div>
  );
}

function EmptyCart({ t }: { t: (k: any) => string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-light text-primary">
        <ShoppingBag className="h-9 w-9" />
      </div>
      <h3 className="mt-5 text-xl font-bold">{t("cart.empty.title")}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{t("cart.empty.alt")}</p>
      <Link
        to={"/offers" as any}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
      >
        {t("cart.empty.cta")}
      </Link>
    </div>
  );
}