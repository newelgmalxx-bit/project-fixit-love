import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout, PanelCard, PrimaryButton } from "@/components/admin/AdminLayout";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Loader2, Tag, Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { adminCategoriesApi, type AdminCategory } from "@/lib/api/adminContent";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({ meta: [{ title: "Categories | Admin" }] }),
  component: CategoriesPage,
});

type FormState = Partial<AdminCategory>;

const empty: FormState = {
  slug: "",
  nameAr: "",
  nameEn: "",
  icon: "",
  color: "",
  cover: "",
  descriptionAr: "",
  descriptionEn: "",
  sortOrder: 0,
  isActive: true,
};

function CategoriesPage() {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await adminCategoriesApi.list({
        inactive: includeInactive || undefined,
        q: q.trim() || undefined,
      });
      setItems(data.items || []);
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر تحميل التصنيفات", "Failed to load categories"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  function openNew() {
    setEditing(empty);
    setOpen(true);
  }
  function openEdit(c: AdminCategory) {
    setEditing(c);
    setOpen(true);
  }

  async function save() {
    if (!editing.nameAr?.trim() || !editing.nameEn?.trim() || !editing.slug?.trim()) {
      toast.error(L("الاسم العربي والإنجليزي والمعرّف مطلوبون", "Arabic name, English name and slug are required"));
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<AdminCategory> = {
        slug: editing.slug!.trim(),
        nameAr: editing.nameAr!.trim(),
        nameEn: editing.nameEn!.trim(),
        icon: editing.icon || null,
        color: editing.color || null,
        cover: editing.cover || null,
        descriptionAr: editing.descriptionAr || null,
        descriptionEn: editing.descriptionEn || null,
        sortOrder: Number(editing.sortOrder) || 0,
        isActive: editing.isActive ?? true,
      };
      if (editing.id) await adminCategoriesApi.update(editing.id, payload);
      else await adminCategoriesApi.create(payload);
      toast.success(L("تم الحفظ", "Saved"));
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل الحفظ", "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(c: AdminCategory) {
    try {
      await adminCategoriesApi.toggle(c.id);
      load();
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر التبديل", "Toggle failed"));
    }
  }

  async function remove(c: AdminCategory) {
    const name = lang === "en" ? (c.nameEn || c.nameAr) : c.nameAr;
    if (!confirm(L(`حذف "${name}"؟`, `Delete "${name}"?`))) return;
    try {
      await adminCategoriesApi.remove(c.id);
      toast.success(L("تم الحذف", "Deleted"));
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل الحذف", "Delete failed"));
    }
  }

  return (
    <AdminLayout
      title={L("التصنيفات", "Categories")}
      subtitle={`${items.length} ${L("تصنيف", items.length === 1 ? "category" : "categories")}`}
      action={
        <PrimaryButton onClick={openNew}>
          <Plus className="h-4 w-4" /> {L("تصنيف جديد", "New category")}
        </PrimaryButton>
      }
    >
      <PanelCard title="">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder={L("بحث...", "Search...")}
              className="w-full rounded-xl border border-border bg-background ps-9 pe-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            {L("إظهار غير المفعّلة", "Show inactive")}
          </label>
          <button onClick={load} className="rounded-full border border-border px-4 py-1.5 text-xs font-bold">
            {L("تحديث", "Refresh")}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{L("لا توجد تصنيفات.", "No categories.")}</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg"
                    style={{ background: c.color ? c.color + "20" : undefined }}
                  >
                    {c.cover ? (
                      <img src={c.cover} alt={c.nameAr} className="h-full w-full object-cover" />
                    ) : c.icon ? (
                      <span>{c.icon}</span>
                    ) : (
                      <Tag className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">
                      {lang === "en" ? (c.nameEn || c.nameAr) : c.nameAr}{" "}
                      <span className="text-muted-foreground">· {lang === "en" ? c.nameAr : c.nameEn}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate" dir="ltr">
                      {c.slug} {typeof c.offersCount === "number" && `· ${c.offersCount} ${L("عرض", "offers")}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggle(c)}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${c.isActive ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-border bg-muted text-muted-foreground"}`}
                  >
                    {c.isActive ? L("مفعّلة", "Active") : L("موقوفة", "Inactive")}
                  </button>
                  <button onClick={() => openEdit(c)} className="rounded-lg p-2 hover:bg-muted">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(c)} className="text-rose-600 hover:bg-rose-50 rounded-lg p-2">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader><DialogTitle>{editing.id ? L("تعديل تصنيف", "Edit category") : L("تصنيف جديد", "New category")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Field label={L("المعرّف (slug)", "Slug")}>
              <input
                dir="ltr"
                value={editing.slug || ""}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={L("الاسم (عربي)", "Name (Arabic)")}>
                <input value={editing.nameAr || ""} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label={L("الاسم (إنجليزي)", "Name (English)")}>
                <input value={editing.nameEn || ""} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={L("أيقونة (نص/إيموجي)", "Icon (text/emoji)")}>
                <input value={editing.icon || ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label={L("اللون", "Color")}>
                <input type="color" value={editing.color || "#0ea5e9"} onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  className="h-9 w-full rounded-xl border border-border bg-background px-1 py-1" />
              </Field>
            </div>
            <ImageUpload
              label={L("صورة الغلاف", "Cover image")}
              value={editing.cover}
              onChange={(url) => setEditing({ ...editing, cover: url })}
              folder="general"
            />
            <Field label={L("الوصف (عربي)", "Description (Arabic)")}>
              <textarea rows={2} value={editing.descriptionAr || ""} onChange={(e) => setEditing({ ...editing, descriptionAr: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label={L("الوصف (إنجليزي)", "Description (English)")}>
              <textarea rows={2} value={editing.descriptionEn || ""} onChange={(e) => setEditing({ ...editing, descriptionEn: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={L("الترتيب", "Sort order")}>
                <input type="number" value={editing.sortOrder ?? 0} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </Field>
              <label className="flex items-end gap-2 pb-2">
                <input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
                <span className="text-sm font-bold">{L("مفعّلة", "Active")}</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-bold">{L("إلغاء", "Cancel")}</button>
            <button onClick={save} disabled={saving} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {saving ? L("جارٍ الحفظ…", "Saving…") : L("حفظ", "Save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
