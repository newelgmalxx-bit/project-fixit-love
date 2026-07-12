import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout, PanelCard, PrimaryButton } from "@/components/admin/AdminLayout";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Pencil, Loader2, Search, Phone, Star, ExternalLink } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PartnerSelect } from "@/components/admin/PartnerSelect";
import { adminBranchesApi, type BranchInput } from "@/lib/api/adminBranches";
import type { Branch } from "@/lib/api/types";
import { BranchHoursEditor, defaultWorkingHours, parseWorkingHours, type WorkingHour } from "@/components/branches/BranchHoursEditor";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/admin/branches")({
  head: () => ({ meta: [{ title: "Branches | Admin" }] }),
  component: BranchesPage,
});

const empty: BranchInput = {
  partnerId: null,
  nameAr: "",
  nameEn: "",
  phone: "",
  address: "",
  mapsUrl: "",
  isDefault: false,
  status: "active",
  workingHours: defaultWorkingHours(),
};

function BranchesPage() {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const [items, setItems] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BranchInput>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = partnerFilter
        ? await adminBranchesApi.listForPartner(partnerFilter)
        : await adminBranchesApi.list({ q: q.trim() || undefined });
      setItems(data.items || []);
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر تحميل الفروع", "Failed to load branches"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerFilter]);

  function openNew() {
    setEditingId(null);
    setEditing({ ...empty, partnerId: partnerFilter || null });
    setOpen(true);
  }
  function openEdit(b: Branch) {
    setEditingId(b.id);
    setEditing({
      partnerId: b.partnerId ?? null,
      nameAr: b.nameAr || "",
      nameEn: b.nameEn || "",
      phone: b.phone || "",
      address: b.address || "",
      mapsUrl: b.mapsUrl || "",
      isDefault: !!b.isDefault,
      status: b.status || "active",
      workingHours: parseWorkingHours((b as any).workingHours ?? (b as any).working_hours),
    });
    setOpen(true);
  }

  async function save() {
    if (!editing.nameAr?.trim()) {
      toast.error(L("اسم الفرع بالعربي مطلوب", "Arabic branch name is required"));
      return;
    }
    if (!editing.partnerId) {
      toast.error(L("اختر الشريك", "Select a partner"));
      return;
    }
    setSaving(true);
    try {
      const payload: BranchInput = {
        partnerId: editing.partnerId,
        nameAr: editing.nameAr!.trim(),
        nameEn: (editing.nameEn || "").trim() || null,
        phone: (editing.phone || "").trim() || null,
        address: (editing.address || "").trim() || null,
        mapsUrl: (editing.mapsUrl || "").trim() || null,
        isDefault: !!editing.isDefault,
        status: editing.status || "active",
        workingHours: editing.workingHours || defaultWorkingHours(),
      };
      if (editingId) await adminBranchesApi.update(editingId, payload);
      else await adminBranchesApi.create(payload);
      toast.success(L("تم الحفظ", "Saved"));
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل الحفظ", "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(b: Branch) {
    try {
      await adminBranchesApi.setDefault(b.id);
      toast.success(L("تم تعيين الفرع الافتراضي", "Default branch set"));
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل التحديث", "Failed"));
    }
  }

  async function remove(b: Branch) {
    const name = lang === "en" ? (b.nameEn || b.nameAr) : b.nameAr;
    if (!confirm(L(`حذف الفرع "${name}"؟`, `Delete branch "${name}"?`))) return;
    try {
      await adminBranchesApi.remove(b.id);
      toast.success(L("تم الحذف", "Deleted"));
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل الحذف", "Delete failed"));
    }
  }

  return (
    <AdminLayout
      title={L("الفروع", "Branches")}
      subtitle={L(`${items.length} فرع`, `${items.length} branch(es)`)}
      action={<PrimaryButton onClick={openNew}><Plus className="h-4 w-4" /> {L("فرع جديد", "New branch")}</PrimaryButton>}
    >
      <PanelCard title="">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder={L("بحث بالاسم أو العنوان...", "Search by name or address...")}
              className="w-full rounded-xl border border-border bg-background ps-9 pe-3 py-2 text-sm"
            />
          </div>
          <div>
            <PartnerSelect
              value={partnerFilter}
              onChange={(id) => setPartnerFilter(id)}
              placeholder={L("تصفية حسب الشريك", "Filter by partner")}
            />
          </div>
          <button onClick={load} className="rounded-full border border-border px-4 py-2 text-xs font-bold">{L("تحديث", "Refresh")}</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{L("لا توجد فروع.", "No branches.")}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((b) => (
              <div key={b.id} className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate flex items-center gap-2">
                        {lang === "en" ? (b.nameEn || b.nameAr) : b.nameAr}
                        {b.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            <Star className="h-3 w-3" /> {L("افتراضي", "Default")}
                          </span>
                        )}
                      </div>
                      {b.address && <div className="text-xs text-muted-foreground truncate">{b.address}</div>}
                      {b.phone && (
                        <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {b.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {b.mapsUrl && (
                      <a href={b.mapsUrl} target="_blank" rel="noreferrer" className="rounded-lg p-2 hover:bg-muted" title={L("الخريطة", "Map")}>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {!b.isDefault && (
                      <button onClick={() => setDefault(b)} className="rounded-lg p-2 hover:bg-muted" title={L("تعيين افتراضي", "Set default")}>
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => openEdit(b)} className="rounded-lg p-2 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(b)} className="text-rose-600 hover:bg-rose-50 rounded-lg p-2"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader><DialogTitle>{editingId ? L("تعديل فرع", "Edit branch") : L("فرع جديد", "New branch")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground">{L("الشريك", "Partner")}</label>
              <PartnerSelect
                value={editing.partnerId || ""}
                onChange={(id) => setEditing({ ...editing, partnerId: id || null })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground">{L("الاسم (عربي)", "Name (Arabic)")}</label>
                <input value={editing.nameAr || ""} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">{L("الاسم (إنجليزي)", "Name (English)")}</label>
                <input value={editing.nameEn || ""} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">{L("العنوان", "Address")}</label>
              <input value={editing.address || ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground">{L("الهاتف", "Phone")}</label>
                <input value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">{L("رابط الخريطة", "Maps URL")}</label>
                <input value={editing.mapsUrl || ""} onChange={(e) => setEditing({ ...editing, mapsUrl: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={!!editing.isDefault} onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })} />
                <span className="text-sm font-bold">{L("الفرع الافتراضي", "Default branch")}</span>
              </label>
              <div>
                <label className="text-xs font-bold text-muted-foreground">{L("الحالة", "Status")}</label>
                <select
                  value={editing.status || "active"}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="active">{L("نشط", "Active")}</option>
                  <option value="inactive">{L("موقوف", "Inactive")}</option>
                </select>
              </div>
            </div>
            <BranchHoursEditor
              value={(editing.workingHours as WorkingHour[]) || defaultWorkingHours()}
              onChange={(next) => setEditing({ ...editing, workingHours: next })}
            />
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
