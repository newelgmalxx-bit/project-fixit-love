import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, StatCard, PanelCard, Pill, PrimaryButton, GhostButton } from "@/components/admin/AdminLayout";
import { Store, CheckCircle2, Clock, XCircle, Search, Eye, Phone, Mail, MapPin, Tag, Star, Calendar, FileText, BadgeCheck, Ban, MoreHorizontal, Pencil, Loader2, KeyRound, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { adminPartnersApi, partnerLabel, type AdminPartner } from "@/lib/api/adminPartners";
import { adminCategoriesApi, type AdminCategory } from "@/lib/api/adminContent";
import { adminPartnerPackagesApi, type PartnerPackage } from "@/lib/api/partnerPackages";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/admin/merchants")({
  head: () => ({ meta: [{ title: "Merchants | Admin" }] }),
  component: MerchantsPage,
});

type Status = "active" | "pending" | "suspended" | "rejected";
type WorkingHour = { day: string; open: string; close: string; closed?: boolean };
type CategoryId = string | number;
type Merchant = {
  id: string;
  name: string;
  nameEn?: string;
  owner: string;
  category?: string;
  city: string;
  phone: string;
  email: string;
  commercialNumber: string;
  status: Status;
  rating: number;
  offers: number;
  bookings: number;
  revenue: number;
  joined: string;
  mapsUrl?: string;
  categoryIds?: CategoryId[];
  description?: string;
  descriptionEn?: string;
  terms?: string;
  termsEn?: string;
  about?: string;
  aboutEn?: string;
  workingHours?: WorkingHour[];
  password?: string;
  packageName?: string;
  packageId?: string;
};

const WEEK_DAYS: { key: string; ar: string; en: string }[] = [
  { key: "saturday", ar: "السبت", en: "Saturday" },
  { key: "sunday", ar: "الأحد", en: "Sunday" },
  { key: "monday", ar: "الاثنين", en: "Monday" },
  { key: "tuesday", ar: "الثلاثاء", en: "Tuesday" },
  { key: "wednesday", ar: "الأربعاء", en: "Wednesday" },
  { key: "thursday", ar: "الخميس", en: "Thursday" },
  { key: "friday", ar: "الجمعة", en: "Friday" },
];

function defaultWorkingHours(): WorkingHour[] {
  return WEEK_DAYS.map((d) => ({
    day: d.key,
    open: d.key === "friday" ? "00:00" : "09:00",
    close: d.key === "friday" ? "00:00" : "22:00",
    closed: d.key === "friday",
  }));
}

function parseWorkingHours(raw: any): WorkingHour[] {
  if (!raw) return defaultWorkingHours();
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length) {
      return WEEK_DAYS.map((d) => {
        const found = arr.find((x: any) => String(x?.day || "").toLowerCase() === d.key);
        if (!found) return { day: d.key, open: "09:00", close: "22:00", closed: false };
        const open = String(found.open || "09:00");
        const close = String(found.close || "22:00");
        const closed = !!found.closed || (open === "00:00" && close === "00:00");
        return { day: d.key, open, close, closed };
      });
    }
  } catch {}
  return defaultWorkingHours();
}


const STATUS_META: Record<Status, { ar: string; en: string; tone: "emerald" | "amber" | "rose" | "muted"; icon: any }> = {
  active: { ar: "نشط", en: "Active", tone: "emerald", icon: CheckCircle2 },
  pending: { ar: "قيد المراجعة", en: "Pending review", tone: "amber", icon: Clock },
  suspended: { ar: "موقوف", en: "Suspended", tone: "muted", icon: Ban },
  rejected: { ar: "مرفوض", en: "Rejected", tone: "rose", icon: XCircle },
};

function normalizeStatus(s: any): Status {
  const v = String(s || "").toLowerCase();
  if (v === "active" || v === "approved") return "active";
  if (v === "suspended" || v === "blocked") return "suspended";
  if (v === "rejected") return "rejected";
  return "pending";
}

// Only treat a category as assigned if backend explicitly marks it via
// `categoryIds` or via items in `categories` that carry a pivot/assigned flag.
// Some backends return the full master category list under `categories` —
// we must NOT treat that as "all selected".
function normalizeCategoryId(value: any): CategoryId | null {
  const raw = typeof value === "object" && value !== null
    ? value.id ?? value.categoryId ?? value.category_id ?? value.catId ?? value.cat_id ?? value.value ?? value.slug
    : value;
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const numeric = Number(text);
  return /^\d+$/.test(text) && Number.isFinite(numeric) ? numeric : text;
}

function categoryKey(value: any): string {
  const normalized = normalizeCategoryId(value);
  return normalized === null ? "" : String(normalized);
}

