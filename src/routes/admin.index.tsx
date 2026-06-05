import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, StatCard, PanelCard, Pill } from "@/components/admin/AdminLayout";
import { DollarSign, ShoppingCart, Users, Package, TrendingUp, Bell, Store, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { bookingStatusMap, fmtSAR } from "@/data/admin";
import { useEffect, useMemo, useState } from "react";
import { admin as adminApi, ApiError } from "@/lib/api";
import { adminPartnersApi } from "@/lib/api/adminPartners";
import { adminOffersApi } from "@/lib/api/adminContent";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Panel | koswmat" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { lang, dir } = useLang();
  const { user } = useAuth();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const emptyStats = {
    revenue: 0, revenueGrowth: 0, ordersCount: 0, monthlyTarget: 0, remaining: 0,
    totalServices: 0, activeServices: 0, totalBookings: 0, totalClients: 0, vipClients: 0,
    totalBookingsValue: 0, totalPartnerEarnings: 0, monthRevenue: 0, avgOrderValue: 0,
  } as any;
  const [stats, setStats] = useState<any>(emptyStats);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [byCat, setByCat] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [activity, setActivity] = useState<{ icon: any; text: string; time: string; link?: string | null }[]>([]);
  const [pendingPartners, setPendingPartners] = useState<any[]>([]);

  async function loadPendingPartners() {
    let fromDb: any[] = [];
    try {
      // Fetch all partners and pick those still awaiting action: anyone not yet 'active'
      // (covers pending registration / pending agreement / suspended).
      const data = await adminPartnersApi.list({ limit: 100 });
      fromDb = (data.items || [])
        .filter((p: any) => {
          const s = String(p.status || "").toLowerCase();
          return s && s !== "active" && s !== "rejected";
        })
        .map((p: any) => ({
          id: p.id,
          name: p.vendorName || p.vendor_name || p.name || p.nameAr || p.email || p.id,
          owner: p.ownerName || p.owner_name || p.owner || "—",
          category: p.category?.nameAr || p.category?.nameEn || p.category || p.categoryName || "—",
          city: p.city || p.cityName || "—",
          phone: p.phone || "—",
          joined: (p.createdAt || p.created_at || "").slice(0, 10),
          _real: true,
        }));
    } catch {
      fromDb = [];
    }
    setPendingPartners(fromDb);
  }

  useEffect(() => { loadPendingPartners(); }, []);

  async function approvePartner(p: any) {
    if (p._real) {
      try { await adminPartnersApi.setStatus(p.id, "active"); }
      catch { toast.error("تعذّر اعتماد المركز"); return; }
    }
    setPendingPartners((arr) => arr.filter((x) => x.id !== p.id));
    toast.success(`تم اعتماد ${p.name}`);
  }
  async function rejectPartner(p: any) {
    if (p._real) {
      try { await adminPartnersApi.setStatus(p.id, "rejected"); }
      catch { toast.error("تعذّر رفض الطلب"); return; }
    }
    setPendingPartners((arr) => arr.filter((x) => x.id !== p.id));
    toast.success(`تم رفض طلب ${p.name}`);
  }


  useEffect(() => {
    // /admin/dashboard — أرقام البطاقات الرئيسية (عمولة، قيمة الحجوزات، نصيب الشركاء…)
    adminApi.stats()
      .then((d: any) => {
        const data = d?.data ?? d ?? {};
        setStats((s: any) => ({
          ...s,
          // revenue / totalBookingsValue / totalPartnerEarnings are computed
          // locally from the bookings list below (source of truth = booking rows).
          monthBookingsValue: Number(data.monthBookingsValue ?? s.monthBookingsValue ?? 0) || 0,
          totalClients: Number(data.totalUsers ?? s.totalClients ?? 0) || 0,
          totalPartners: Number(data.totalPartners ?? s.totalPartners ?? 0) || 0,
          pendingCount: Number(data.pendingBookings ?? s.pendingCount ?? 0) || 0,
          paidThisMonthCount: Number(
            data.paidThisMonthCount ?? data.confirmedBookings ?? s.paidThisMonthCount ?? 0,
          ) || 0,
        }));
        // salesChart يومي (آخر 7 أيام) — استخدمه كاحتياطي للرسم
        if (Array.isArray(data.salesChart) && data.salesChart.length) {
          setRevenue((cur) => cur.length ? cur : data.salesChart.map((p: any) => ({
            m: (p.date || "").slice(5),
            v: Number(p.revenue ?? 0) || 0,
            total: Number(p.bookingsValue ?? 0) || 0,
          })));
        }
      })
      .catch((e) => { if (!(e instanceof ApiError) || e.status !== 401) console.warn("[admin.stats]", e); });

    // /admin/analytics/overview — للرسم الشهري (12 شهر)، النمو، ومتوسط الطلب
    adminApi.analytics()
      .then((d: any) => {
        const data = d?.data ?? d ?? {};
        setStats((s: any) => ({
          ...s,
          avgOrderValue: Number(data.avgOrderValue ?? s.avgOrderValue ?? 0) || 0,
          // growthPercent رقم؛ revenueGrowth قد يكون "+12.3%"
          revenueGrowth: Number(
            data.growthPercent ?? String(data.revenueGrowth ?? "").replace(/[^\d.\-]/g, ""),
          ) || 0,
        }));
        if (Array.isArray(data.monthlyRevenue) && data.monthlyRevenue.length) {
          const analyticsRevenue = data.monthlyRevenue.map((m: any) => ({
            m: m.m ?? m.month,
            v: Number(m.v ?? m.commission ?? m.revenue ?? 0) || 0,
            total: Number(m.bookingsValue ?? m.total ?? 0) || 0,
          }));
          setRevenue((current) => {
            const currentSum = current.reduce((sum: number, point: any) => sum + (Number(point.v) || 0), 0);
            const analyticsSum = analyticsRevenue.reduce((sum: number, point: any) => sum + (Number(point.v) || 0), 0);
            return currentSum > analyticsSum ? current : analyticsRevenue;
          });
        }
      })
      .catch((e) => { if (!(e instanceof ApiError) || e.status !== 401) console.warn("[admin.analytics]", e); });

    // Fetch bookings + offers in parallel so we can compute aggregates using the
    // full offer price (booking.totalAmount is only the deposit collected).
    Promise.all([
      adminApi.getBookings({ limit: 200 }).catch(() => ({} as any)),
      adminOffersApi.list({ limit: 500 } as any).catch(() => ({ items: [] } as any)),
      fetch("https://koswmat.com/api/categories").then((r) => r.json()).catch(() => ({} as any)),
    ])
      .then(([bRes, offersRes, catRes]: any[]) => {
        const catList: any[] = catRes?.data?.items || catRes?.items || [];
        const catNameById = new Map<string, string>();
        for (const c of catList) {
          if (c?.id) catNameById.set(String(c.id), c.nameAr || c.nameEn || c.name || "غير مصنف");
        }
        const all = ((bRes?.data?.items) || bRes?.items || []) as any[];
        const offersList: any[] = offersRes?.items || [];
        const offerPriceById = new Map<string, number>();
        for (const o of offersList) {
          const price = Number(o.priceAfter ?? o.price ?? o.priceBefore ?? 0) || 0;
          if (o.id) offerPriceById.set(String(o.id), price);
        }
        const items = all.slice(0, 5).map((b: any) => ({
          id: b.id,
          number: b.number,
          client: b.contact_name || b.client || b.customerName || "",
          email: b.contact_email || b.email || b.customerEmail || "",
          phone: b.contact_phone || b.phone || b.customerPhone,
          city: b.contact_city || b.city,
          service: Array.isArray(b.items) && b.items.length
            ? b.items.map((i: any) => i.service_title || i.serviceTitle).filter(Boolean).join(" • ")
            : (b.service || b.offerTitle || ""),
          total: Number(b.total ?? b.totalAmount) || 0,
          payment: b.payment_method || b.payment || b.paymentMethod,
          status: b.status,
          date: ((b.createdAt || b.created_at || "") as string).slice(0, 10),
          source: b.source ?? "direct",
        }));
        setBookings(items as any);

        // Business rules:
        // - Platform revenue = sum of deposit (booking.totalAmount) for PAID bookings
        // - Total bookings value = sum of FULL offer price for all non-cancelled bookings
        // - Partner earnings = total bookings value - platform revenue
        const isPaid = (o: any) => o.paid === true || o.payment_status === "paid" || o.paymentStatus === "paid";
        const isCancelled = (o: any) => o.status === "cancelled";
        const depositOf = (o: any) => Number(o.depositAmount ?? o.deposit_amount ?? o.commissionAmount ?? o.commission_amount ?? 0) || 0;
        const totalOf = (o: any) => Number(o.totalAmount ?? o.total_amount ?? o.total ?? 0) || 0;
        const partnerAmountOf = (o: any) => Number(o.partnerAmount ?? o.partner_amount ?? o.partnerShare ?? o.partner_share ?? 0) || 0;
        const booked = all.filter((o) => !isCancelled(o));
        // Total bookings value = sum of totalAmount
        const totalBookingsValue = booked.reduce((sum, o) => sum + totalOf(o), 0);
        // Platform revenue = sum of depositAmount (commission)
        const platformRevenue = booked.reduce((sum, o) => sum + depositOf(o), 0);
        // Partner earnings = sum of partnerAmount
        const partnerEarnings = booked.reduce((sum, o) => sum + partnerAmountOf(o), 0);

        const nowD = new Date();
        const curY = nowD.getFullYear();
        const curM = nowD.getMonth();
        const inCurMonth = (o: any) => {
          const raw = (o.createdAt || o.created_at || "").toString();
          const dt = new Date(raw.replace(" ", "T"));
          return !Number.isNaN(dt.getTime()) && dt.getFullYear() === curY && dt.getMonth() === curM;
        };
        const paidThisMonth = booked.filter(inCurMonth);
        const monthRevenue = paidThisMonth.reduce((sum, o) => sum + depositOf(o), 0);
        const pendingCount = all.filter((o) => o.status === "pending").length;
        setStats((s: any) => ({
          ...s,
          revenue: platformRevenue,
          monthRevenue,
          totalBookingsValue,
          totalPartnerEarnings: partnerEarnings,
          ordersCount: all.length,
          totalBookings: all.length,
          paidThisMonthCount: paidThisMonth.length,
          pendingCount,
        }));
        setStats((s: any) => ({ ...s, totalServices: s.totalServices || 0, activeServices: s.activeServices || 0 }));

        // Monthly revenue chart — group bookings by year-month
        const monthMap = new Map<string, { v: number; total: number }>();
        for (const o of booked) {
          const raw = (o.createdAt || o.created_at || "").toString();
          const dt = new Date(raw.replace(" ", "T"));
          if (Number.isNaN(dt.getTime())) continue;
          const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
          const cur = monthMap.get(key) || { v: 0, total: 0 };
          cur.v += depositOf(o);
          cur.total += totalOf(o);
          monthMap.set(key, cur);
        }
        const monthly = Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([m, v]) => ({ m, v: v.v, total: v.total }));
        // Fallback: if no commission/deposit recorded, use totalAmount so the chart isn't empty
        const sumDeposit = monthly.reduce((s, x) => s + (x.v || 0), 0);
        const normalized = sumDeposit > 0
          ? monthly
          : monthly.map((x) => ({ ...x, v: x.total }));
        if (normalized.length) setRevenue(normalized);

        // Sales by category — using offer.category if available
        const offerCategoryById = new Map<string, string>();
        for (const o of offersList) {
          if (!o.id) continue;
          const byId = o.categoryId ? catNameById.get(String(o.categoryId)) : null;
          const catName = byId || o.category?.nameAr || o.category?.nameEn || o.categoryName || o.categoryAr || "غير مصنف";
          offerCategoryById.set(String(o.id), catName);
        }
        const catMap = new Map<string, number>();
        for (const o of booked) {
          const cat = offerCategoryById.get(String(o.offerId)) || o.category || o.offerCategory || "أخرى";
          catMap.set(cat, (catMap.get(cat) || 0) + totalOf(o));
        }
        const palette = ["#00AEC6", "#3a7fbe", "#5fa1d9", "#9bc4e8", "#cbe0f0", "#7c3aed", "#f59e0b"];
        const totalCat = Array.from(catMap.values()).reduce((s, v) => s + v, 0);
        const cats = Array.from(catMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, value], i) => ({
            name,
            value: totalCat ? Math.round((value / totalCat) * 100) : 0,
            color: palette[i % palette.length],
          }));
        if (cats.length) setByCat(cats);
      })
      .catch(() => setBookings([]));
    adminApi.clients.list({ limit: 1 })
      .then((p: any) => setStats((s: any) => ({ ...s, totalClients: p?.total ?? s.totalClients })))
      .catch(() => {});
    adminPartnersApi.list({ limit: 1 })
      .then((p: any) => setStats((s: any) => ({ ...s, totalPartners: p?.total ?? 0 })))
      .catch(() => {});

    adminApi.notifications.list(5)
      .then((d: any) => {
        const list = d?.items ?? d ?? [];
        setActivity(list.map((n: any) => ({
          icon: Bell,
          text: n.title ? `${n.title}${n.body ? " — " + n.body : ""}` : (n.message || n.text || ""),
          time: (n.createdAt || n.created_at || "").slice(0, 16).replace("T", " "),
          link: n.link || null,
        })));
      })
      .catch(() => setActivity([]));
  }, [lang]);

  const periods = [
    { v: "7", l: L("آخر 7 أيام", "Last 7 days") },
    { v: "30", l: L("آخر 30 يوم", "Last 30 days") },
    { v: "90", l: L("آخر 90 يوم", "Last 90 days") },
    { v: "all", l: L("كل الفترة", "All time") },
  ];
  const [period, setPeriod] = useState("30");
  const filteredRevenue = period === "7" ? revenue.slice(-2)
    : period === "30" ? revenue.slice(-3)
    : period === "90" ? revenue.slice(-6)
    : revenue;

  const bookingStatusLabel = (key: keyof typeof bookingStatusMap) => {
    const m: Record<string, string> = {
      pending: "Pending", in_progress: "In Progress", review: "Review", completed: "Completed", cancelled: "Cancelled",
    };
    const fallback = bookingStatusMap[key]?.label ?? String(key);
    return lang === "en" ? (m[key] ?? fallback) : fallback;
  };

  return (
    <AdminLayout title={L("لوحة التحكم", "Dashboard")} subtitle={L("مرحباً بعودتك! إليك نظرة عامة على نشاط الأعمال", "Welcome back! Here's an overview of your business activity")} action={
      <select value={period} onChange={(e) => setPeriod(e.target.value)} className="hidden sm:inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold">
        {periods.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
      </select>
    }>
      {/* Hero card */}
      <div className={`rounded-2xl bg-gradient-to-l from-primary to-primary-dark p-6 text-white shadow-md mb-6 relative overflow-hidden`}>
        <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-12 -bottom-12 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-2 items-center">
          <div>
            <div className="text-sm text-white/75">{L("مرحباً", "Hello")}, {user?.name || L("المالك", "Owner")} 👋</div>
            <div className="mt-2 text-4xl font-extrabold">{fmtSAR(stats.monthRevenue || stats.revenue)}</div>
            <div className="text-sm text-white/80 mt-1">{L("إيراد المنصة هذا الشهر (عمولة)", "Platform revenue this month (commission)")}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
                <TrendingUp className="h-3.5 w-3.5" /> {stats.revenueGrowth >= 0 ? "+" : ""}{stats.revenueGrowth}% {L("مقارنة بالفترة السابقة", "vs previous period")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
                {stats.ordersCount.toLocaleString(lang === "en" ? "en-US" : "ar-SA")} {L("حجز", "bookings")}
              </span>
            </div>
          </div>
          <div className={`${dir === "rtl" ? "md:justify-self-end" : "md:justify-self-start"} grid grid-cols-3 gap-3 text-center`}>
            <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-3 min-w-[88px]">
              <div className="text-[11px] text-white/75">{L("مدفوع هذا الشهر", "Paid this month")}</div>
              <div className="mt-1 text-2xl font-extrabold">{(stats.paidThisMonthCount || 0).toLocaleString(lang === "en" ? "en-US" : "ar-SA")}</div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-3 min-w-[88px]">
              <div className="text-[11px] text-white/75">{L("بانتظار التأكيد", "Pending")}</div>
              <div className="mt-1 text-2xl font-extrabold">{(stats.pendingCount || 0).toLocaleString(lang === "en" ? "en-US" : "ar-SA")}</div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-3 min-w-[88px]">
              <div className="text-[11px] text-white/75">{L("متوسط الطلب", "Avg order")}</div>
              <div className="mt-1 text-lg font-extrabold leading-tight">{fmtSAR(stats.avgOrderValue || 0)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <StatCard label={L("إيراد المنصة (عمولة)", "Platform Revenue (Commission)")} value={fmtSAR(stats.revenue)} icon={DollarSign} accent="primary" />
        <StatCard label={L("إجمالي قيمة الحجوزات", "Total Bookings Value")} value={fmtSAR(stats.totalBookingsValue || 0)} icon={TrendingUp} accent="emerald" />
        <StatCard label={L("مكسب الشركاء", "Partner Earnings")} value={fmtSAR(stats.totalPartnerEarnings || 0)} icon={Store} accent="violet" />
        <StatCard label={L("إجمالي الحجوزات", "Total Bookings")} value={stats.totalBookings} icon={ShoppingCart} accent="amber" />
        <StatCard label={L("العملاء", "Customers")} value={stats.totalClients} icon={Users} accent="primary" />
      </div>


      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <PanelCard title={L("نظرة عامة على الإيرادات", "Revenue Overview")} subtitle={L("الأداء الشهري", "Monthly performance")} className="lg:col-span-2">
          <div className="h-72">
            {filteredRevenue.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{L("لا توجد بيانات بعد", "No data yet")}</div>
            ) : (
            <ResponsiveContainer>
              <AreaChart data={filteredRevenue}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00AEC6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#00AEC6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3ebf3" />
                <XAxis dataKey="m" stroke="#7c8aa0" fontSize={12} />
                <YAxis stroke="#7c8aa0" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e3ebf3" }} />
                <Area type="monotone" dataKey="v" stroke="#00AEC6" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </PanelCard>

        <PanelCard title={L("المبيعات حسب التصنيف", "Sales by Category")} subtitle={L("توزيع الخدمات", "Service distribution")}>
          <div className="h-44">
            {byCat.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{L("لا توجد بيانات", "No data")}</div>
            ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCat} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {byCat.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
          <ul className="mt-3 space-y-1.5">
            {byCat.map((s) => (
              <li key={s.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="font-bold">{s.value}%</span>
              </li>
            ))}
          </ul>
        </PanelCard>
      </div>

      {/* Pending partner requests */}
      <PanelCard
        className="mb-6"
        title={L(`طلبات الشركاء قيد الانتظار (${pendingPartners.length})`, `Pending Partner Requests (${pendingPartners.length})`)}
        subtitle={L("ابدأ إجراءات اتفاقية الشراكة لكل مركز جديد لإرسال الشروط والعمولة قبل التفعيل", "Start the partnership agreement procedures for each new center to send terms and commission before activation")}
        action={<Link to="/admin/merchants" className="text-xs font-bold text-primary hover:underline">{L("عرض الكل ←", "View all →")}</Link>}
      >
        {pendingPartners.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-2 h-6 w-6 opacity-60" />
            {L("لا توجد طلبات بانتظار المراجعة حالياً", "No pending requests right now")}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className={`${dir === "rtl" ? "text-right" : "text-left"} text-xs text-muted-foreground`}>
                  <th className="px-3 py-2 font-medium">{L("المركز", "Center")}</th>
                  <th className="px-3 py-2 font-medium">{L("التصنيف · المدينة", "Category · City")}</th>
                  <th className="px-3 py-2 font-medium">{L("الجوال", "Phone")}</th>
                  <th className="px-3 py-2 font-medium">{L("تاريخ الطلب", "Submitted")}</th>
                  <th className="px-3 py-2 font-medium text-end">{L("إجراءات", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {pendingPartners.slice(0, 6).map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-xs font-extrabold text-white">
                          <Store className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground">{p.owner}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{p.category}</div>
                      <div className="text-[11px] text-muted-foreground">{p.city}</div>
                    </td>
                    <td className="px-3 py-3 text-xs" dir="ltr">{p.phone}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{p.joined}</td>
                    <td className="px-3 py-3 text-end">
                      <div className="inline-flex items-center gap-1">
                        <Link to="/admin/merchants" className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold hover:bg-muted">
                          {L("عرض", "View")}
                        </Link>
                        <Link to="/admin/agreements" className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {L("بدأ إجراءات الاتفاقية", "Start agreement procedures")}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>

      {/* Recent bookings + activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <PanelCard title={L("أحدث الحجوزات", "Latest Bookings")} className="lg:col-span-2" action={<a href="/admin/bookings" className="text-xs font-bold text-primary hover:underline">{L("عرض الكل ←", "View all →")}</a>}>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className={`${dir === "rtl" ? "text-right" : "text-left"} text-xs text-muted-foreground`}>
                  <th className="px-3 py-2 font-medium">{L("الحجز", "Booking")}</th>
                  <th className="px-3 py-2 font-medium">{L("العميل", "Customer")}</th>
                  <th className="px-3 py-2 font-medium">{L("الإجمالي", "Total")}</th>
                  <th className="px-3 py-2 font-medium">{L("الحالة", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">{L("لا توجد حجوزات بعد", "No bookings yet")}</td></tr>
                )}
                {bookings.slice(0, 5).map((b) => {
                  const s = bookingStatusMap[b.status as keyof typeof bookingStatusMap] ?? { tone: "primary" as const, label: b.status };
                  return (
                    <tr key={b.id} className="border-t border-border">
                      <td className="px-3 py-3 font-bold text-primary">#{b.number}</td>
                      <td className="px-3 py-3"><div className="font-medium">{b.client}</div><div className="text-[11px] text-muted-foreground">{b.service}</div></td>
                      <td className="px-3 py-3 font-bold">{fmtSAR(b.total)}</td>
                      <td className="px-3 py-3"><Pill tone={s.tone}>{bookingStatusLabel(b.status as any)}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PanelCard>

        <PanelCard title={L("آخر الأنشطة", "Recent Activity")}>
          <ul className="space-y-3 text-sm">
            {activity.length === 0 && (
              <li className="text-xs text-muted-foreground text-center py-4">{L("لا توجد أنشطة بعد", "No activity yet")}</li>
            )}
            {activity.map((a, i) => {
              const I = a.icon;
              const inner = (
                <>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><I className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.text}</div>
                    <div className="text-[11px] text-muted-foreground">{a.time}</div>
                  </div>
                </>
              );
              return (
                <li key={i}>
                  {a.link ? (
                    <Link to={a.link as any} className="flex items-start gap-3 rounded-xl p-2 -m-2 hover:bg-muted/60 transition">{inner}</Link>
                  ) : (
                    <div className="flex items-start gap-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </PanelCard>
      </div>
    </AdminLayout>
  );
}
