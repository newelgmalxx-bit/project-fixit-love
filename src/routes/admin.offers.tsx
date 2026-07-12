import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { adminPartnersApi, partnerLabel, type AdminPartner } from "@/lib/api/adminPartners";
import { PartnerSelect } from "@/components/admin/PartnerSelect";
import { adminBranchesApi } from "@/lib/api/adminBranches";
import type { Branch } from "@/lib/api/types";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/admin/offers")({
  head: () => ({ meta: [{ title: "العروض | الإدارة" }] }),
  component: OffersPage,
});

function OffersPage() {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);

  const STATUS_LABEL: Record<OfferStatus, string> = {
    draft: L("مسودة", "Draft"),
    active: L("منشور", "Active"),
    paused: L("موقوف", "Paused"),
    archived: L("مؤرشف", "Archived"),
    expired: L("منتهي", "Expired"),
  };
  const STATUS_TONE: Record<OfferStatus, "amber" | "emerald" | "rose" | "violet"> = {
    draft: "amber",
    active: "emerald",
    paused: "rose",
    archived: "violet",
    expired: "rose",
  };

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
  const [partnersById, setPartnersById] = useState<Record<string, AdminPartner>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const loadSeq = useRef(0);

  const partnerDisplay = (o: AdminOffer, partners = partnersById) => {
    const p: any = o.partner || partners[o.partnerId];
    if (!p) return undefined;
    const center = (lang === "en"
      ? (p.vendorNameEn || p.vendor_name_en || p.nameEn || p.vendorName || p.vendor_name || p.vendorNameAr || p.nameAr || p.name)
      : (p.vendorName || p.vendor_name || p.vendorNameAr || p.nameAr || p.name)) || partnerLabel(p);
    const owner = p.ownerName || p.owner_name || p.contactName || p.userName;
    const city = p.city ? ` · ${p.city}` : "";
    return owner ? `${center} — ${owner}${city}` : `${center}${city}`;
  };

  const categoryName = (o: AdminOffer) => {
    const cat = o.category || categories.find((c) => String(c.id) === String(o.categoryId));
    if (!cat) return "";
    return lang === "en" ? ((cat as any).nameEn || cat.nameAr || "") : (cat.nameAr || (cat as any).nameEn || "");
  };

  const offerTitle = (o: AdminOffer) => (lang === "en" ? (o.titleEn || o.title) : (o.title || o.titleEn || ""));
  const offerDesc = (o: AdminOffer) => (lang === "en" ? (o.descriptionEn || o.description) : (o.description || o.descriptionEn || ""));

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
    if (!confirm(L(`حذف ${selected.size} عرض نهائياً؟ لا يمكن التراجع.`, `Permanently delete ${selected.size} offers? This cannot be undone.`))) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(ids.map((id) => adminOffersApi.remove(id, true)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setBulkBusy(false);
    setSelected(new Set());
    if (failed) toast.error(L(`فشل حذف ${failed} من ${ids.length}`, `Failed to delete ${failed} of ${ids.length}`));
    else toast.success(L(`تم حذف ${ids.length} عرض نهائياً`, `Permanently deleted ${ids.length} offers`));
    load();
  }


  async function load(p = page) {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const search = q.trim().toLowerCase();
      const needsClientFilter = !!(search || status || categoryId);
      const data = await adminOffersApi.list({
        page: needsClientFilter ? 1 : p,
        limit: needsClientFilter ? 500 : 20,
        status: needsClientFilter ? undefined : status || undefined,
        category: needsClientFilter ? undefined : categoryId || undefined,
      });
      const partnerSeed: Record<string, AdminPartner> = { ...partnersById };
      for (const offer of data.items || []) {
        if (offer.partnerId && offer.partner) partnerSeed[offer.partnerId] = offer.partner as any;
      }
      const missingPartnerIds = Array.from(new Set((data.items || []).map((o) => o.partnerId).filter(Boolean)))
        .filter((id) => !partnerSeed[id]);
      const fetchedPartners = await Promise.all(missingPartnerIds.map(async (id) => {
        try { return [id, await adminPartnersApi.get(id)] as const; }
        catch { return [id, null] as const; }
      }));
      for (const [id, partner] of fetchedPartners) if (partner) partnerSeed[id] = partner;
      if (seq !== loadSeq.current) return;
      setPartnersById(partnerSeed);

      const filtered = (data.items || []).filter((offer) => {
        if (status && offer.status !== status) return false;
        if (categoryId && String(offer.categoryId) !== String(categoryId)) return false;
        if (!search) return true;
        const haystack = [
          offer.title,
          offer.titleEn,
          offer.description,
          offer.descriptionEn,
          categoryName(offer),
          partnerDisplay(offer, partnerSeed),
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(search);
      });
      const pageSize = needsClientFilter ? 20 : (data.pageSize || 20);
      const visible = needsClientFilter ? filtered.slice((p - 1) * pageSize, p * pageSize) : filtered;
      setSelected(new Set());
      setItems(visible);
      setTotalPages(needsClientFilter ? Math.max(1, Math.ceil(filtered.length / pageSize)) : (data.totalPages || 1));
      setTotal(needsClientFilter ? filtered.length : (data.total || filtered.length));
      setPage(p);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      toast.error(e?.message || L("تعذّر تحميل العروض", "Failed to load offers"));
      setItems([]);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const data = await adminCategoriesApi.list();
      setCategories(data.items || []);
    } catch { /* silent */ }
  }

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => {
    const t = setTimeout(() => { load(1); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, status, categoryId]);

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
      toast.success(L("تم تحديث الحالة", "Status updated"));
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل التحديث", "Update failed"));
    }
  }

  async function remove(o: AdminOffer) {
    if (!confirm(L(`حذف العرض "${offerTitle(o)}" نهائياً؟ لا يمكن التراجع.`, `Permanently delete offer "${offerTitle(o)}"? This cannot be undone.`))) return;
    try {
      await adminOffersApi.remove(o.id, true);
      toast.success(L("تم حذف العرض نهائياً", "Offer permanently deleted"));
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل الحذف", "Delete failed"));
    }
  }

  const currency = L("ر.س", "SAR");

  return (
    <AdminLayout
      title={L("العروض", "Offers")}
      subtitle={L(`${total} عرض إجمالي`, `${total} offers total`)}
      action={
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              disabled={bulkBusy}
              onClick={bulkArchive}
              className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {L(`حذف المحدد (${selected.size})`, `Delete selected (${selected.size})`)}
            </button>
          )}
          <PrimaryButton onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4" /> {L("عرض جديد", "New offer")}
          </PrimaryButton>
        </div>
      }
    >
      <PanelCard title="" className="mb-4">
        <div className="flex flex-wrap items-center gap-3" dir={dir}>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(1)}
              placeholder={L("بحث باسم العرض أو المركز أو التصنيف...", "Search by offer title, vendor, or category...")}
              className="w-full rounded-xl border border-border bg-background ps-9 pe-3 py-2 text-sm"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="">{L("كل الحالات", "All statuses")}</option>
            <option value="draft">{L("مسودة", "Draft")}</option>
            <option value="active">{L("منشور", "Active")}</option>
            <option value="paused">{L("موقوف", "Paused")}</option>
            <option value="expired">{L("منتهي", "Expired")}</option>
            <option value="archived">{L("مؤرشف", "Archived")}</option>
          </select>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="">{L("كل التصنيفات", "All categories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{lang === "en" ? ((c as any).nameEn || c.nameAr) : c.nameAr}</option>
            ))}
          </select>
        </div>
      </PanelCard>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <PanelCard title=""><div className="py-12 text-center text-sm text-muted-foreground">{L("لا توجد عروض.", "No offers.")}</div></PanelCard>
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
              {selected.size === items.length ? L("إلغاء تحديد الكل", "Deselect all") : L("تحديد كل العروض الظاهرة", "Select all visible offers")}
            </label>
            {selected.size > 0 && (
              <span className="text-muted-foreground">{L(`${selected.size} محدد`, `${selected.size} selected`)}</span>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((o) => (
              <PanelCard
                key={o.id}
                title={offerTitle(o)}
                subtitle={partnerDisplay(o)}
                action={
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggleOne(o.id)}
                      className="h-4 w-4 accent-primary"
                      aria-label={L("تحديد العرض", "Select offer")}
                    />
                    <Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill>
                  </div>
                }
              >
                <div className="flex gap-3">
                  {o.image && (
                    <img src={o.image} alt={offerTitle(o)} className="h-24 w-24 rounded-xl object-cover border border-border" />
                  )}
                  <div className="flex-1 space-y-1 text-sm">
                    {categoryName(o) && <div className="text-xs text-muted-foreground">{L("التصنيف:", "Category:")} {categoryName(o)}</div>}
                    <div className="font-extrabold text-primary">
                      {o.priceAfter} {currency}
                      {o.priceBefore && o.priceBefore > o.priceAfter && (
                        <span className="ms-2 text-xs text-muted-foreground line-through">{o.priceBefore} {currency}</span>
                      )}
                      {o.discountPercent ? (
                        <span className="ms-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          -{o.discountPercent}%
                        </span>
                      ) : null}
                    </div>
                    {offerDesc(o) && <p className="text-xs text-muted-foreground line-clamp-2">{offerDesc(o)}</p>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/30 p-3 text-[11px] sm:grid-cols-3">
                  <div><span className="text-muted-foreground">{L("المدة:", "Duration:")} </span><span className="font-bold">{o.durationMinutes ? L(`${o.durationMinutes} د`, `${o.durationMinutes} min`) : "—"}</span></div>
                  <div><span className="text-muted-foreground">{L("معرض الصور:", "Gallery:")} </span><span className="font-bold">{(o.gallery?.length ?? 0)}</span></div>
                  <div><span className="text-muted-foreground">{L("مميز:", "Featured:")} </span><span className="font-bold">{o.isFeatured ? L("نعم", "Yes") : L("لا", "No")}</span></div>
                  {(() => {
                    const ag = partnerAgreements[o.partnerId];
                    const dep = ag?.depositPct;
                    return (
                      <div><span className="text-muted-foreground">{L("نسبة المنصة:", "Platform fee:")} </span><span className="font-bold">{dep != null ? `${dep}%` : "—"}</span></div>
                    );
                  })()}
                  <div><span className="text-muted-foreground">{L("الشروط:", "Terms:")} </span><span className="font-bold">{o.terms?.length ?? 0}</span></div>
                  <div><span className="text-muted-foreground">{L("نقاط نظرة عامة:", "Overview bullets:")} </span><span className="font-bold">{o.overviewBullets?.length ?? 0}</span></div>
                  <div><span className="text-muted-foreground">{L("آخر تحديث:", "Updated:")} </span><span className="font-bold">{o.updatedAt ? new Date(o.updatedAt).toLocaleDateString(lang === "en" ? "en" : "ar") : "—"}</span></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["active", "paused", "draft"] as OfferStatus[]).filter((s) => s !== o.status).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusOf(o, s)}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold hover:bg-muted"
                    >
                      {s === "active" ? L("نشر", "Publish") : s === "paused" ? L("إيقاف", "Pause") : L("إعادة لمسودة", "Move to draft")}
                    </button>
                  ))}
                  <a href={`/offers/${o.id}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold hover:bg-muted">
                    <Eye className="h-4 w-4" /> {L("عرض التفاصيل", "View details")}
                  </a>
                  <button onClick={() => setEditing(o)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold hover:bg-muted">
                    <Pencil className="h-4 w-4" /> {L("تعديل", "Edit")}
                  </button>

                  <button onClick={() => remove(o)}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" /> {L("حذف", "Delete")}
                  </button>
                </div>
              </PanelCard>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <button disabled={page <= 1 || loading} onClick={() => load(page - 1)}
              className="rounded-full border border-border bg-card p-2 disabled:opacity-40">
              {dir === "rtl" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <span className="text-sm font-bold">{page} / {totalPages}</span>
            <button disabled={page >= totalPages || loading} onClick={() => load(page + 1)}
              className="rounded-full border border-border bg-card p-2 disabled:opacity-40">
              {dir === "rtl" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);

  const [form, setForm] = useState<AdminOfferInput>(() => ({
    partnerId: offer?.partnerId || "",
    branchId: offer?.branchId ?? null,
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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  useEffect(() => {
    const pid = form.partnerId;
    if (!pid) { setBranches([]); return; }
    let cancel = false;
    setBranchesLoading(true);
    adminBranchesApi.listForPartner(pid)
      .then((d) => { if (!cancel) setBranches(d.items || []); })
      .catch(() => { if (!cancel) setBranches([]); })
      .finally(() => { if (!cancel) setBranchesLoading(false); });
    return () => { cancel = true; };
  }, [form.partnerId]);

  // When partner changes, clear branch selection if it doesn't belong to loaded branches
  useEffect(() => {
    if (!form.branchId) return;
    if (branches.length && !branches.some((b) => b.id === form.branchId)) {
      setForm((f) => ({ ...f, branchId: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches]);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error(L("أدخل عنوان العرض بالعربي", "Enter the Arabic offer title")); return; }
    if (!form.partnerId.trim()) { toast.error(L("اختر شريكًا", "Select a partner")); return; }
    if (form.priceAfter == null || Number(form.priceAfter) < 0) { toast.error(L("أدخل سعرًا صحيحًا", "Enter a valid price")); return; }
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
      toast.success(L("تم الحفظ", "Saved"));
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || L("فشل الحفظ", "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader><DialogTitle>{offer ? L("تعديل العرض", "Edit offer") : L("عرض جديد", "New offer")}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold">{L("عنوان العرض (عربي)", "Offer title (Arabic)")} <span className="text-rose-500">*</span></label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold">{L("Title (English)", "Title (English)")} <span className="text-muted-foreground">{L("— اختياري", "— optional")}</span></label>
              <input dir="ltr" value={form.titleEn ?? ""} onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold">{L("الشريك", "Partner")}</label>
            <PartnerSelect
              value={form.partnerId}
              onChange={(id) => setForm({ ...form, partnerId: id, branchId: null })}
            />
          </div>
          <div>
            <label className="text-xs font-bold">
              {L("الفرع", "Branch")}
              {branchesLoading && <span className="ms-2 text-muted-foreground">{L("جارٍ التحميل…", "Loading…")}</span>}
            </label>
            <select
              value={form.branchId ?? ""}
              onChange={(e) => setForm({ ...form, branchId: e.target.value || null })}
              disabled={!form.partnerId || branchesLoading}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="">
                {!form.partnerId
                  ? L("— اختر الشريك أولاً —", "— Select a partner first —")
                  : branches.length === 0
                  ? L("— لا توجد فروع —", "— No branches —")
                  : L("— كل الفروع —", "— All branches —")}
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {(lang === "en" ? (b.nameEn || b.nameAr) : b.nameAr) || b.address || b.id}
                  {b.isDefault ? ` · ${L("افتراضي", "Default")}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold">{L("التصنيف", "Category")}</label>
            <select value={form.categoryId ?? ""} onChange={(e) => setForm({ ...form, categoryId: e.target.value || null })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <option value="">{L("— اختر —", "— select —")}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{lang === "en" ? ((c as any).nameEn || c.nameAr) : c.nameAr}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold">{L("السعر بعد الخصم", "Price after discount")}</label>
            <input type="number" value={form.priceAfter ?? ""} onChange={(e) => setForm({ ...form, priceAfter: e.target.value === "" ? 0 : Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">{L("السعر قبل الخصم", "Price before discount")}</label>
            <input type="number" value={form.priceBefore ?? ""} onChange={(e) => setForm({ ...form, priceBefore: e.target.value === "" ? null : Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">{L("نسبة الخصم %", "Discount %")}</label>
            <input type="number" value={form.discountPercent ?? ""} onChange={(e) => setForm({ ...form, discountPercent: e.target.value === "" ? null : Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">{L("المدة (دقيقة)", "Duration (minutes)")}</label>
            <input type="number" value={form.durationMinutes ?? ""} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value === "" ? null : Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">{L("الحالة", "Status")}</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as OfferStatus })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <option value="draft">{L("مسودة", "Draft")}</option>
              <option value="active">{L("منشور", "Active")}</option>
              <option value="paused">{L("موقوف", "Paused")}</option>
              <option value="archived">{L("مؤرشف", "Archived")}</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <ImageUpload
              label={L("الصورة الرئيسية", "Main image")}
              value={form.image}
              onChange={(url) => setForm({ ...form, image: url })}
              folder="offers"
            />
          </div>
          <div className="sm:col-span-2">
            <ImageUploadMulti
              label={L("معرض الصور", "Gallery")}
              values={form.gallery || []}
              onChange={(urls) => setForm({ ...form, gallery: urls })}
              folder="offers"
              max={8}
            />
          </div>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold">{L("الوصف (عربي)", "Description (Arabic)")}</label>
              <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold">{L("Description (English)", "Description (English)")} <span className="text-muted-foreground">{L("— اختياري", "— optional")}</span></label>
              <textarea dir="ltr" value={form.descriptionEn || ""} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} rows={3}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold">{L("نقاط نظرة عامة (عربي — كل نقطة في سطر)", "Overview bullets (Arabic — one per line)")}</label>
              <textarea value={bulletsText} onChange={(e) => setBulletsText(e.target.value)} rows={4}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold">{L("Overview bullets (English — one per line)", "Overview bullets (English — one per line)")} <span className="text-muted-foreground">{L("— اختياري", "— optional")}</span></label>
              <textarea dir="ltr" value={bulletsTextEn} onChange={(e) => setBulletsTextEn(e.target.value)} rows={4}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold">{L("شروط العرض (عربي — كل شرط في سطر)", "Offer terms (Arabic — one per line)")}</label>
              <textarea value={termsText} onChange={(e) => setTermsText(e.target.value)} rows={4}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold">{L("Terms (English — one per line)", "Terms (English — one per line)")} <span className="text-muted-foreground">{L("— اختياري", "— optional")}</span></label>
              <textarea dir="ltr" value={termsTextEn} onChange={(e) => setTermsTextEn(e.target.value)} rows={4}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <DialogFooter className="sm:col-span-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-bold">{L("إلغاء", "Cancel")}</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {saving ? L("جارٍ الحفظ…", "Saving…") : L("حفظ", "Save")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