function pickAssignedCategoryIds(p: any, opts?: { treatPlainCategoriesAsAssigned?: boolean; masterCategories?: any[] }): CategoryId[] {
  const fromArray = (arr: any[]) => arr.map(normalizeCategoryId).filter((id: CategoryId | null): id is CategoryId => id !== null);
  const singular = normalizeCategoryId(p?.categoryId ?? p?.category_id);
  if (singular !== null) return [singular];
  if (Array.isArray(p?.categoryIds)) {
    return fromArray(p.categoryIds);
  }
  if (Array.isArray(p?.category_ids)) {
    return fromArray(p.category_ids);
  }
  if (Array.isArray(p?.partnerCategories)) {
    return fromArray(p.partnerCategories);
  }
  if (Array.isArray(p?.partner_categories)) {
    return fromArray(p.partner_categories);
  }
  if (Array.isArray(p?.categories)) {
    const assigned = p.categories.filter((c: any) =>
      c && (c.pivot || c.assigned === true || c.selected === true || c.isAssigned === true || c.partner_id != null || c.partnerId != null)
    );
    if (assigned.length) {
      return fromArray(assigned);
    }
    if (opts?.treatPlainCategoriesAsAssigned) {
      const ids = fromArray(p.categories);
      const masterKeys = new Set((opts.masterCategories || []).map(categoryKey).filter(Boolean));
      const isWholeMasterList = masterKeys.size > 0 && ids.length === masterKeys.size && ids.every((id: CategoryId) => masterKeys.has(categoryKey(id)));
      return isWholeMasterList ? [] : ids;
    }
    // Backend returned the master list with no assignment marker — treat as none.
    return [];
  }
  return [];
}

function mapPartner(p: AdminPartner): Merchant {
  return {
    id: String(p.id),
    name: (p as any).vendor_name || (p as any).vendorNameAr || (p as any).vendorNameEn || p.vendorName || p.nameAr || p.nameEn || (p as any).name || partnerLabel(p),
    owner: (p as any).ownerName || (p as any).owner_name || (p as any).contactName || "—",
    category: (p as any).categoryNameAr || (p as any).category || "—",
    city: p.city || (p as any).cityName || (p as any).addressAr || (p as any).address || "—",
    phone: p.phone || "—",
    email: p.email || "—",
    commercialNumber: (p as any).commercialNumber || (p as any).commercial_number || "—",
    status: normalizeStatus(p.status),
    rating: Number((p as any).rating ?? 0),
    offers: Number((p as any).offersCount ?? (p as any).offers_count ?? 0),
    bookings: Number((p as any).bookingsCount ?? (p as any).bookings_count ?? 0),
    revenue: Number((p as any).revenue ?? 0),
    joined: (p.createdAt || (p as any).created_at || "").slice(0, 10),
    mapsUrl: (p as any).mapsUrl || (p as any).maps_url || "",
    packageName: p.package?.name || (p as any).package_name || (p as any).packageName || "—",
    packageId: (p as any).packageId ? String((p as any).packageId) : (p as any).package_id ? String((p as any).package_id) : (p.package?.id ? String(p.package.id) : ""),
    categoryIds: pickAssignedCategoryIds(p),
  };
}

