import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout, PanelCard, Pill, PrimaryButton } from "@/components/admin/AdminLayout";
import { toast } from "sonner";
import { Loader2, Trash2, Plus, Pencil, ChevronLeft, ChevronRight, Search, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageUpload, ImageUploadMulti } from "@/components/ui/ImageUpload";
import {
  adminOffersApi, adminCategoriesApi,
  type AdminOffer, type AdminOfferInput, type OfferStatus, type AdminCategory,
} from "@/lib/api/adminContent";
import { adminAgreementsApi, type ApiPartnerAgreement } from "@/lib/api/adminAgreements";
import { PartnerSelect } from "@/components/admin/PartnerSelect";

export const Route = createFileRoute("/admin/offers")({
  head: () => ({ meta: [{ title: "العروض | الإدارة" }] }),
  component: OffersPage,
});

const STATUS_LABEL: Record<OfferStatus, string> = {
  draft: "مسودة",
  active: "منشور",
  paused: "موقوف",
  archived: "مؤرشف",
  expired: "منتهي",
};
const STATUS_TONE: Record<OfferStatus, "amber" | "emerald" | "rose" | "violet"> = {
  draft: "amber",
  active: "emerald",
  paused: "rose",
  archived: "violet",
  expired: "rose",
};

function OffersPage() {
  const [items, setItems] = useState<AdminOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"" | OfferStatus>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [editing, setEditing] = useState<AdminOffer | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [partnerAgreements, setPartnerAgreements] = useState<Record<string, ApiPartnerAgreement | null>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === items.length) return new Set();
      return new Set(items.map((o) => o.id));
    });
  }
  async function bulkArchive() {
    if (!selected.size) return;
    if (!confirm(`حذف ${selected.size} عرض نهائياً؟ لا يمكن التراجع.`)) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(ids.map((id) => adminOffersApi.remove(id, true)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setBulkBusy(false);
    setSelected(new Set());
    if (failed) toast.error(`فشل حذف ${failed} من ${ids.length}`);
    else toast.success(`تم حذف ${ids.length} عرض نهائياً`);
    load();
  }


  async function load(p = page) {
    setLoading(true);
    try {
      const data = await adminOffersApi.list({
        page: p,
        limit: 20,
        status: status || undefined,
        category: categoryId || undefined,
        q: q.trim() || undefined,
      });
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setPage(data.page || p);
    } catch (e: any) {
      toast.error(e?.message || "تعذّر تحميل العروض");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const data = await adminCategoriesApi.list();
      setCategories(data.items || []);
    } catch { /* silent */ }
  }

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [status, categoryId]);

  // Live search with debounce
  useEffect(() => {
    const t = setTimeout(() => { load(1); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  // Fetch latest agreement per unique partner shown, to display current commission/deposit
  useEffect(() => {
    const ids = Array.from(new Set(items.map((o) => o.partnerId).filter(Boolean)));
    const missing = ids.filter((id) => !(id in partnerAgreements));
    if (!missing.length) return;
    let alive = true;
    (async () => {
      const entries = await Promise.all(missing.map(async (pid) => {
        try {
          const list = await adminAgreementsApi.listPartnerAgreements(pid);
          const signed = list.find((a) => a.status === "signed");
          return [pid, signed ?? list[0] ?? null] as const;
        } catch {
          return [pid, null] as const;
        }
      }));
      if (!alive) return;
      setPartnerAgreements((prev) => {
        const next = { ...prev };
        for (const [pid, ag] of entries) next[pid] = ag;
        return next;
      });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  async function setStatusOf(o: AdminOffer, s: OfferStatus) {
    try {
      await adminOffersApi.setStatus(o.id, s);
      toast.success("تم تحديث الحالة");
      load();
    } catch (e: any) {
      toast.error(e?.message || "فشل التحديث");
    }
  }

  async function remove(o: AdminOffer) {
    if (!confirm(`حذف العرض "${o.title}" نهائياً؟ لا يمكن التراجع.`)) return;
    try {
      await adminOffersApi.remove(o.id, true);
      toast.success("تم حذف العرض نهائياً");
      load();
    } catch (e: any) {
      toast.error(e?.message || "فشل الحذف");
    }
  }

  return (
    <AdminLayout
      title="العروض"
      subtitle={`${total} عرض إجمالي`}
      action={
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              disabled={bulkBusy}
              onClick={bulkArchive}
              className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              حذف المحدد ({selected.size})
            </button>
          )}
          <PrimaryButton onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4" /> عرض جديد
          </PrimaryButton>
        </div>
      }
    >
      <PanelCard title="" className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(1)}
              placeholder="بحث بالعنوان..."
              className="w-full rounded-xl border border-border bg-background ps-9 pe-3 py-2 text-sm"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="active">منشور</option>
            <option value="paused">موقوف</option>
            <option value="expired">منتهي</option>
            <option value="archived">مؤرشف</option>
          </select>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="">كل التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.nameAr}</option>
            ))}
          </select>
          <button onClick={() => load(1)} className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">
            بحث
          </button>
        </div>
      </PanelCard>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <PanelCard title=""><div className="py-12 text-center text-sm text-muted-foreground">لا توجد عروض.</div></PanelCard>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 text-xs">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 font-bold hover:bg-muted">
              <input
                type="checkbox"
                checked={selected.size > 0 && selected.size === items.length}
                ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < items.length; }}
                onChange={toggleAll}
                className="h-4 w-4 accent-primary"
              />
              {selected.size === items.length ? "إلغاء تحديد الكل" : "تحديد كل العروض الظاهرة"}
            </label>
            {selected.size > 0 && (
              <span className="text-muted-foreground">{selected.size} محدد</span>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((o) => (
              <PanelCard
                key={o.id}
                title={o.title}
                subtitle={(() => {
                  const p: any = o.partner;
                  if (!p) return undefined;
                  const owner = p.ownerName || p.owner_name || p.contactName || p.name;
                  const city = p.city ? ` · ${p.city}` : "";
                  return owner ? `${p.vendorName} — ${owner}${city}` : `${p.vendorName}${city}`;
                })()}
                action={
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggleOne(o.id)}
                      className="h-4 w-4 accent-primary"
                      aria-label="تحديد العرض"
                    />
                    <Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill>
                  </div>
                }
              >
                <div className="flex gap-3">
                  {o.image && (
                    <img src={o.image} alt={o.title} className="h-24 w-24 rounded-xl object-cover border border-border" />
                  )}
                  <div className="flex-1 space-y-1 text-sm">
                    {o.category && <div className="text-xs text-muted-foreground">التصنيف: {o.category.nameAr}</div>}
                    <div className="font-extrabold text-primary">
                      {o.priceAfter} ر.س
                      {o.priceBefore && o.priceBefore > o.priceAfter && (
                        <span className="ms-2 text-xs text-muted-foreground line-through">{o.priceBefore} ر.س</span>
                      )}
                      {o.discountPercent ? (
                        <span className="ms-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          -{o.discountPercent}%
                        </span>
                      ) : null}
                    </div>
                    {o.description && <p className="text-xs text-muted-foreground line-clamp-2">{o.description}</p>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/30 p-3 text-[11px] sm:grid-cols-3">
                  <div><span className="text-muted-foreground">المدة: </span><span className="font-bold">{o.durationMinutes ? `${o.durationMinutes} د` : "—"}</span></div>
                  <div><span className="text-muted-foreground">معرض الصور: </span><span className="font-bold">{(o.gallery?.length ?? 0)}</span></div>
                  <div><span className="text-muted-foreground">مميز: </span><span className="font-bold">{o.isFeatured ? "نعم" : "لا"}</span></div>
                  {(() => {
                    const ag = partnerAgreements[o.partnerId];
                    const dep = ag?.depositPct;
                    return (
                      <div><span className="text-muted-foreground">نسبة المنصة: </span><span className="font-bold">{dep != null ? `${dep}%` : "—"}</span></div>
                    );
                  })()}
                  <div><span className="text-muted-foreground">الشروط: </span><span className="font-bold">{o.terms?.length ?? 0}</span></div>
                  <div><span className="text-muted-foreground">نقاط نظرة عامة: </span><span className="font-bold">{o.overviewBullets?.length ?? 0}</span></div>
                  <div><span className="text-muted-foreground">آخر تحديث: </span><span className="font-bold">{o.updatedAt ? new Date(o.updatedAt).toLocaleDateString("ar") : "—"}</span></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["active", "paused", "draft"] as OfferStatus[]).filter((s) => s !== o.status).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusOf(o, s)}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold hover:bg-muted"
                    >
                      {s === "active" ? "نشر" : s === "paused" ? "إيقاف" : "إعادة لمسودة"}
                    </button>
                  ))}
                  <a href={`/offers/${o.id}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold hover:bg-muted">
                    <Eye className="h-4 w-4" /> عرض التفاصيل
                  </a>
                  <button onClick={() => setEditing(o)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold hover:bg-muted">
                    <Pencil className="h-4 w-4" /> تعديل
                  </button>

                  <button onClick={() => remove(o)}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" /> حذف
                  </button>
                </div>
              </PanelCard>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <button disabled={page <= 1 || loading} onClick={() => load(page - 1)}
              className="rounded-full border border-border bg-card p-2 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold">{page} / {totalPages}</span>
            <button disabled={page >= totalPages || loading} onClick={() => load(page + 1)}
              className="rounded-full border border-border bg-card p-2 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {(openNew || editing) && (
        <OfferDialog
          offer={editing}
          categories={categories}
          onClose={() => { setOpenNew(false); setEditing(null); }}
          onSaved={() => { setOpenNew(false); setEditing(null); load(); }}
        />
      )}
    </AdminLayout>
  );
}

function OfferDialog({
  offer, categories, onClose, onSaved,
}: {
  offer: AdminOffer | null;
  categories: AdminCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AdminOfferInput>(() => ({
    partnerId: offer?.partnerId || "",
    categoryId: offer?.categoryId ?? null,
    title: offer?.title || "",
    titleEn: offer?.titleEn || "",
    description: offer?.description || "",
    descriptionEn: offer?.descriptionEn || "",
    image: offer?.image || "",
    gallery: offer?.gallery || [],
    overviewBullets: offer?.overviewBullets || [],
    overviewBulletsEn: offer?.overviewBulletsEn || [],
    terms: offer?.terms || [],
    termsEn: offer?.termsEn || [],
    priceBefore: offer?.priceBefore ?? null,
    priceAfter: offer?.priceAfter ?? 0,
    discountPercent: offer?.discountPercent ?? null,
    durationMinutes: offer?.durationMinutes ?? null,
    status: offer?.status || "draft",
    featuredRank: offer?.featuredRank ?? null,
    commissionPctOverride: offer?.commissionPctOverride ?? null,
    startsAt: offer?.startsAt ?? null,
    endsAt: offer?.endsAt ?? null,
  }));
  const [saving, setSaving] = useState(false);
  const [termsText, setTermsText] = useState((offer?.terms || []).join("\n"));
  const [termsTextEn, setTermsTextEn] = useState((offer?.termsEn || []).join("\n"));
  const [bulletsText, setBulletsText] = useState((offer?.overviewBullets || []).join("\n"));
  const [bulletsTextEn, setBulletsTextEn] = useState((offer?.overviewBulletsEn || []).join("\n"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("أدخل عنوان العرض بالعربي"); return; }
    if (!form.partnerId.trim()) { toast.error("اختر شريكًا"); return; }
    if (form.priceAfter == null || Number(form.priceAfter) < 0) { toast.error("أدخل سعرًا صحيحًا"); return; }
    const payload: AdminOfferInput = {
      ...form,
      title: form.title.trim(),
      titleEn: form.titleEn?.trim() || null,
      description: form.description?.trim() || null,
      descriptionEn: form.descriptionEn?.trim() || null,
      terms: termsText.split("\n").map((s) => s.trim()).filter(Boolean),
      termsEn: termsTextEn.split("\n").map((s) => s.trim()).filter(Boolean),
      overviewBullets: bulletsText.split("\n").map((s) => s.trim()).filter(Boolean),
      overviewBulletsEn: bulletsTextEn.split("\n").map((s) => s.trim()).filter(Boolean),
      gallery: (form.gallery || []).filter(Boolean),
      categoryId: form.categoryId || null,
      priceAfter: Number(form.priceAfter),
      priceBefore: form.priceBefore == null || form.priceBefore === ("" as any) ? null : Number(form.priceBefore),
      discountPercent: form.discountPercent == null || form.discountPercent === ("" as any) ? null : Number(form.discountPercent),
      durationMinutes: form.durationMinutes == null || form.durationMinutes === ("" as any) ? null : Number(form.durationMinutes),
      commissionPctOverride: form.commissionPctOverride == null || form.commissionPctOverride === ("" as any) ? null : Number(form.commissionPctOverride),
    };
    setSaving(true);
    try {
      if (offer) await adminOffersApi.update(offer.id, payload);
      else await adminOffersApi.create(payload);
      toast.success("تم الحفظ");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>{offer ? "تعديل العرض" : "عرض جديد"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold">عنوان العرض (عربي) <span className="text-rose-500">*</span></label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold">Title (English) <span className="text-muted-foreground">— optional</span></label>
              <input dir="ltr" value={form.titleEn ?? ""} onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold">الشريك</label>
            <PartnerSelect
              value={form.partnerId}
              onChange={(id) => setForm({ ...form, partnerId: id })}
            />
          </div>
          <div>
            <label className="text-xs font-bold">التصنيف</label>
            <select value={form.categoryId ?? ""} onChange={(e) => setForm({ ...form, categoryId: e.target.value || null })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <option value="">— اختر —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold">السعر بعد الخصم</label>
            <input type="number" value={form.priceAfter ?? ""} onChange={(e) => setForm({ ...form, priceAfter: e.target.value === "" ? 0 : Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">السعر قبل الخصم</label>
            <input type="number" value={form.priceBefore ?? ""} onChange={(e) => setForm({ ...form, priceBefore: e.target.value === "" ? null : Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">نسبة الخصم %</label>
            <input type="number" value={form.discountPercent ?? ""} onChange={(e) => setForm({ ...form, discountPercent: e.target.value === "" ? null : Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">المدة (دقيقة)</label>
            <input type="number" value={form.durationMinutes ?? ""} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value === "" ? null : Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">الحالة</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as OfferStatus })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <option value="draft">مسودة</option>
              <option value="active">منشور</option>
              <option value="paused">موقوف</option>
              <option value="archived">مؤرشف</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <ImageUpload
              label="الصورة الرئيسية"
              value={form.image}
              onChange={(url) => setForm({ ...form, image: url })}
              folder="offers"
            />
          </div>
          <div className="sm:col-span-2">
            <ImageUploadMulti
              label="معرض الصور"
              values={form.gallery || []}
              onChange={(urls) => setForm({ ...form, gallery: urls })}
              folder="offers"
              max={8}
            />
          </div>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold">الوصف (عربي)</label>
              <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold">Description (English) <span className="text-muted-foreground">— optional</span></label>
              <textarea dir="ltr" value={form.descriptionEn || ""} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} rows={3}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold">نقاط نظرة عامة (عربي — كل نقطة في سطر)</label>
              <textarea value={bulletsText} onChange={(e) => setBulletsText(e.target.value)} rows={4}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold">Overview bullets (English — one per line) <span className="text-muted-foreground">— optional</span></label>
              <textarea dir="ltr" value={bulletsTextEn} onChange={(e) => setBulletsTextEn(e.target.value)} rows={4}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold">شروط العرض (عربي — كل شرط في سطر)</label>
              <textarea value={termsText} onChange={(e) => setTermsText(e.target.value)} rows={4}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold">Terms (English — one per line) <span className="text-muted-foreground">— optional</span></label>
              <textarea dir="ltr" value={termsTextEn} onChange={(e) => setTermsTextEn(e.target.value)} rows={4}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <DialogFooter className="sm:col-span-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-bold">إلغاء</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {saving ? "جارٍ الحفظ…" : "حفظ"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
