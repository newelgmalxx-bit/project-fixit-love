import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout, PanelCard, PrimaryButton } from "@/components/admin/AdminLayout";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Star, Search, ImageIcon } from "lucide-react";
import {
  adminFeaturedOffersApi, adminOffersApi,
  type FeaturedOffer, type AdminOffer,
} from "@/lib/api/adminContent";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/admin/featured-offers")({
  head: () => ({ meta: [{ title: "Featured Offers | Admin" }] }),
  component: FeaturedOffersPage,
});

function FeaturedOffersPage() {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const currency = L("ر.س", "SAR");
  const [items, setItems] = useState<FeaturedOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFeaturedOffersApi.list();
      setItems(data);
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر تحميل العروض المميزة", "Failed to load featured offers"));
    } finally {
      setLoading(false);
    }
  }

  async function loadOffers() {
    setLoadingOffers(true);
    try {
      const res = await adminOffersApi.list({ status: "active", q: q.trim() || undefined, limit: 50 });
      setOffers(res.items || []);
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر تحميل العروض", "Failed to load offers"));
    } finally {
      setLoadingOffers(false);
    }
  }

  useEffect(() => { load(); loadOffers(); }, []);

  const featuredOfferIds = useMemo(() => new Set(items.map((i) => i.offerId)), [items]);

  async function add(offerId: string) {
    setAdding(offerId);
    try {
      const sortOrder = (items[items.length - 1]?.sortOrder ?? 0) + 1;
      await adminFeaturedOffersApi.create({ offerId, sortOrder, isActive: true });
      toast.success(L("تمت الإضافة", "Added"));
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل الإضافة", "Add failed"));
    } finally {
      setAdding(null);
    }
  }

  async function remove(id: number | string) {
    if (!confirm(L("إزالة هذا العرض من المميزين؟", "Remove this offer from featured?"))) return;
    try {
      await adminFeaturedOffersApi.remove(id);
      toast.success(L("تمت الإزالة", "Removed"));
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل الإزالة", "Remove failed"));
    }
  }

  async function updateOrder(f: FeaturedOffer, sortOrder: number) {
    try {
      await adminFeaturedOffersApi.update(f.id, { sortOrder });
      load();
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر تحديث الترتيب", "Failed to update order"));
    }
  }

  return (
    <AdminLayout
      title={L("العروض المميزة", "Featured Offers")}
      subtitle={L(`${items.length} عرض مميز حاليًا`, `${items.length} featured offers currently`)}
      action={<PrimaryButton onClick={() => { load(); loadOffers(); }}>{L("تحديث", "Refresh")}</PrimaryButton>}
    >
      <PanelCard title={L("العروض المميزة الحالية", "Current featured offers")} className="mb-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{L("لا توجد عروض مميزة بعد.", "No featured offers yet.")}</div>
        ) : (
          <div className="grid gap-3">
            {items.map((f) => {
              const o = f.offer;
              return (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {o?.image ? (
                      <img src={o.image} alt={o.title} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground opacity-40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500" />
                      <div className="truncate text-sm font-bold">{o?.title || f.offerId}</div>
                    </div>
                    {o && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {o.priceAfter} {currency}
                        {o.priceBefore && o.priceBefore > o.priceAfter ? (
                          <span className="ms-2 line-through">{o.priceBefore} {currency}</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    defaultValue={f.sortOrder}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== f.sortOrder) updateOrder(f, v);
                    }}
                    className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-center"
                  />
                  <button onClick={() => remove(f.id)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </PanelCard>

      <PanelCard title={L("أضف عروضًا من القائمة النشطة", "Add offers from the active list")}>
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadOffers()}
              placeholder={L("بحث بالاسم...", "Search by name...")}
              className="w-full rounded-xl border border-border bg-background ps-9 pe-3 py-2 text-sm"
            />
          </div>
          <button onClick={loadOffers} className="rounded-xl border border-border px-4 py-2 text-sm font-bold">{L("بحث", "Search")}</button>
        </div>
        {loadingOffers ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : offers.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{L("لا توجد عروض نشطة.", "No active offers.")}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((o) => {
              const isFeatured = featuredOfferIds.has(o.id) || !!o.isFeatured;
              return (
                <div key={o.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                    {o.image ? (
                      <img src={o.image} alt={o.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8 opacity-40" />
                      </div>
                    )}
                    {o.discountPercent ? (
                      <span className="absolute top-2 start-2 rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                        -{o.discountPercent}%
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="truncate text-sm font-bold">{o.title}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {o.category?.nameAr || o.partner?.vendorName || o.titleEn || "—"}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-sm font-extrabold text-primary">{o.priceAfter} {currency}</span>
                      {o.priceBefore && o.priceBefore > o.priceAfter ? (
                        <span className="text-xs text-muted-foreground line-through">{o.priceBefore} {currency}</span>
                      ) : null}
                    </div>
                    <button
                      disabled={isFeatured || adding === o.id}
                      onClick={() => add(o.id)}
                      className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> {isFeatured ? L("مضاف بالفعل", "Already added") : adding === o.id ? "..." : L("أضف للمميزين", "Add to featured")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PanelCard>
    </AdminLayout>
  );
}