function MerchantsPage() {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const sLabel = (s: Status) => L(STATUS_META[s].ar, STATUS_META[s].en);

  const [items, setItems] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | Status>("all");
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<Merchant | null>(null);
  const [editing, setEditing] = useState<Merchant | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [packages, setPackages] = useState<PartnerPackage[]>([]);

  useEffect(() => {
    adminCategoriesApi.list().then((d) => setCategories(d.items || [])).catch(() => {});
    adminPartnerPackagesApi.list().then((items) => setPackages(items || [])).catch(() => {});
  }, []);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c: any) => m.set(categoryKey(c), c.nameAr || c.name_ar || c.name || c.nameEn || c.name_en || "—"));
    return m;
  }, [categories]);

  async function load() {
    setLoading(true);
    try {
      const res = await adminPartnersApi.list({ limit: 200 });
      const base = (res.items || []).map(mapPartner);
      setItems(base);
      // Fetch real offers + bookings counts per partner in parallel
      const enriched = await Promise.all(
        base.map(async (m) => {
          try {
            const [off, bk] = await Promise.all([
              adminPartnersApi.offers(m.id, { limit: 1 }).catch(() => ({ total: 0, items: [] as any[] })),
              adminPartnersApi.bookings(m.id, { limit: 500 }).catch(() => ({ total: 0, items: [] as any[] })),
            ]);
            const revenue = (bk.items || []).reduce((s: number, b: any) => {
              const st = String(b.status || "").toLowerCase();
              if (st === "cancelled" || st === "canceled" || st === "refunded") return s;
              const amt = Number(
                b.partnerAmount ?? b.partner_amount ?? b.partnerShare ?? b.partner_share ?? 0
              );
              return s + (isFinite(amt) ? amt : 0);
            }, 0);
            return { ...m, offers: off.total || (off.items?.length ?? 0), bookings: bk.total || (bk.items?.length ?? 0), revenue };
          } catch {
            return m;
          }
        })
      );
      setItems(enriched);
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر تحميل المراكز", "Failed to load partners"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (tab !== "all") list = list.filter((m) => m.status === tab);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((m) =>
        [m.name, m.owner, m.city, m.email, m.phone, m.commercialNumber].some((v) => String(v).toLowerCase().includes(s))
      );
    }
    return list;
  }, [items, tab, q]);

  const counts = {
    all: items.length,
    active: items.filter((m) => m.status === "active").length,
    pending: items.filter((m) => m.status === "pending").length,
    suspended: items.filter((m) => m.status === "suspended").length,
    rejected: items.filter((m) => m.status === "rejected").length,
  };

  async function setStatus(id: string, status: Status) {
    try {
      await adminPartnersApi.setStatus(id, status);
      setItems((arr) => arr.map((m) => (m.id === id ? { ...m, status } : m)));
      setViewing((v) => (v && v.id === id ? { ...v, status } : v));
      toast.success(L("تم تحديث حالة المركز", "Partner status updated"));
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر تحديث الحالة", "Failed to update status"));
    }
  }

  async function deleteCenter(m: Merchant, force = false) {
    const msg = force
      ? L(
          `حذف نهائي للمركز "${m.name}" وكل البيانات المرتبطة به (العروض، الحجوزات، المدفوعات، التصنيفات، الاتفاقيات). لا يمكن التراجع. هل أنت متأكد؟`,
          `Permanently delete partner "${m.name}" and all related data (offers, bookings, payments, categories, agreements). This cannot be undone. Are you sure?`,
        )
      : L(
          `تعليق المركز "${m.name}" (Suspend)؟ يمكنك إعادة تفعيله لاحقًا.`,
          `Suspend partner "${m.name}"? You can reactivate later.`,
        );
    if (!confirm(msg)) return;
    try {
      await adminPartnersApi.remove(m.id, { force });
      if (force) {
        setItems((arr) => arr.filter((x) => x.id !== m.id));
        setViewing((v) => (v && v.id === m.id ? null : v));
        toast.success(L("تم حذف المركز نهائيًا", "Partner permanently deleted"));
      } else {
        setItems((arr) => arr.map((x) => (x.id === m.id ? { ...x, status: "suspended" } : x)));
        toast.success(L("تم تعليق المركز", "Partner suspended"));
      }
    } catch (e: any) {
      toast.error(e?.message || (force ? L("تعذّر حذف المركز", "Failed to delete partner") : L("تعذّر تعليق المركز", "Failed to suspend partner")));
    }
  }


  async function addCenter(data: Omit<Merchant, "id" | "rating" | "offers" | "bookings" | "revenue" | "joined">) {
    try {
      const res: any = await adminPartnersApi.create({
        name: data.name,
        vendorName: data.name,
        nameAr: data.name,
        city: data.city,
        address: data.city,
        phone: data.phone,
        email: data.email,
        status: data.status,
        ...({
          ownerName: data.owner,
          commercialNumber: data.commercialNumber,
          mapsUrl: data.mapsUrl,
          description: data.description || "",
          descriptionEn: data.descriptionEn || "",
          terms: data.terms || "",
          termsEn: data.termsEn || "",
          about: data.about || "",
          aboutEn: data.aboutEn || "",
          vendorNameEn: data.nameEn || "",
          nameEn: data.nameEn || "",
          workingHours: data.workingHours || [],
          password: data.password || undefined,
          categoryIds: data.categoryIds || [],
          category_ids: data.categoryIds || [],
          packageId: data.packageId || null,
          package_id: data.packageId || null,
        } as any),
      });
      const tempPwd = res?.data?.partner?.tempPassword || res?.partner?.tempPassword;
      if (tempPwd) {
        toast.success(L(`تمت إضافة المركز — كلمة المرور المؤقتة: ${tempPwd}`, `Partner added — temporary password: ${tempPwd}`), {
          duration: 12000,
          action: { label: L("نسخ", "Copy"), onClick: () => navigator.clipboard.writeText(tempPwd) },
        });
      } else {
        toast.success(L("تمت إضافة المركز", "Partner added"));
      }
      setAddOpen(false);
      load();
    } catch (e: any) {
      const fieldMsgs: string[] = [];
      const errs = e?.errors;
      if (errs && typeof errs === "object") {
        for (const v of Object.values(errs)) {
          if (Array.isArray(v)) fieldMsgs.push(...v.map(String));
          else if (v) fieldMsgs.push(String(v));
        }
      }
      const base = e?.message || L("تعذّر إضافة المركز", "Failed to add partner");
      toast.error(fieldMsgs.length ? `${base}\n${fieldMsgs.join("\n")}` : base);
    }
  }

  async function updateCenter(id: string, data: Omit<Merchant, "id" | "rating" | "offers" | "bookings" | "revenue" | "joined">) {
    try {
      await adminPartnersApi.update(id, {
        name: data.name,
        vendorName: data.name,
        nameAr: data.name,
        city: data.city,
        address: data.city,
        phone: data.phone,
        email: data.email,
        status: data.status,
        ...({
          ownerName: data.owner,
          commercialNumber: data.commercialNumber,
          mapsUrl: data.mapsUrl,
          description: data.description || "",
          descriptionEn: data.descriptionEn || "",
          terms: data.terms || "",
          termsEn: data.termsEn || "",
          about: data.about || "",
          aboutEn: data.aboutEn || "",
          vendorNameEn: data.nameEn || "",
          nameEn: data.nameEn || "",
          workingHours: data.workingHours || [],
          ...(data.password ? { password: data.password } : {}),
          categoryIds: data.categoryIds || [],
          category_ids: data.categoryIds || [],
          packageId: data.packageId || null,
          package_id: data.packageId || null,
        } as any),
      });
      if (data.password) {
        toast.success(L(`تم تحديث المركز وكلمة المرور الجديدة: ${data.password}`, `Partner updated, new password: ${data.password}`), {
          duration: 12000,
          action: { label: L("نسخ", "Copy"), onClick: () => navigator.clipboard.writeText(data.password!) },
        });
      } else {
        toast.success(L("تم تحديث بيانات المركز", "Partner updated"));
      }
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر تحديث المركز", "Failed to update partner"));
    }
  }





  const revenueTotal = items.reduce((s, m) => s + m.revenue, 0);

  return (
    <AdminLayout
      title={L("إدارة المراكز", "Partner management")}
      subtitle={L("راجع وفعّل المراكز، تابع أداءها والتزامها بمعايير المنصة", "Review and activate partners, track performance and compliance")}
      action={
        <PrimaryButton onClick={() => setAddOpen(true)}>
          <Store className="h-4 w-4" /> {L("إضافة مركز يدوي", "Add partner manually")}
        </PrimaryButton>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={L("إجمالي المراكز", "Total partners")} value={counts.all} icon={Store} accent="primary" hint={`${counts.active} ${L("نشط", "active")}`} />
        <StatCard label={L("بانتظار المراجعة", "Pending review")} value={counts.pending} icon={Clock} accent="amber" hint={L("يحتاج إجراء", "Needs action")} />
        <StatCard label={L("مراكز موقوفة", "Suspended")} value={counts.suspended} icon={Ban} accent="rose" />
        <StatCard label={L("إجمالي الإيرادات", "Total revenue")} value={`${revenueTotal.toLocaleString()} ${L("ر.س", "SAR")}`} icon={BadgeCheck} accent="emerald" />
      </div>

      <PanelCard
        className="mt-6"
        title={L(`قائمة المراكز (${filtered.length})`, `Partners list (${filtered.length})`)}
        subtitle={L("اعتمد أو ارفض طلبات الانضمام، وعدّل حالة المراكز النشطة.", "Approve or reject join requests, and manage active partners.")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={L("ابحث باسم المركز، المالك، السجل التجاري…", "Search by partner name, owner, CR…")}
                className="h-10 w-64 rounded-xl border border-border bg-background pe-9 ps-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <button onClick={load} className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-muted">{L("تحديث", "Refresh")}</button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { v: "all", l: L("الكل", "All"), c: counts.all },
            { v: "pending", l: L("قيد المراجعة", "Pending"), c: counts.pending },
            { v: "active", l: L("نشط", "Active"), c: counts.active },
            { v: "suspended", l: L("موقوف", "Suspended"), c: counts.suspended },
            { v: "rejected", l: L("مرفوض", "Rejected"), c: counts.rejected },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setTab(o.v as typeof tab)}
              className={[
                "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition",
                tab === o.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {o.l} <span className="opacity-70">({o.c})</span>
            </button>
          ))}
        </div>


        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-xs font-bold text-muted-foreground">
              <tr>
                <th className="p-3 text-start">{L("المركز", "Partner")}</th>
                <th className="p-3 text-start">{L("التواصل", "Email")}</th>
                <th className="p-3 text-start">{L("رقم التواصل", "Phone")}</th>
                <th className="p-3 text-start">{L("التصنيف · المدينة", "Category · City")}</th>
                <th className="p-3 text-start">{L("الباقة", "Package")}</th>
                <th className="p-3 text-start">{L("العروض", "Offers")}</th>
                <th className="p-3 text-start">{L("الحجوزات", "Bookings")}</th>
                <th className="p-3 text-start">{L("الإيراد", "Revenue")}</th>
                <th className="p-3 text-start">{L("التقييم", "Rating")}</th>
                <th className="p-3 text-start">{L("الحالة", "Status")}</th>
                <th className="p-3 text-end">{L("إجراءات", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const s = STATUS_META[m.status];
                return (
                  <tr key={m.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3F2A6B] to-[#E0254D] text-sm font-extrabold text-white">
                          {(m.name || "?").charAt(0)}
                        </div>
                        <div>
                          <div className="font-extrabold text-foreground">{m.name}</div>
                          <div className="text-xs text-muted-foreground">{m.owner}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm font-bold text-foreground" dir="ltr">{m.email}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm font-bold text-foreground" dir="ltr">{m.phone}</div>
                    </td>
                    <td className="p-3 text-sm">
                      <div className="font-bold text-foreground">
                        {(m.categoryIds && m.categoryIds.length)
                          ? m.categoryIds.map((id) => categoryNameById.get(categoryKey(id))).filter(Boolean).join("، ")
                          : (m.category && m.category !== "—" ? m.category : "—")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.mapsUrl ? (
                          <a href={m.mapsUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline">
                            <MapPin className="h-3 w-3" /> {m.city}
                          </a>
                        ) : (
                          m.city
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-sm font-bold text-foreground">
                      {m.packageName && m.packageName !== "—" ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs text-primary">
                          <Tag className="h-3 w-3" /> {m.packageName}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 font-bold">{m.offers}</td>
                    <td className="p-3 font-bold">{m.bookings}</td>
                    <td className="p-3 font-bold" dir="ltr">{m.revenue.toLocaleString()} {L("ر.س", "SAR")}</td>
                    <td className="p-3">
                      {m.rating > 0 ? (
                        <span className="inline-flex items-center gap-1 text-sm font-bold">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {m.rating}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Pill tone={s.tone}>
                        <s.icon className="h-3 w-3" /> {sLabel(m.status)}
                      </Pill>
                    </td>
                    <td className="p-3 text-end">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setViewing(m)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold hover:bg-muted"
                        >
                          <Eye className="h-3.5 w-3.5" /> {L("عرض", "View")}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {m.status === "pending" && (
                              <>
                                <DropdownMenuItem onClick={() => setStatus(m.id, "active")}>
                                  <CheckCircle2 className="me-2 h-4 w-4 text-emerald-600" /> {L("اعتماد المركز", "Approve partner")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatus(m.id, "rejected")}>
                                  <XCircle className="me-2 h-4 w-4 text-rose-600" /> {L("رفض الطلب", "Reject request")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem onClick={async () => {
                              try {
                                const full: any = await adminPartnersApi.get(m.id);
                                const catIds = pickAssignedCategoryIds(full, { treatPlainCategoriesAsAssigned: true, masterCategories: categories });
                                setEditing({
                                  ...m,
                                  name: full?.vendorName || full?.nameAr || full?.name || m.name,
                                  nameEn: full?.vendorNameEn || full?.nameEn || full?.name_en || "",
                                  owner: full?.ownerName || full?.owner_name || m.owner,
                                  city: full?.city || full?.address || m.city,
                                  phone: full?.phone || m.phone,
                                  email: full?.email || m.email,
                                  commercialNumber: full?.commercialNumber || full?.commercial_number || m.commercialNumber,
                                  mapsUrl: full?.mapsUrl || full?.maps_url || m.mapsUrl || "",
                                  description: full?.description || full?.descriptionAr || "",
                                  descriptionEn: full?.descriptionEn || full?.description_en || "",
                                  terms: full?.terms || full?.termsAr || "",
                                  termsEn: full?.termsEn || full?.terms_en || "",
                                  about: full?.about || full?.aboutAr || "",
                                  aboutEn: full?.aboutEn || full?.about_en || "",
                                  workingHours: parseWorkingHours(full?.workingHours ?? full?.working_hours),
                                  categoryIds: catIds,
                                  packageId: full?.packageId ? String(full.packageId) : (full?.package_id ? String(full.package_id) : (full?.package?.id ? String(full.package.id) : "")),
                                  packageName: full?.package?.name || full?.package_name || full?.packageName || m.packageName,
                                });

                              } catch {
                                setEditing(m);
                              }
                            }}>
                              <Pencil className="me-2 h-4 w-4" /> {L("تعديل البيانات", "Edit details")}
                            </DropdownMenuItem>
                            {m.status === "active" && (
                              <DropdownMenuItem onClick={() => setStatus(m.id, "suspended")}>
                                <Ban className="me-2 h-4 w-4 text-amber-600" /> {L("إيقاف مؤقت", "Suspend")}
                              </DropdownMenuItem>
                            )}
                            {(m.status === "suspended" || m.status === "rejected") && (
                              <DropdownMenuItem onClick={() => setStatus(m.id, "active")}>
                                <CheckCircle2 className="me-2 h-4 w-4 text-emerald-600" /> {L("إعادة تفعيل", "Reactivate")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => deleteCenter(m, true)} className="text-rose-600 focus:text-rose-600">
                              <Trash2 className="me-2 h-4 w-4" /> {L("حذف نهائي", "Delete permanently")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-sm text-muted-foreground">{L("لا توجد مراكز مطابقة", "No matching partners")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </PanelCard>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="text-end">{viewing.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4" dir="rtl">
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const s = STATUS_META[viewing.status];
                    return (
                      <Pill tone={s.tone}>
                        <s.icon className="h-3 w-3" /> {sLabel(viewing.status)}
                      </Pill>
                    );
                  })()}
                  <Pill tone="primary"><Tag className="h-3 w-3" /> {viewing.category}</Pill>
                  <Pill tone="muted"><MapPin className="h-3 w-3" /> {viewing.city}</Pill>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div className="flex items-center gap-2"><Store className="h-4 w-4 text-primary" /> {viewing.owner}</div>
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> <span dir="ltr">{viewing.phone}</span></div>
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> {viewing.email}</div>
                  <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> {L("س.ت:", "CR:")} <span dir="ltr">{viewing.commercialNumber}</span></div>
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> {L("انضم:", "Joined:")} {viewing.joined || "—"}</div>
                  <div className="flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> {viewing.rating > 0 ? `${viewing.rating} / 5` : L("بدون تقييم", "No rating")}</div>
                  {viewing.mapsUrl && (
                    <a href={viewing.mapsUrl} target="_blank" rel="noopener noreferrer" className="sm:col-span-2 inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 font-bold text-primary hover:bg-primary/10">
                      <MapPin className="h-4 w-4" /> {L("فتح الموقع على خرائط جوجل", "Open on Google Maps")}
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-center">
                  <div>
                    <div className="text-2xl font-black">{viewing.offers}</div>
                    <div className="text-xs text-muted-foreground">{L("عرض", "Offers")}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black">{viewing.bookings}</div>
                    <div className="text-xs text-muted-foreground">{L("حجز", "Bookings")}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black" dir="ltr">{viewing.revenue.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{L("إيراد (ر.س)", "Revenue (SAR)")}</div>
                  </div>
                </div>
                <BranchesPanel partnerId={viewing.id} />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                {viewing.status === "pending" && (
                  <>
                    <GhostButton onClick={() => setStatus(viewing.id, "rejected")}>{L("رفض", "Reject")}</GhostButton>
                    <PrimaryButton onClick={() => setStatus(viewing.id, "active")}>{L("اعتماد المركز", "Approve partner")}</PrimaryButton>
                  </>
                )}
                {viewing.status === "active" && (
                  <GhostButton onClick={() => setStatus(viewing.id, "suspended")}>{L("إيقاف مؤقت", "Suspend")}</GhostButton>
                )}
                {(viewing.status === "suspended" || viewing.status === "rejected") && (
                  <PrimaryButton onClick={() => setStatus(viewing.id, "active")}>{L("إعادة تفعيل", "Reactivate")}</PrimaryButton>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AddCenterDialog open={addOpen} onClose={() => setAddOpen(false)} onSave={addCenter} categories={categories} packages={packages} />
      <AddCenterDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        initial={editing || undefined}
        onSave={(data) => editing && updateCenter(editing.id, data)}
        categories={categories}
        packages={packages}
      />
    </AdminLayout>
  );
}

function AddCenterDialog({
  open, onClose, onSave, initial, categories, packages,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (m: Omit<Merchant, "id" | "rating" | "offers" | "bookings" | "revenue" | "joined">) => void;
  initial?: Merchant;
  categories?: AdminCategory[];
  packages?: PartnerPackage[];
}) {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const empty = {
    name: "", nameEn: "", owner: "", city: "", phone: "", email: "",
    commercialNumber: "", mapsUrl: "", status: "pending" as Status,
    description: "", descriptionEn: "", terms: "", termsEn: "",
    about: "", aboutEn: "",
    workingHours: defaultWorkingHours(),
    password: "",
    categoryIds: [] as CategoryId[],
    packageId: "" as string,
  };
  const [f, setF] = useState(empty);

  useEffect(() => {
    if (!open) return;
    setF(initial ? {
      name: initial.name, nameEn: initial.nameEn || "",
      owner: initial.owner, city: initial.city,
      phone: initial.phone, email: initial.email, commercialNumber: initial.commercialNumber,
      mapsUrl: initial.mapsUrl || "", status: initial.status,
      description: initial.description || "",
      descriptionEn: initial.descriptionEn || "",
      terms: initial.terms || "",
      termsEn: initial.termsEn || "",
      about: initial.about || "",
      aboutEn: initial.aboutEn || "",
      workingHours: initial.workingHours && initial.workingHours.length ? initial.workingHours : defaultWorkingHours(),
      password: "",
      categoryIds: initial.categoryIds || [],
      packageId: initial.packageId || "",
    } : empty);
  }, [open, initial]);


  function up<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((p) => ({ ...p, [k]: v })); }
  function reset() { setF(empty); }
  function genPwd() {
    const s = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 4).toUpperCase();
    up("password", s);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) { toast.error(L("اسم المركز مطلوب", "Partner name is required")); return; }
    if (!f.owner.trim()) { toast.error(L("اسم المالك مطلوب", "Owner name is required")); return; }
    if (!f.city.trim()) { toast.error(L("المدينة مطلوبة", "City is required")); return; }
    if (!f.phone.trim()) { toast.error(L("رقم الجوال مطلوب", "Phone is required")); return; }
    if (!initial && !f.email.trim()) { toast.error(L("البريد الإلكتروني مطلوب لإرسال بيانات الدخول", "Email is required to send login credentials")); return; }
    onSave({ ...f });
    reset();
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && (reset(), onClose())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader><DialogTitle className="text-end">{initial ? L("تعديل بيانات المركز", "Edit partner details") : L("إضافة مركز يدوي", "Add partner manually")}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold">{L("اسم المركز (عربي) *", "Partner name (Arabic) *")}</label>
            <input value={f.name} onChange={(e) => up("name", e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">{L("اسم المركز (إنجليزي)", "Partner name (English)")}</label>
            <input dir="ltr" value={f.nameEn} onChange={(e) => up("nameEn", e.target.value)} placeholder="Center name" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs font-bold">{L("اسم المالك *", "Owner name *")}</label>
            <input value={f.owner} onChange={(e) => up("owner", e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">{L("المدينة *", "City *")}</label>
            <input value={f.city} onChange={(e) => up("city", e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">{L("رقم الجوال *", "Phone *")}</label>
            <input value={f.phone} onChange={(e) => up("phone", e.target.value)} placeholder="+966…" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">{L("البريد الإلكتروني", "Email")} {initial ? "" : "*"}</label>
            <input value={f.email} onChange={(e) => up("email", e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold">{L("السجل التجاري", "Commercial registration")}</label>
            <input value={f.commercialNumber} onChange={(e) => up("commercialNumber", e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-bold">{L("رابط الموقع على خرائط جوجل", "Google Maps URL")}</label>
            <input dir="ltr" value={f.mapsUrl} onChange={(e) => up("mapsUrl", e.target.value)} placeholder="https://maps.app.goo.gl/..." className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-bold">{L("تصنيفات المركز", "Partner categories")}</label>
            <div className="mt-1 flex flex-wrap gap-2 rounded-xl border border-border bg-background p-2">
              {(categories || []).length === 0 && (
                <span className="text-xs text-muted-foreground">{L("لا توجد تصنيفات — أضفها من صفحة التصنيفات أولاً.", "No categories — add them from the Categories page first.")}</span>
              )}
              {(categories || []).map((c) => {
                const idKey = categoryKey(c);
                const selected = (f.categoryIds || []).some((id) => categoryKey(id) === idKey);
                const catName = lang === "en"
                  ? ((c as any).nameEn || (c as any).name_en || (c as any).nameAr || (c as any).name_ar || (c as any).name)
                  : ((c as any).nameAr || (c as any).name_ar || (c as any).name || c.nameEn);
                return (
                  <button
                    type="button"
                    key={idKey || ((c as any).nameAr || (c as any).name_ar || (c as any).name || c.nameEn)}
                    disabled={!idKey}
                    onClick={() => {
                      const cur = new Map<string, CategoryId>((f.categoryIds || []).map((id) => [categoryKey(id), id]));
                      const normalizedId = normalizeCategoryId(c);
                      if (!normalizedId) return;
                      if (selected) cur.delete(idKey); else cur.set(idKey, normalizedId);
                      up("categoryIds", Array.from(cur.values()));
                    }}
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-bold transition",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {catName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description AR/EN */}
          <div>
            <label className="text-xs font-bold">{L("وصف المركز (عربي)", "Partner description (Arabic)")}</label>
            <textarea
              rows={3}
              value={f.description}
              onChange={(e) => up("description", e.target.value)}
              placeholder={L("نبذة عن المركز وخدماته...", "Brief about the partner and its services...")}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold">{L("وصف المركز (إنجليزي)", "Partner description (English)")}</label>
            <textarea
              rows={3}
              dir="ltr"
              value={f.descriptionEn}
              onChange={(e) => up("descriptionEn", e.target.value)}
              placeholder="Brief about the center..."
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Terms AR/EN */}
          <div>
            <label className="text-xs font-bold">{L("شروط المركز (عربي)", "Partner terms (Arabic)")}</label>
            <textarea
              rows={3}
              value={f.terms}
              onChange={(e) => up("terms", e.target.value)}
              placeholder={L("سياسة الإلغاء، التحضير قبل الموعد...", "Cancellation policy, prep before appointment...")}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold">{L("شروط المركز (إنجليزي)", "Partner terms (English)")}</label>
            <textarea
              rows={3}
              dir="ltr"
              value={f.termsEn}
              onChange={(e) => up("termsEn", e.target.value)}
              placeholder="Cancellation policy, prep before appointment..."
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Working hours */}
          <div className="sm:col-span-2 rounded-2xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-bold">{L("ساعات العمل الأسبوعية", "Weekly working hours")}</label>
              <button
                type="button"
                onClick={() => up("workingHours", defaultWorkingHours())}
                className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold hover:bg-muted"
              >
                {L("استعادة الافتراضي", "Reset to default")}
              </button>
            </div>
            <div className="space-y-2">
              {WEEK_DAYS.map((d, idx) => {
                const wh = f.workingHours[idx] || { day: d.key, open: "09:00", close: "22:00", closed: false };
                const setWh = (patch: Partial<WorkingHour>) => {
                  const next = [...f.workingHours];
                  next[idx] = { ...wh, ...patch };
                  up("workingHours", next);
                };
                return (
                  <div key={d.key} className="grid grid-cols-[80px_1fr_1fr_auto] items-center gap-2">
                    <div className="text-xs font-bold">{L(d.ar, d.en)}</div>
                    <input
                      type="time"
                      disabled={wh.closed}
                      value={wh.open}
                      onChange={(e) => setWh({ open: e.target.value })}
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-50"
                    />
                    <input
                      type="time"
                      disabled={wh.closed}
                      value={wh.close}
                      onChange={(e) => setWh({ close: e.target.value })}
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-50"
                    />
                    <label className="inline-flex items-center gap-1 text-[11px] font-bold">
                      <input
                        type="checkbox"
                        checked={!!wh.closed}
                        onChange={(e) => setWh({ closed: e.target.checked, open: e.target.checked ? "00:00" : "09:00", close: e.target.checked ? "00:00" : "22:00" })}
                      />
                      {L("مغلق", "Closed")}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>



          {/* Password — create + edit (leave empty to keep current) */}
          <div className="sm:col-span-2">
            <label className="text-xs font-bold flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5" />
              {initial ? L("تغيير كلمة مرور المركز (اختياري)", "Change partner password (optional)") : L("كلمة مرور المركز (اختياري)", "Partner password (optional)")}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                dir="ltr"
                value={f.password}
                onChange={(e) => up("password", e.target.value)}
                placeholder={initial ? L("اتركها فارغة للإبقاء على كلمة المرور الحالية", "Leave empty to keep the current password") : L("اتركها فارغة لتوليد تلقائي وإرسالها بالإيميل", "Leave empty to auto-generate and send via email")}
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono"
              />
              <button type="button" onClick={genPwd} className="rounded-xl border border-border bg-muted px-3 py-2 text-xs font-bold hover:bg-muted/70">{L("توليد", "Generate")}</button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {initial
                ? L("أي قيمة هنا ستحل محل كلمة مرور المركز فوراً.", "Any value here will immediately replace the partner password.")
                : L("سيتم إرسال بيانات الدخول للمركز على بريده الإلكتروني تلقائياً.", "Login credentials will be sent to the partner's email automatically.")}
            </p>
          </div>


          <div className="sm:col-span-2">
            <label className="text-xs font-bold">{L("الحالة", "Status")}</label>
            <select value={f.status} onChange={(e) => up("status", e.target.value as Status)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <option value="active">{L("نشط", "Active")}</option>
              <option value="pending">{L("قيد المراجعة", "Pending review")}</option>
              <option value="suspended">{L("موقوف", "Suspended")}</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-bold flex items-center gap-2">
              <Tag className="h-3.5 w-3.5" />
              {L("اشتراك المركز (الباقة)", "Partner subscription (Package)")}
            </label>
            <select
              value={f.packageId || ""}
              onChange={(e) => up("packageId", e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">{L("— بدون اشتراك —", "— No subscription —")}</option>
              {(packages || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {(lang === "en" ? (p.nameEn || p.name || p.nameAr) : (p.nameAr || p.name || p.nameEn))} {p.price ? `· ${p.price.toLocaleString()} ${L("ر.س", "SAR")}` : ""}
                </option>
              ))}
            </select>
            {(packages || []).length === 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">{L("لا توجد باقات — أضفها من صفحة باقات الشركاء أولاً.", "No packages — add them from the Partner Packages page first.")}</p>
            )}
          </div>
          <DialogFooter className="sm:col-span-2">
            <button type="button" onClick={() => { reset(); onClose(); }} className="rounded-xl border border-border px-4 py-2 text-sm font-bold">{L("إلغاء", "Cancel")}</button>
            <button type="submit" className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">{L("حفظ المركز", "Save partner")}</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BranchesPanel({ partnerId }: { partnerId: string }) {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    import("@/lib/api/adminBranches").then(({ adminBranchesApi }) =>
      adminBranchesApi.listForPartner(partnerId)
        .then((d) => { if (alive) setItems(d.items || []); })
        .catch(() => { if (alive) setItems([]); })
        .finally(() => { if (alive) setLoading(false); })
    );
    return () => { alive = false; };
  }, [partnerId]);

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" /> {L("الفروع", "Branches")}
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <a href={`/admin/branches`} className="text-xs font-bold text-primary hover:underline">
          {L("إدارة الفروع", "Manage branches")}
        </a>
      </div>
      {loading ? (
        <div className="py-3 text-center"><Loader2 className="inline h-4 w-4 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="py-3 text-center text-xs text-muted-foreground">{L("لا توجد فروع مسجّلة.", "No branches yet.")}</div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl bg-background/70 px-3 py-2 text-xs">
              <div className="min-w-0 truncate">
                <span className="font-bold">{lang === "en" ? (b.nameEn || b.nameAr) : b.nameAr}</span>
                {b.address && <span className="text-muted-foreground"> · {b.address}</span>}
              </div>
              {b.isDefault && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  {L("افتراضي", "Default")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
