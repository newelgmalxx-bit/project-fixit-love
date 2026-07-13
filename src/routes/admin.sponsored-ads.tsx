import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Megaphone, ExternalLink, Loader2 } from "lucide-react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import {
  adminSponsoredAdsApi, adminOffersApi,
  type SponsoredAd, type AdminOffer,
} from "@/lib/api/adminContent";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/admin/sponsored-ads")({
  head: () => ({ meta: [{ title: "Sponsored Ads | Admin" }] }),
  component: SponsoredAdsAdmin,
});

const SLIDE_COUNT = 9;

function makeEmpty(defaultCta: string): Partial<SponsoredAd> {
  return {
    title: "",
    subtitle: "",
    image: "",
    linkUrl: "",
    ctaLabel: defaultCta,
    sortOrder: 0,
    isActive: true,
    slideIndex: 1,
    offerId: null,
    partnerId: null,
  };
}

function SponsoredAdsAdmin() {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const empty = makeEmpty(L("اعرف أكثر", "Learn more"));
  const [ads, setAds] = useState<SponsoredAd[]>([]);
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<SponsoredAd>>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [a, o] = await Promise.all([
        adminSponsoredAdsApi.list(),
        adminOffersApi.list({ limit: 500 }).then((r) => r.items).catch(() => [] as AdminOffer[]),
      ]);
      setAds(a);
      setOffers(o);
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر تحميل الإعلانات", "Failed to load ads"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(empty); setOpen(true); };
  const openEdit = (a: SponsoredAd) => { setEditing(a); setOpen(true); };

  const save = async () => {
    if (!editing.title?.trim()) { toast.error(L("العنوان مطلوب", "Title is required")); return; }
    setSaving(true);
    const payload: Partial<SponsoredAd> = {
      title: editing.title!.trim(),
      subtitle: editing.subtitle || null,
      image: editing.image || null,
      linkUrl: editing.linkUrl || null,
      ctaLabel: editing.ctaLabel || null,
      offerId: editing.offerId || null,
      partnerId: editing.partnerId || null,
      slideIndex: editing.slideIndex ? Number(editing.slideIndex) : null,
      sortOrder: Number(editing.sortOrder) || 0,
      isActive: editing.isActive ?? true,
      startsAt: editing.startsAt || null,
      endsAt: editing.endsAt || null,
    };
    try {
      if (editing.id) await adminSponsoredAdsApi.update(editing.id, payload);
      else await adminSponsoredAdsApi.create(payload);
      toast.success(L("تم الحفظ", "Saved"));
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل الحفظ", "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number | string) => {
    if (!confirm(L("حذف الإعلان نهائيًا؟", "Delete this ad permanently?"))) return;
    try {
      await adminSponsoredAdsApi.remove(id);
      toast.success(L("تم الحذف", "Deleted"));
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل الحذف", "Delete failed"));
    }
  };

  const toggle = async (a: SponsoredAd) => {
    try {
      await adminSponsoredAdsApi.update(a.id, { isActive: !a.isActive });
      load();
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر التبديل", "Toggle failed"));
    }
  };

  return (
    <AdminLayout
      title={L("الإعلانات الممولة", "Sponsored Ads")}
      subtitle={L("تظهر فوق السلايدر الرئيسي في الصفحة الرئيسية", "Shown above the main slider on the homepage")}
      action={<Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> {L("إعلان جديد", "New ad")}</Button>}
    >
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : ads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">{L("لا توجد إعلانات بعد. أضف أول إعلان ممول.", "No ads yet. Add your first sponsored ad.")}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {ads.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 sm:gap-4 rounded-2xl border border-border bg-card p-3 sm:p-4">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {a.image ? (
                    <img src={a.image} alt={a.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">{L("بدون صورة", "No image")}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1 basis-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-bold">{a.title}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${a.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {a.isActive ? L("نشط", "Active") : L("متوقف", "Paused")}
                    </span>
                    {a.slideIndex ? (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {L(`سلايد #${a.slideIndex}`, `Slide #${a.slideIndex}`)}
                      </span>
                    ) : null}
                    {a.offerId ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{L("مرتبط بعرض", "Linked to offer")}</span>
                    ) : null}
                  </div>
                  {a.subtitle && <p className="truncate text-xs text-muted-foreground">{a.subtitle}</p>}
                  {a.linkUrl && !a.offerId && (
                    <a href={a.linkUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" />{a.linkUrl}
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 ms-auto">
                  <Switch checked={a.isActive} onCheckedChange={() => toggle(a)} />
                  <Button variant="outline" size="icon" onClick={() => openEdit(a)} aria-label={L("تعديل", "Edit")}><Pencil className="h-4 w-4" /></Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => remove(a.id)}
                    aria-label={L("حذف", "Delete")}
                    className="border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader><DialogTitle>{editing.id ? L("تعديل الإعلان", "Edit ad") : L("إعلان جديد", "New ad")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>{L("العنوان *", "Title *")}</Label>
              <Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div>
              <Label>{L("الوصف", "Description")}</Label>
              <Textarea rows={2} value={editing.subtitle || ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} />
            </div>
            <ImageUpload
              label={L("صورة الإعلان", "Ad image")}
              value={editing.image}
              onChange={(url) => setEditing({ ...editing, image: url })}
              folder="general"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{L("رقم السلايدر", "Slide number")}</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editing.slideIndex ?? ""}
                  onChange={(e) => setEditing({ ...editing, slideIndex: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">{L("— كل السلايدرات —", "— All slides —")}</option>
                  {Array.from({ length: SLIDE_COUNT }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{L(`سلايد رقم ${n}`, `Slide ${n}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{L("العرض المرتبط", "Linked offer")}</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editing.offerId ?? ""}
                  onChange={(e) => setEditing({ ...editing, offerId: e.target.value || null })}
                >
                  <option value="">{L("— بدون —", "— None —")}</option>
                  {offers.map((o) => {
                    const center = o.partner?.vendorName || "";
                    return (
                      <option key={o.id} value={o.id}>
                        {o.title}{center ? ` — ${center}` : ""}
                      </option>
                    );
                  })}
                </select>
                {editing.offerId ? (() => {
                  const sel = offers.find((o) => o.id === editing.offerId);
                  return sel?.partner?.vendorName ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">{L("المركز:", "Merchant:")} {sel.partner.vendorName}</p>
                  ) : null;
                })() : null}
              </div>
            </div>
            <div>
              <Label>{L("رابط خارجي (اختياري، إذا لم تحدد عرضًا)", "External URL (optional, when no offer is selected)")}</Label>
              <Input placeholder="https://..." value={editing.linkUrl || ""} onChange={(e) => setEditing({ ...editing, linkUrl: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{L("نص الزر", "Button text")}</Label>
                <Input value={editing.ctaLabel || ""} onChange={(e) => setEditing({ ...editing, ctaLabel: e.target.value })} />
              </div>
              <div>
                <Label>{L("الترتيب داخل السلايد", "Order within slide")}</Label>
                <Input type="number" value={editing.sortOrder ?? 0} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="m-0">{L("نشط", "Active")}</Label>
              <Switch checked={editing.isActive ?? true} onCheckedChange={(v) => setEditing({ ...editing, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{L("إلغاء", "Cancel")}</Button>
            <Button onClick={save} disabled={saving}>{saving ? L("جارٍ الحفظ…", "Saving…") : L("حفظ", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
