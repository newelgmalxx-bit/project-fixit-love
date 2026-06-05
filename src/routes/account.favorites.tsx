import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Heart, ArrowLeft, Loader2 } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useLang } from "@/i18n/LanguageProvider";
import { favorites as favApi } from "@/lib/api/services";
import { toast } from "sonner";

type FavItem = {
  id: string;
  offerId: string;
  titleAr?: string | null;
  titleEn?: string | null;
  image?: string | null;
  priceAfter?: number;
  priceBefore?: number;
};

function FavoritesPage() {
  const [items, setItems] = useState<FavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { dir, t, lang } = useLang();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await favApi.list();
      const list: any[] = r?.data?.items ?? [];
      setItems(list.map((it) => ({
        id: String(it.id),
        offerId: String(it.offerId ?? it.offer_id ?? ""),
        titleAr: it.titleAr ?? it.title_ar ?? null,
        titleEn: it.titleEn ?? it.title_en ?? null,
        image: it.image ?? null,
        priceAfter: Number(it.priceAfter ?? it.price_after ?? 0),
        priceBefore: Number(it.priceBefore ?? it.price_before ?? 0),
      })));
    } catch (e: any) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const sync = () => load();
    window.addEventListener("saba:favorites", sync);
    return () => window.removeEventListener("saba:favorites", sync);
  }, [load]);

  async function handleRemove(offerId: string) {
    try {
      await favApi.remove(offerId);
      setItems((prev) => prev.filter((it) => it.offerId !== offerId));
      window.dispatchEvent(new Event("saba:favorites"));
      toast.success(t("account.favorites.removed"));
    } catch (e: any) {
      toast.error(e?.message || t("account.favorites.removeFail"));
    }
  }

  return (
    <AccountLayout title={t("account.favorites.title")} subtitle={t("account.favorites.subtitle")}>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{t("account.favorites.empty")}</p>
          <Link to="/offers" className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground">
            {t("account.favorites.browse")} <ArrowLeft className={`h-4 w-4 ${dir === "ltr" ? "rotate-180" : ""}`} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((o) => (
            <FavCard
              key={o.id}
              offerId={o.offerId}
              title={((lang === "en" ? (o.titleEn || o.titleAr) : (o.titleAr || o.titleEn)) || "") as string}
              banner={(o.image || "") as string}
              priceAfter={o.priceAfter}
              priceBefore={o.priceBefore}
              onRemove={() => handleRemove(o.offerId)}
              currency={t("account.favorites.currency")}
              viewLabel={t("account.favorites.view")}
            />
          ))}
        </div>
      )}
    </AccountLayout>
  );
}

function FavCard({
  offerId, title, banner, priceAfter, priceBefore, onRemove, currency, viewLabel,
}: {
  offerId: string; title: string; banner: string;
  priceAfter?: number; priceBefore?: number; onRemove: () => void;
  currency: string; viewLabel: string;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary/40">
        {banner ? <img src={banner} alt={title} loading="lazy" className="h-full w-full object-cover" /> : null}
        <button
          onClick={(e) => { e.preventDefault(); onRemove(); }}
          className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm"
          aria-label="favorite"
        >
          <Heart className="h-4 w-4 fill-red-500 text-red-500" />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-extrabold text-foreground line-clamp-2">{title}</h3>
        {priceAfter ? (
          <div className="mt-2 flex items-baseline gap-2" dir="ltr">
            <span className="text-lg font-black text-primary">{priceAfter} {currency}</span>
            {priceBefore && priceBefore > priceAfter ? (
              <span className="text-xs text-muted-foreground line-through">{priceBefore}</span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Link to="/offers/$offerId" params={{ offerId }} className="inline-flex h-9 items-center gap-1 rounded-full bg-primary px-4 text-[11px] font-bold text-white">
            {viewLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}

export const Route = createFileRoute("/account/favorites")({
  component: FavoritesPage,
});
