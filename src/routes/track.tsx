import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, FolderOpen, Tag, FileText, Calendar, Check, Mail, Phone, CreditCard, Receipt, Sparkles, ShieldCheck, Clock, QrCode, MapPin, Store } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { FeaturedOffers } from "@/components/sections/FeaturedOffers";
import { publicApi } from "@/lib/api/public";
import { useLang } from "@/i18n/LanguageProvider";
import type { TKey } from "@/i18n/translations";

export const Route = createFileRoute("/track")({
  head: () => ({ meta: [{ title: "متابعة الحجز | koswmat" }] }),
  component: TrackPage,
});

type StatusKey = "unpaid" | "paid" | "confirmed_branch";

const STAGE_LABELS_AR: Record<StatusKey, string> = {
  unpaid: "لم يتم الدفع",
  paid: "تم الدفع",
  confirmed_branch: "تم التأكيد في الفرع",
};

type OrderItem = {
  title: string;
  planName?: string | null;
  qty: number;
  price: number;
  originalPrice?: number | null;
};

type TimelineEvent = {
  status?: string;
  label?: string;
  note?: string;
  at?: string;
  created_at?: string;
};

type PartnerInfo = {
  name: string;
  address: string;
  phone: string;
  mapsUrl?: string | null;
};

type Order = {
  number: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  total?: number;
  subtotal?: number;
  vat?: number;
  couponDiscount?: number;
  currency?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  depositPaid?: number;
  remaining?: number;
  verificationCode?: string;
  qrData?: string;
  confirmedAt?: string;
};

type Result = {
  order: Order;
  items: OrderItem[];
  timeline: TimelineEvent[];
  partner: PartnerInfo;
};

const STAGE_KEYS: StatusKey[] = ["unpaid", "paid", "confirmed_branch"];

function computeStageIndex(order: { status?: string; paymentStatus?: string }): number {
  const s = (order.status || "").toLowerCase();
  const p = (order.paymentStatus || "").toLowerCase();
  if (["confirmed", "in_progress", "processing", "completed", "delivered", "done"].includes(s)) return 2;
  if (["paid", "deposit_paid"].includes(p)) return 1;
  return 0;
}

type Method = "email" | "phone";

