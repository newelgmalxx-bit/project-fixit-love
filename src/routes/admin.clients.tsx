import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, StatCard, PanelCard, Pill, PrimaryButton, GhostButton } from "@/components/admin/AdminLayout";
import { Users, Star, TrendingUp, ShoppingBag, Search, Plus, MoreHorizontal, Eye, Mail, Trash2, Phone, MapPin, Calendar, Globe, Shield, BadgeCheck, LogIn, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { fmtSAR, type AdminClient, adminClients } from "@/data/admin";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { admin as adminApi } from "@/lib/api";

export const Route = createFileRoute("/admin/clients")({
  head: () => ({ meta: [{ title: "Clients | Admin" }] }),
  component: ClientsPage,
});

type AddForm = { name: string; email: string; phone: string; city: string; region: string; language: string; address: string; segment: AdminClient["segment"]; notes: string };
const emptyAdd: AddForm = { name: "", email: "", phone: "", city: "", region: "", language: "العربية", address: "", segment: "new", notes: "" };

function ClientsPage() {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const segMap = {
    vip: { l: "VIP", t: "amber" as const },
    regular: { l: L("منتظم", "Regular"), t: "primary" as const },
    new: { l: L("جديد", "New"), t: "emerald" as const },
  };

  const [clients, setClients] = useState<AdminClient[]>([]);
  const [growthRate, setGrowthRate] = useState<string>("0%");
  const [avgOrder, setAvgOrder] = useState<number>(0);
  const [growthSeries, setGrowthSeries] = useState<{ m: string; n: number; r: number }[]>([]);
  const [tab, setTab] = useState<"all" | "vip" | "regular" | "new">("all");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [add, setAdd] = useState<AddForm>(emptyAdd);
  const [viewing, setViewing] = useState<AdminClient | null>(null);

  useEffect(() => {
    // Normalize email/name to reduce mismatch (case, spaces, arabic diacritics, dots in gmail)
    const normEmail = (v: any) => {
      const s = String(v ?? "").trim().toLowerCase();
      if (!s || !s.includes("@")) return "";
      const [local, domain] = s.split("@");
      const d = domain.replace(/^googlemail\.com$/, "gmail.com");
      const l = d === "gmail.com" ? local.replace(/\./g, "").split("+")[0] : local.split("+")[0];
      return `${l}@${d}`;
    };
    const normName = (v: any) => {
      let s = String(v ?? "").trim().toLowerCase();
      if (!s) return "";
      s = s.normalize("NFKD").replace(/[\u0300-\u036f\u064B-\u0652\u0670]/g, ""); // strip diacritics + arabic tashkeel
      s = s.replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه");
      return s.replace(/\s+/g, " ");
    };
    Promise.all([
      adminApi.clients.list({ limit: 200 }).catch(() => ({ items: [] })),
      adminApi.consultations?.list?.({ limit: 1000 }).catch(() => ({ items: [] })) ?? Promise.resolve({ items: [] }),
    ]).then(([cp, bp]: any) => {
      const bookings: any[] = bp?.items || [];
      const byEmail = new Map<string, { orders: number; spent: number }>();
      const byName = new Map<string, { orders: number; spent: number }>();
      const byUserId = new Map<string, { orders: number; spent: number }>();
      const cityByEmail = new Map<string, string>();
      const cityByName = new Map<string, string>();
      const cityByUserId = new Map<string, string>();
      const bump = (m: Map<string, any>, key: string, amount: number) => {
        if (!key) return;
        const cur = m.get(key) || { orders: 0, spent: 0 };
        cur.orders += 1;
        cur.spent += Number(amount) || 0;
        m.set(key, cur);
      };
      const sources = [
        ...bookings.map((b) => ({
          userId: b.user_id ?? b.userId ?? b.client_id ?? b.clientId,
          email: b.customerEmail ?? b.customer_email ?? b.contact_email ?? b.client_email ?? b.email,
          name: b.customerName ?? b.customer_name ?? b.contact_name ?? b.client_name ?? b.name,
          total: b.total ?? b.totalAmount ?? b.total_amount ?? b.amount ?? 0,
          city: b.city ?? b.customerCity ?? b.customer_city ?? "",
        })),
      ];
      sources.forEach((s) => {
        if (s.userId) bump(byUserId, String(s.userId), Number(s.total) || 0);
        bump(byEmail, normEmail(s.email), Number(s.total) || 0);
        bump(byName, normName(s.name), Number(s.total) || 0);
        if (s.city) {
          if (s.userId && !cityByUserId.has(String(s.userId))) cityByUserId.set(String(s.userId), s.city);
          const ne = normEmail(s.email);
          if (ne && !cityByEmail.has(ne)) cityByEmail.set(ne, s.city);
          const nn = normName(s.name);
          if (nn && !cityByName.has(nn)) cityByName.set(nn, s.city);
        }
      });
      if (typeof window !== "undefined") console.log("[clients] sample row:", (cp.items || [])[0]);
      const pickDate = (v: any) => {
        const s = String(v ?? "").trim();
        if (!s) return "";
        // support "2026-05-13 20:58:47", ISO, or Date-parsable
        const m = s.match(/\d{4}-\d{2}-\d{2}/);
        if (m) return m[0];
        const d = new Date(s);
        return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
      };
      // Exclude partners/merchants — they belong on the centers page, not clients
      const isPartnerRole = (r: any) => {
        const v = String(r ?? "").toLowerCase();
        return v === "partner" || v === "merchant" || v === "vendor" || v === "center" || v === "salon";
      };
      const rawClients: any[] = (cp.items || []).filter((c: any) => {
        const role = c.role ?? c.user?.role;
        const type = c.type ?? c.user?.type ?? c.accountType ?? c.account_type;
        if (isPartnerRole(role) || isPartnerRole(type)) return false;
        if (c.partnerId || c.partner_id || c.isPartner || c.is_partner) return false;
        return true;
      });
      const items: AdminClient[] = rawClients.map((c: any) => {
        const u = c.user || {};
        const aMatch =
          (c.id && byUserId.get(String(c.id))) ||
          (c.userId && byUserId.get(String(c.userId))) ||
          byEmail.get(normEmail(c.email ?? u.email)) ||
          byName.get(normName(c.name ?? u.name)) ||
          { orders: 0, spent: 0 };
        const resolvedCity =
          (c.city ?? u.city) ||
          (c.id ? cityByUserId.get(String(c.id)) : undefined) ||
          (c.userId ? cityByUserId.get(String(c.userId)) : undefined) ||
          cityByEmail.get(normEmail(c.email ?? u.email)) ||
          cityByName.get(normName(c.name ?? u.name)) ||
          undefined;
        const joined = pickDate(c.joinedAt ?? c.joined_at ?? c.created_at ?? c.createdAt ?? u.created_at ?? u.createdAt);
        const updated = pickDate(c.updated_at ?? c.updatedAt ?? u.updated_at ?? u.updatedAt);
        return {
          id: c.id ?? u.id,
          name: c.name ?? u.name ?? "—",
          email: c.email ?? u.email ?? "",
          phone: c.phone ?? u.phone ?? "",
          orders: aMatch.orders || Number(c.orders) || 0,
          totalSpent: aMatch.spent || Number(c.totalSpent) || 0,
          segment: (c.segment as any) || "new",
          joinedAt: joined || "—",
          city: resolvedCity,
          role: c.role ?? u.role ?? undefined,
          status: c.status ?? u.status ?? undefined,
          authProvider: c.auth_provider ?? c.authProvider ?? u.auth_provider ?? undefined,
          avatar: c.avatar ?? u.avatar ?? undefined,
          updatedAt: updated || undefined,
        };
      });
      setClients(items.length ? items : adminClients);

      // Compute avg order from real bookings totals
      const allTotals = sources.map((s) => Number(s.total) || 0).filter((n) => n > 0);
      if (allTotals.length) {
        const avg = allTotals.reduce((a, b) => a + b, 0) / allTotals.length;
        setAvgOrder(Math.round(avg));
      }

      // Build client-growth series — fill gaps between months so the chart is continuous
      const list: any[] = rawClients;
      const monthMap = new Map<string, number>();
      let unknown = 0;
      list.forEach((c) => {
        const raw = (c.joinedAt || c.created_at || c.createdAt || "").toString().slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(raw)) monthMap.set(raw, (monthMap.get(raw) || 0) + 1);
        else unknown += 1;
      });
      let series: { m: string; n: number; r: number }[] = [];
      if (monthMap.size) {
        const keys = Array.from(monthMap.keys()).sort();
        const [sy, sm] = keys[0].split("-").map(Number);
        const [ey, em] = keys[keys.length - 1].split("-").map(Number);
        const cur = new Date(sy, sm - 1, 1);
        const end = new Date(ey, em - 1, 1);
        let cumulative = 0;
        while (cur <= end) {
          const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
          const n = monthMap.get(k) || 0;
          cumulative += n;
          series.push({ m: k, n, r: cumulative - n });
          cur.setMonth(cur.getMonth() + 1);
        }
        if (unknown) series[0] = { ...series[0], n: series[0].n + unknown };
      } else if (list.length) {
        const now = new Date();
        const k = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        series = [{ m: k, n: list.length, r: 0 }];
      }
      if (series.length) setGrowthSeries((prev) => (prev.length ? prev : series));

      // Compute growth rate: this month new clients vs last month
      if (series.length >= 1) {
        const last = series[series.length - 1]?.n || 0;
        const prev = series.length >= 2 ? series[series.length - 2]?.n || 0 : 0;
        let rate = 0;
        if (prev === 0 && last > 0) rate = 100;
        else if (prev > 0) rate = Math.round(((last - prev) / prev) * 100);
        setGrowthRate(`${rate > 0 ? "+" : ""}${rate}%`);
      }
    });
    adminApi.analytics().then((a: any) => {
      if (!a) return;
      if (a.growthRate !== undefined && a.growthRate !== null && Number(a.growthRate) !== 0) {
        setGrowthRate(`${a.growthRate}%`);
      }
      if (Number(a.avgOrder) > 0) setAvgOrder(Number(a.avgOrder));
      if (Array.isArray(a.clientGrowth) && a.clientGrowth.length) setGrowthSeries(a.clientGrowth);
    }).catch(() => {});
  }, []);

  const filtered = clients.filter(c =>
    (tab === "all" || c.segment === tab) && (c.name.includes(q) || c.email.toLowerCase().includes(q.toLowerCase()))
  );

  const handleAdd = async () => {
    if (!add.name || !add.email) { toast.error(L("الاسم والبريد مطلوبان", "Name and email are required")); return; }
    let id = "c" + Date.now();
    try {
      const res = await adminApi.clients.create({ name: add.name, email: add.email, phone: add.phone, segment: add.segment as any });
      id = res.id;
    } catch { /* tolerate */ }
    const month = new Date().toLocaleDateString(lang === "en" ? "en-US" : "ar-SA", { month: "long", year: "numeric" });
    setClients([
      { id, name: add.name, email: add.email, phone: add.phone, orders: 0, totalSpent: 0,
        segment: add.segment, joinedAt: month, region: add.region, city: add.city, language: add.language, address: add.address, notes: add.notes },
      ...clients,
    ]);
    setAdd(emptyAdd); setAddOpen(false);
    toast.success(L("تم إضافة العميل", "Client added"));
  };

  const remove = (id: string) => {
    setClients(clients.filter(c => c.id !== id));
    adminApi.clients.remove(id).catch(() => {});
    toast.success(L("تم حذف العميل", "Client deleted"));
  };

  const toggleStatus = (id: string) => {
    setClients((arr) => arr.map((c) => {
      if (c.id !== id) return c;
      const next = (c.status || "active") === "active" ? "suspended" : "active";
      adminApi.clients.update?.(id, { status: next }).catch(() => {});
      return { ...c, status: next };
    }));
    toast.success(L("تم تحديث حالة العميل", "Client status updated"));
  };


  const startSide = dir === "rtl" ? "right-3" : "left-3";
  const padStart = dir === "rtl" ? "pr-10 pl-3" : "pl-10 pr-3";
  const textAlign = dir === "rtl" ? "text-right" : "text-left";
  const iconMargin = dir === "rtl" ? "ml-2" : "mr-2";

  return (
    <AdminLayout title={L("العملاء", "Clients")} subtitle={L("رؤى وشرائح وإحصائيات الاحتفاظ بالعملاء", "Insights, segments and retention stats")} action={<PrimaryButton onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> {L("إضافة عميل", "Add Client")}</PrimaryButton>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label={L("إجمالي العملاء", "Total Clients")} value={clients.length} icon={Users} accent="emerald" />
        <StatCard label={L("عملاء نشطون", "Active Clients")} value={clients.filter(c => (c.orders || 0) > 0).length} icon={Star} accent="amber" />
        <StatCard label={L("معدل النمو", "Growth Rate")} value={growthRate} icon={TrendingUp} accent="primary" />
        <StatCard label={L("متوسط الطلب", "Avg. Order")} value={fmtSAR(avgOrder)} icon={ShoppingBag} accent="violet" />
      </div>

      <PanelCard title={L("نمو العملاء", "Client Growth")} subtitle={L("جدد مقابل عائدين عبر الوقت", "New vs returning over time")} className="mb-6">
        <div className="h-64">
          {growthSeries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{L("لا توجد بيانات بعد", "No data yet")}</div>
          ) : (
          <ResponsiveContainer>
            <BarChart data={growthSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3ebf3" />
              <XAxis dataKey="m" stroke="#7c8aa0" fontSize={12} />
              <YAxis stroke="#7c8aa0" fontSize={12} />
              <Tooltip />
              <Bar dataKey="r" name={L("عائدون", "Returning")} fill="#00AEC6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="n" name={L("جدد", "New")} fill="#9bc4e8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      </PanelCard>

      <PanelCard>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute ${startSide} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("ابحث عن العملاء...", "Search clients...")} className={`w-full rounded-xl border border-border bg-background ${padStart} py-2.5 text-sm`} />
          </div>
          <div className="inline-flex rounded-xl border border-border bg-background p-1">
            {[["all", L("الكل", "All")], ["vip", "VIP"], ["regular", L("منتظم", "Regular")], ["new", L("جدد", "New")]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${tab === k ? "bg-primary text-primary-foreground" : "text-foreground/60"}`}>{l}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className={`${textAlign} text-xs text-muted-foreground border-b border-border`}>
                <th className="px-3 py-3 font-medium">{L("العميل", "Client")}</th>
                <th className="px-3 py-3 font-medium">{L("البريد", "Email")}</th>
                <th className="px-3 py-3 font-medium">{L("الجوال", "Phone")}</th>
                <th className="px-3 py-3 font-medium">{L("المدينة", "City")}</th>
                <th className="px-3 py-3 font-medium">{L("الطلبات", "Orders")}</th>
                <th className="px-3 py-3 font-medium">{L("إجمالي الإنفاق", "Total Spent")}</th>
                <th className="px-3 py-3 font-medium">{L("الشريحة", "Segment")}</th>
                <th className="px-3 py-3 font-medium">{L("الحالة", "Status")}</th>
                <th className="px-3 py-3 font-medium">{L("الانضمام", "Joined")}</th>
                <th className="px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const s = segMap[c.segment];
                const initials = c.name.split(" ").map(n => n[0]).slice(0, 2).join("");
                const isActive = (c.status || "active") === "active";
                return (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/40">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">{initials}</div>
                        <div>
                          <div className="font-bold">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground" dir="ltr">{c.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{c.email}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground" dir="ltr">{c.phone}</td>
                    <td className="px-3 py-3 text-xs">{c.city ?? "—"}</td>
                    <td className="px-3 py-3" data-ltr-number>{c.orders}</td>
                    <td className="px-3 py-3 font-bold" data-ltr-number>{fmtSAR(c.totalSpent)}</td>
                    <td className="px-3 py-3"><Pill tone={s.t}>{s.l}</Pill></td>
                    <td className="px-3 py-3">
                      <Pill tone={isActive ? "emerald" : "rose"}>
                        {isActive ? L("نشط", "Active") : L("موقوف", "Suspended")}
                      </Pill>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground" data-ltr-number>{c.joinedAt}</td>
                    <td className="px-3 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(c)}><Eye className={`${iconMargin} h-4 w-4`} /> {L("عرض التفاصيل", "View details")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { window.location.href = `mailto:${c.email}`; }}><Mail className={`${iconMargin} h-4 w-4`} /> {L("إرسال بريد", "Send email")}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toggleStatus(c.id)}>
                            <Shield className={`${iconMargin} h-4 w-4`} />
                            {isActive ? L("إيقاف الملف", "Suspend account") : L("تنشيط الملف", "Activate account")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => remove(c.id)} className="text-rose-600 focus:text-rose-600"><Trash2 className={`${iconMargin} h-4 w-4`} /> {L("حذف العميل", "Delete client")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>
      </PanelCard>

      {/* Add client */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir={dir} className="max-w-xl">
          <DialogHeader><DialogTitle>{L("إضافة عميل جديد", "Add New Client")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Lbl label={L("الاسم الكامل", "Full Name")}><input className={ic} value={add.name} onChange={e => setAdd({ ...add, name: e.target.value })} /></Lbl>
            <Lbl label={L("رقم الجوال", "Phone")}><input type="tel" inputMode="tel" className={ic} dir="ltr" value={add.phone} onChange={e => setAdd({ ...add, phone: e.target.value })} /></Lbl>
            <Lbl label={L("البريد الإلكتروني", "Email")}><input type="email" className={ic} value={add.email} onChange={e => setAdd({ ...add, email: e.target.value })} /></Lbl>
            <Lbl label={L("المدينة", "City")}><input className={ic} value={add.city} onChange={e => setAdd({ ...add, city: e.target.value })} /></Lbl>
            <Lbl label={L("المنطقة / الدولة", "Region / Country")}><input className={ic} value={add.region} onChange={e => setAdd({ ...add, region: e.target.value })} /></Lbl>
            <Lbl label={L("اللغة المفضلة", "Preferred Language")}>
              <input className={ic} value={add.language} onChange={e => setAdd({ ...add, language: e.target.value })} />
            </Lbl>
            <Lbl label={L("الشريحة", "Segment")}>
              <select className={ic} value={add.segment} onChange={e => setAdd({ ...add, segment: e.target.value as any })}>
                <option value="new">{L("جديد", "New")}</option><option value="regular">{L("منتظم", "Regular")}</option><option value="vip">VIP</option>
              </select>
            </Lbl>
            <Lbl label={L("العنوان", "Address")} full><input className={ic} value={add.address} onChange={e => setAdd({ ...add, address: e.target.value })} /></Lbl>
            <Lbl label={L("ملاحظات", "Notes")} full><textarea rows={2} className={ic} value={add.notes} onChange={e => setAdd({ ...add, notes: e.target.value })} /></Lbl>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <GhostButton onClick={() => setAddOpen(false)}>{L("إلغاء", "Cancel")}</GhostButton>
            <PrimaryButton onClick={handleAdd}>{L("إضافة", "Add")}</PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View client */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent dir={dir} className="max-w-xl">
          <DialogHeader><DialogTitle>{L("تفاصيل العميل", "Client Details")}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                  {viewing.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <div className="font-bold text-base">{viewing.name}</div>
                  <Pill tone={segMap[viewing.segment].t}>{segMap[viewing.segment].l}</Pill>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info icon={Mail} label={L("البريد", "Email")} value={viewing.email} />
                <Info icon={Phone} label={L("الجوال", "Phone")} value={viewing.phone} ltr />
                <Info icon={MapPin} label={L("المدينة", "City")} value={viewing.city ?? "—"} />
                <Info icon={Calendar} label={L("الانضمام", "Joined")} value={viewing.joinedAt} ltr />
                {viewing.updatedAt && (
                  <Info icon={Clock} label={L("آخر تحديث", "Last Updated")} value={viewing.updatedAt} ltr />
                )}
                {viewing.role && (
                  <Info icon={Shield} label={L("الصلاحية", "Role")} value={viewing.role} ltr />
                )}
                {viewing.status && (
                  <Info icon={BadgeCheck} label={L("الحالة", "Status")} value={viewing.status} ltr />
                )}
                {viewing.authProvider && (
                  <Info icon={LogIn} label={L("طريقة الدخول", "Sign-in Method")} value={viewing.authProvider} ltr />
                )}
                <Info icon={ShoppingBag} label={L("عدد الطلبات", "Orders")} value={String(viewing.orders)} ltr />
                <Info icon={Star} label={L("إجمالي الإنفاق", "Total Spent")} value={fmtSAR(viewing.totalSpent)} ltr />
              </div>
              {viewing.notes && (
                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                  <div className="text-[11px] font-bold text-muted-foreground mb-1">{L("ملاحظات", "Notes")}</div>
                  {viewing.notes}
                </div>
              )}
            </div>
          )}
          <DialogFooter><GhostButton onClick={() => setViewing(null)}>{L("إغلاق", "Close")}</GhostButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

const ic = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
function Lbl({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`text-xs font-bold space-y-1.5 block ${full ? "col-span-2" : ""}`}>{label}{children}</label>;
}
function Info({ icon: Icon, label, value, ltr }: { icon: any; label: string; value: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div dir={ltr ? "ltr" : undefined} className="font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