function TrackPage() {
  const { t, lang, dir } = useLang();
  const [method, setMethod] = useState<Method>("phone");
  const [contact, setContact] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [notFound, setNotFound] = useState(false);

  const paymentStatusLabel = (s?: string) => {
    const v = (s || "").toLowerCase();
    if (v === "paid") return "مدفوع بالكامل";
    if (v === "deposit_paid") return "عربون مدفوع — الباقي في المركز";
    if (v === "unpaid") return "غير مدفوع";
    if (v === "refunded") return "مسترجع";
    return s || "—";
  };
  const paymentMethodLabel = (s?: string) => {
    const v = (s || "").toLowerCase();
    if (v === "mada") return "مدى";
    if (v === "visa") return "فيزا";
    if (v === "mastercard") return "ماستر كارد";
    if (v === "applepay") return "Apple Pay";
    if (v === "stcpay") return "STC Pay";
    if (v === "mayfatoorah") return "ماي فاتورة";
    if (v === "cod") return "الدفع في المركز";
    if (v === "card") return "بطاقة";
    if (v === "bank") return "تحويل بنكي";
    return s || "—";
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contact.trim() || !orderNumber.trim()) {
      toast.error(method === "email" ? t("track.err.fillEmail") : t("track.err.fillPhone"));
      return;
    }
    setLoading(true);
    setNotFound(false);
    setResult(null);
    try {
      const res: any = await publicApi.lookupOrder({
        orderNumber: orderNumber.trim(),
        email: method === "email" ? contact.trim() : undefined,
        phone: method === "phone" ? contact.trim() : undefined,
      });
      const data: any = res?.data ?? res ?? {};
      const o: any = data.order ?? data;
      if (!o || (!o.number && !o.order_number && !o.id)) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const items: any[] = data.items ?? o.items ?? [];
      const timeline: any[] = data.timeline ?? o.timeline ?? [];
      const p: any = data.partner ?? o.partner ?? null;
      const mapped: Result = {
        order: {
          number: String(o.number ?? o.order_number ?? o.id ?? ""),
          status: String(o.status ?? ""),
          paymentStatus: o.paymentStatus ?? o.payment_status,
          paymentMethod: o.paymentMethod ?? o.payment_method,
          subtotal: Number(o.subtotal ?? 0),
          vat: Number(o.vat ?? 0),
          total: Number(o.total ?? 0),
          depositPaid: Number(o.depositPaid ?? o.deposit_paid ?? 0),
          remaining: Number(o.remaining ?? o.remaining_amount ?? 0),
          verificationCode: o.verificationCode ?? o.verification_code ?? undefined,
          qrData: o.qrData ?? o.qr_data ?? undefined,
          couponDiscount: Number(o.couponDiscount ?? o.coupon_discount ?? 0),
          currency: o.currency ?? "SAR",
          notes: o.notes ?? undefined,
          createdAt: o.createdAt ?? o.created_at ?? undefined,
          updatedAt: o.updatedAt ?? o.updated_at ?? undefined,
          confirmedAt: o.confirmedAt ?? o.confirmed_at ?? undefined,
        },
        items: items.map((it: any) => ({
          title: String(it.title ?? it.offer_title ?? it.service_title ?? ""),
          planName: it.planName ?? it.plan_name ?? it.booking_label ?? null,
          qty: Number(it.qty ?? 1),
          price: Number(it.price ?? 0),
          originalPrice: it.originalPrice ?? it.original_price ?? null,
        })),
        timeline: timeline.map((ev: any) => ({
          status: ev.status,
          label: ev.label,
          note: ev.note,
          at: ev.at ?? ev.created_at,
        })),
        partner: p
          ? {
              name: String(p.name ?? p.title ?? ""),
              address: String(p.address ?? p.city ?? ""),
              phone: String(p.phone ?? p.mobile ?? ""),
              mapsUrl: p.mapsUrl ?? p.maps_url ?? null,
            }
          : { name: "", address: "", phone: "", mapsUrl: null },
      };
      setResult(mapped);
    } catch (err: any) {
      const status = err?.status;
      if (status === 404 || status === 403) {
        setNotFound(true);
      } else {
        toast.error(err?.message || (lang === "ar" ? "تعذّر جلب بيانات الحجز" : "Could not fetch booking"));
      }
    } finally {
      setLoading(false);
    }
  }

  const currentIndex = result ? computeStageIndex(result.order) : -1;
  const currency = result?.order.currency || "SAR";
  const locale = lang === "ar" ? "ar-SA" : "en-US";
  const textEnd = dir === "rtl" ? "text-end" : "text-start";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-[#3F2A6B] via-[#5b3a8a] to-[#E0254D] py-16 sm:py-20">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.18), transparent 45%)" }} />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> {t("track.kicker")}
            </span>
            <h1 className="mt-4 text-4xl font-extrabold text-white sm:text-5xl">{t("track.title")}</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-white/85 sm:text-base">
              {t("track.subtitle")}
            </p>
          </div>
        </section>

        {/* Search card */}
        <section className="relative z-10 mx-auto -mt-10 max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-border bg-white p-6 pt-8 shadow-xl sm:p-8 sm:pt-10">
            {/* Method tabs */}
            <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-full border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => { setMethod("phone"); setContact(""); }}
                className={["inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition",
                  method === "phone" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"].join(" ")}
              >
                <Phone className="h-4 w-4" /> {t("track.tab.phone")}
              </button>
              <button
                type="button"
                onClick={() => { setMethod("email"); setContact(""); }}
                className={["inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition",
                  method === "email" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"].join(" ")}
              >
                <Mail className="h-4 w-4" /> {t("track.tab.email")}
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={onSubmit}
              className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-2"
            >
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-muted-foreground">
                  {method === "email" ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                </span>
                <input
                  type={method === "email" ? "email" : "tel"}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={method === "email" ? t("track.placeholder.email") : t("track.placeholder.phone")}
                  className={`h-12 w-full rounded-full border border-border bg-background ps-5 pe-11 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${textEnd}`}
                />
              </div>
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder={t("track.placeholder.order")}
                  className={`h-12 w-full rounded-full border border-border bg-background ps-5 pe-11 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${textEnd}`}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-[0_10px_24px_-10px_rgba(63,42,107,0.5)] transition hover:bg-primary-dark disabled:opacity-60"
              >
                <Search className="h-4 w-4" />
                {loading ? t("track.submitting") : t("track.submit")}
              </button>
            </form>

            {/* Trust badges */}
            <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-3">
              {[
                { icon: <ShieldCheck className="h-4 w-4" />, text: t("track.trust.secure") },
                { icon: <Clock className="h-4 w-4" />, text: t("track.trust.fast") },
                { icon: <Sparkles className="h-4 w-4" />, text: t("track.trust.live") },
              ].map((b, i) => (
                <div key={i} className="flex items-center justify-center gap-2 rounded-2xl bg-muted/40 px-3 py-2.5 text-xs font-bold text-foreground">
                  <span className="text-primary">{b.icon}</span>
                  {b.text}
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* Results */}
        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          {notFound && (
            <p className="mx-auto max-w-3xl rounded-2xl border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              {method === "email" ? t("track.notFound.email") : t("track.notFound.phone")}
            </p>
          )}

          {result && (
            <div className="space-y-6">
              {/* Header card */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-white p-6 sm:p-8">
                <div className={textEnd}>
                  <div className="text-xs font-medium text-muted-foreground">{t("track.orderNumber")}</div>
                  <div className="mt-1 text-lg font-extrabold text-foreground" dir="ltr">{result.order.number}</div>
                </div>
                <div className={textEnd}>
                  <div className="text-xs font-medium text-muted-foreground">{t("track.createdAt")}</div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {result.order.createdAt
                      ? new Date(result.order.createdAt.replace(" ", "T")).toLocaleString(locale)
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="rounded-3xl border border-border bg-white p-6 sm:p-8">
                <h2 className={`mb-8 ${textEnd} text-xl font-extrabold text-foreground`}>{t("track.statusTitle")}</h2>
              <Timeline currentIndex={currentIndex} dir={dir} t={t} timeline={result.timeline} locale={locale} />
              </div>

              {/* Info cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoCard icon={<CreditCard className="h-5 w-5" />} label={t("track.payStatus")} value={paymentStatusLabel(result.order.paymentStatus)} textEnd={textEnd} />
                <InfoCard icon={<Receipt className="h-5 w-5" />} label={t("track.payMethod")} value={paymentMethodLabel(result.order.paymentMethod)} textEnd={textEnd} />
                <InfoCard icon={<Tag className="h-5 w-5" />} label={t("track.total")} value={`${result.order.total ?? 0} ${currency}`} textEnd={textEnd} />
                <InfoCard icon={<Calendar className="h-5 w-5" />} label={t("track.lastUpdate")} value={result.order.updatedAt ? new Date(result.order.updatedAt.replace(" ", "T")).toLocaleString(locale) : "—"} textEnd={textEnd} />
              </div>

              {/* Deposit & QR — shown when deposit_paid */}
              {result.order.paymentStatus?.toLowerCase() === "deposit_paid" && (
                <div className="rounded-3xl border border-border bg-white p-6 sm:p-8">
                  <h2 className={`mb-6 ${textEnd} text-xl font-extrabold text-foreground`}>تفاصيل الدفع</h2>
                  <div className="grid gap-6 sm:grid-cols-2">
                    {/* QR + Verification */}
                    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-muted/30 p-5">
                      <div className="text-sm font-bold text-foreground">امسح QR للتحقق</div>
                      <div className="rounded-xl bg-white p-2 shadow-sm">
                        <QRCodeSVG value={result.order.qrData || result.order.number} size={160} level="M" />
                      </div>
                      {result.order.verificationCode && (
                        <div className={`w-full rounded-xl bg-primary/10 p-3 text-center ${textEnd}`}>
                          <div className="text-xs text-muted-foreground">كود التحقق</div>
                          <div className="mt-1 text-2xl font-extrabold tracking-widest text-primary" dir="ltr">{result.order.verificationCode}</div>
                        </div>
                      )}
                    </div>
                    {/* Amounts */}
                    <div className="flex flex-col justify-center gap-4">
                      <div className={`rounded-2xl border border-border bg-muted/30 p-5 ${textEnd}`}>
                        <div className="text-xs text-muted-foreground">العربون المدفوع أونلاين</div>
                        <div className="mt-1 text-2xl font-extrabold text-primary">{result.order.depositPaid ?? 0} {currency}</div>
                      </div>
                      <div className={`rounded-2xl border border-border bg-muted/30 p-5 ${textEnd}`}>
                        <div className="text-xs text-muted-foreground">المتبقي (يُدفع في المركز)</div>
                        <div className="mt-1 text-2xl font-extrabold text-foreground">{result.order.remaining ?? 0} {currency}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Items */}
              {result.items.length > 0 && (
                <div className="rounded-3xl border border-border bg-white p-6 sm:p-8">
                  <h2 className={`mb-6 ${textEnd} text-xl font-extrabold text-foreground`}>{t("track.itemsTitle")}</h2>
                  <div className="space-y-3">
                    {result.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                          <span className="text-muted-foreground">×{it.qty}</span>
                          <span>{it.price} {currency}</span>
                        </div>
                        <div className={`flex-1 ${textEnd}`}>
                          <div className="text-sm font-bold text-foreground">{it.title}</div>
                          {it.planName && <div className="mt-0.5 text-xs text-muted-foreground">{it.planName}</div>}
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                          <FolderOpen className="h-4 w-4" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-6 space-y-2 rounded-2xl bg-muted/40 p-4 text-sm">
                    <Row label={t("track.subtotal")} value={`${result.order.subtotal ?? 0} ${currency}`} />
                    {!!result.order.couponDiscount && (
                      <Row label={t("track.couponDiscount")} value={`- ${result.order.couponDiscount} ${currency}`} />
                    )}
                    <div className="my-2 h-px bg-border" />
                    <Row label={t("track.total")} value={`${result.order.total ?? 0} ${currency}`} bold />
                    <p className="text-[11px] text-muted-foreground text-end">السعر شامل ضريبة القيمة المضافة</p>
                  </div>
                </div>
              )}

              {/* Partner / Center info */}
              {result.partner && (
                <div className="rounded-3xl border border-border bg-white p-6 sm:p-8">
                  <h2 className={`mb-6 ${textEnd} text-xl font-extrabold text-foreground`}>بيانات المركز</h2>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Store className="h-6 w-6" />
                    </div>
                    <div className={`flex-1 ${textEnd}`}>
                      <div className="text-base font-extrabold text-foreground">{result.partner.name}</div>
                      <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{result.partner.address}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground" dir="ltr">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{result.partner.phone}</span>
                      </div>
                      {result.partner.mapsUrl && (
                        <a
                          href={result.partner.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition hover:bg-primary/20"
                        >
                          <MapPin className="h-3 w-3" />
                          فتح الموقع على الخريطة
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline events (if any) */}
              {result.timeline.length > 0 && (
                <div className="rounded-3xl border border-border bg-white p-6 sm:p-8">
                  <h2 className={`mb-6 ${textEnd} text-xl font-extrabold text-foreground`}>{t("track.logTitle")}</h2>
                  <ul className="space-y-3">
                    {result.timeline.map((ev, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-background p-4">
                        <div className="text-xs text-muted-foreground">
                          {ev.at || ev.created_at ? new Date((ev.at || ev.created_at)!.replace(" ", "T")).toLocaleString(locale) : ""}
                        </div>
                        <div className={`flex-1 ${textEnd}`}>
                          <div className="text-sm font-bold text-foreground">{ev.label || ev.status || t("track.update")}</div>
                          {ev.note && <div className="mt-1 text-xs text-muted-foreground">{ev.note}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Featured offers below */}
        <FeaturedOffers />

      </main>
      <SiteFooter />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "text-base font-extrabold text-foreground" : "text-muted-foreground"}>{value}</span>
      <span className={bold ? "text-base font-extrabold text-foreground" : "text-foreground"}>{label}</span>
    </div>
  );
}

function Timeline({ currentIndex, dir, t, timeline, locale }: { currentIndex: number; dir: "rtl" | "ltr"; t: (k: TKey) => string; timeline: TimelineEvent[]; locale: string }) {
  const ordered = dir === "rtl" ? [...STAGE_KEYS].reverse() : [...STAGE_KEYS];

  const stageToStatus: Record<StatusKey, string> = {
    unpaid: "pending",
    paid: "deposit_paid",
    confirmed_branch: "confirmed",
  };

  const formatDate = (at?: string) => {
    if (!at) return "";
    try {
      return new Date(at.replace(" ", "T")).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return at;
    }
  };

  return (
    <div className="flex items-start justify-between gap-2" dir={dir}>
      {ordered.map((stage, i) => {
        const logicalIndex = STAGE_KEYS.findIndex((s) => s === stage);
        const reached = currentIndex >= 0 && logicalIndex <= currentIndex;
        const isCurrent = logicalIndex === currentIndex;
        const isNotLast = i < ordered.length - 1;
        const nextLogical = STAGE_KEYS.findIndex((s) => s === ordered[i + 1]);
        const lineActive = currentIndex >= 0 && nextLogical >= 0 && nextLogical <= currentIndex;
        const eventDate = reached
          ? timeline.find((ev) => (ev.status || "").toLowerCase() === stageToStatus[stage])?.at
          : undefined;
        return (
          <div key={stage} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div className="flex flex-1 justify-center">
                <div
                  className={[
                    "flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold transition",
                    reached ? "bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_rgba(0,174,198,0.6)]" : "bg-muted text-muted-foreground",
                    isCurrent ? "ring-2 ring-primary ring-offset-2 ring-offset-white" : "",
                  ].join(" ")}
                >
                  {reached && !isCurrent ? <Check className="h-5 w-5" strokeWidth={3} /> : logicalIndex + 1}
                </div>
              </div>
              {isNotLast && (
                <div className={["h-[2px] flex-1 rounded-full", lineActive ? "bg-primary" : "bg-border"].join(" ")} />
              )}
            </div>
            <div className={["mt-3 text-center text-xs font-semibold sm:text-sm", reached ? "text-foreground" : "text-muted-foreground"].join(" ")}>
              {STAGE_LABELS_AR[stage]}
            </div>
            {reached && eventDate && (
              <div className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                {formatDate(eventDate)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InfoCard({ icon, label, value, textEnd }: { icon: React.ReactNode; label: string; value: string; textEnd: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
        {icon}
      </div>
      <div className={`flex-1 ${textEnd}`}>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-base font-bold text-foreground">{value}</div>
      </div>
    </div>
  );
}

function TrustBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl bg-muted/40 px-3 py-2.5 text-xs font-bold text-foreground">
      <span className="text-primary">{icon}</span>
      {text}
    </div>
  );
}
