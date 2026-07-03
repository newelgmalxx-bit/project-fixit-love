import { Link, useRouterState, Outlet, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Package, CalendarCheck, FileText, Users, Image as ImageIcon,
  BarChart3, FileSpreadsheet, Building2, Search, Target, CreditCard, Link2,
  UserCheck, Settings, ChevronDown, Bell, LogOut, Menu, User, Palette, Plug, Tag,
  Users2, BellRing, CheckCircle2, AlertCircle, ShoppingBag, LifeBuoy, Ticket, ExternalLink, Star, ScrollText, Store, MessageSquare,
  ClipboardCheck, Wallet, MapPin, Clock, Megaphone, Heart, Webhook, ShieldCheck, Layers,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import logoImg from "@/assets/booking-logo.png";
import { useLang } from "@/i18n/LanguageProvider";
import flagSa from "@/assets/flag-sa.jpg";
import flagUs from "@/assets/flag-us.jpg";
import { useAuth } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { toast } from "sonner";
import { admin as adminApi } from "@/lib/api";
import { adminNotificationsApi } from "@/lib/api/adminNotifications";
import { InvoiceDocument, type InvoiceData } from "@/components/invoice/InvoiceDocument";
import { renderInvoiceToPdf } from "@/lib/renderInvoice";
import { Download, Percent } from "lucide-react";
import { paymentMethods } from "@/data/admin";

type NavItem = { to: string; ar: string; en: string; icon: any; children?: { to: string; ar: string; en: string; icon: any }[] };

const navGroups: (NavItem | "sep")[] = [
  { to: "/admin", ar: "لوحة التحكم", en: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/bookings", ar: "الحجوزات", en: "Bookings", icon: CalendarCheck },
  { to: "/admin/verify", ar: "التحقق من الحجز", en: "Verify booking", icon: ShieldCheck } as any,
  { to: "/admin/schedule", ar: "إدارة المواعيد", en: "Schedule", icon: Clock },
  { to: "/admin/abandoned-carts", ar: "السلات المتروكة", en: "Abandoned carts", icon: ShoppingBag },
  
  

  { to: "/admin/merchants", ar: "إدارة المراكز", en: "Merchants", icon: Store },
  { to: "/admin/offers", ar: "إدارة العروض", en: "Offers management", icon: ClipboardCheck },
  { to: "/admin/agreements", ar: "اتفاقيات الشركاء", en: "Partner agreements", icon: ScrollText },
  { to: "/admin/partner-packages", ar: "باقات الشركاء", en: "Partner packages", icon: Tag },
  { to: "/admin/payouts", ar: "المدفوعات والسحوبات", en: "Payouts", icon: Wallet, disabled: true } as any,
  { to: "/admin/categories", ar: "التصنيفات", en: "Categories", icon: Tag },
  { to: "/admin/cities", ar: "المدن", en: "Cities", icon: MapPin },
  { to: "/admin/clients", ar: "العملاء", en: "Clients", icon: Users },
  { to: "/admin/tickets", ar: "التذاكر", en: "Tickets", icon: LifeBuoy },
  { to: "/admin/reviews", ar: "آراء العملاء", en: "Reviews", icon: Star },
  { to: "/admin/featured-offers", ar: "عروض اليوم المميزة", en: "Daily featured offers", icon: Tag },
  { to: "/admin/home-sliders", ar: "سلايدرات الرئيسية", en: "Home sliders", icon: Layers },
  { to: "/admin/sponsored-ads", ar: "الإعلانات الممولة", en: "Sponsored ads", icon: Megaphone },
  { to: "/admin/analytics", ar: "التحليلات", en: "Analytics", icon: BarChart3 },
  { to: "/admin/reports", ar: "التقارير", en: "Reports", icon: FileSpreadsheet },
  "sep",
  { to: "/admin/commission-requests", ar: "طلبات تعديل العمولة", en: "Commission requests", icon: Percent },
  "sep",
  { to: "/admin/site", ar: "إعدادات الموقع", en: "Site settings", icon: Building2 },
  { to: "/admin/seo", ar: "إعدادات SEO", en: "SEO settings", icon: Search },
  { to: "/admin/legal", ar: "الصفحات القانونية", en: "Legal pages", icon: ScrollText },
  { to: "/admin/partner", ar: "إعدادات API الشريك", en: "Partner API", icon: Link2 },
  { to: "/admin/tracking", ar: "التتبع والبكسلات", en: "Tracking & Pixels", icon: Target },
  "sep",
  { to: "/admin/users", ar: "إدارة المستخدمين", en: "Users", icon: UserCheck },
  "sep",
  {
    to: "/admin/settings", ar: "الإعدادات", en: "Settings", icon: Settings,
    children: [
      { to: "/admin/settings/profile", ar: "الملف الشخصي", en: "Profile", icon: User },
      { to: "/admin/settings/team", ar: "الفريق والصلاحيات", en: "Team & roles", icon: Users2 },
    ],
  },
];

export function AdminShell() {
  return (
    <AuthGuard requireAdmin>
      <Outlet />
    </AuthGuard>
  );
}

export function AdminLayout({ children, title, subtitle, action }: { children: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [openSettings, setOpenSettings] = useState(path.startsWith("/admin/settings"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    toast.success(L("تم تسجيل الخروج", "Signed out"));
    navigate({ to: "/login", search: { redirect: undefined } });
  }

  const initials = (user?.name || "U")
    .split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  const isActive = (to: string, exact = false) => exact ? path === to : path === to || path.startsWith(to + "/");

  // Notifications
  type Notif = { id: string; type?: string; title: string; desc?: string; time?: string; read?: boolean; link?: string };
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState<InvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const payLabel = (v: string) => {
    const m = paymentMethods.find((p) => p.value === v);
    return m ? L(m.labelAr, m.labelEn) : v;
  };

  const openInvoiceModal = async (invoiceId: string) => {
    setInvoiceLoading(true);
    try {
      const r: any = await adminApi.invoices.get(invoiceId);
      const i: any = r?.invoice || r?.data?.invoice || r?.data || r;
      if (!i) throw new Error("not found");
      const itemsRaw: any[] = Array.isArray(i.items) ? i.items : [];
      const items = itemsRaw.length > 0
        ? itemsRaw.map((it: any) => ({
            title: it.service_title || it.serviceTitle || it.title || it.desc || "—",
            qty: Number(it.qty || 1),
            price: Number(it.price) || 0,
          }))
        : [{ title: i.service || L("خدمات خصومات", "koswmat Services"), qty: 1, price: +(Number(i.total || 0) / 1.15).toFixed(2) }];
      const subtotal = +items.reduce((s, it) => s + it.price * it.qty, 0).toFixed(2);
      const total = Number(i.total) || +(subtotal * 1.15).toFixed(2);
      const vat = +(total - subtotal).toFixed(2);
      const status = i.status === "paid" ? "paid" : i.status === "void" ? "refunded" : "unpaid";
      setInvoiceModal({
        number: i.number || invoiceId,
        date: ((i.createdAt || i.created_at || "") + "").slice(0, 10),
        clientName: i.clientName || i.client_name || "",
        clientEmail: i.clientEmail || i.client_email || "",
        clientPhone: i.clientPhone || i.client_phone || "",
        clientCity: i.clientCity || i.client_city || "",
        paymentMethod: payLabel(i.paymentMethod || i.payment_method || ""),
        paymentStatus: status,
        items, subtotal, vat, total,
        lang: dir === "rtl" ? "ar" : "en",
      });
    } catch {
      toast.error(L("تعذّر تحميل الفاتورة", "Failed to load invoice"));
    } finally {
      setInvoiceLoading(false);
    }
  };

  const loadNotifs = async () => {
    setNotifLoading(true);
    try {
      const res = await adminNotificationsApi.list({ limit: 10 });
      const list: any[] = res.items;
      let readIds = new Set<string>();
      try {
        readIds = new Set<string>(JSON.parse(localStorage.getItem("saba_admin_notif_read") || "[]"));
      } catch { /* ignore */ }
      const mapped: Notif[] = (Array.isArray(list) ? list : []).map((n: any, idx: number) => ({
        id: String(n.id ?? idx),
        type: n.type ?? "primary",
        title: n.title ?? n.message ?? L("إشعار", "Notification"),
        desc: n.description ?? n.body ?? n.desc ?? "",
        time: n.time ?? n.created_at ?? n.createdAt ?? "",
        read: !!(n.read ?? n.is_read) || readIds.has(String(n.id ?? idx)),
        link: n.link ?? n.url ?? n.href ?? n.action_url ?? n.target ?? "",
      }));
      setNotifs(mapped);
    } catch {
      setNotifs([]);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    loadNotifs();
    const id = setInterval(loadNotifs, 30000);
    const onFocus = () => loadNotifs();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, []);

  const unread = notifs.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (!notifs.length) return;
    try {
      await adminNotificationsApi.markAllRead();
      setNotifs((arr) => arr.map((n) => ({ ...n, read: true })));
      try {
        const all = notifs.map((n) => n.id);
        const prev = JSON.parse(localStorage.getItem("saba_admin_notif_read") || "[]");
        localStorage.setItem("saba_admin_notif_read", JSON.stringify(Array.from(new Set([...prev, ...all]))));
      } catch { /* ignore */ }
    } catch (e: any) {
      toast.error(e?.message || L("تعذر التحديث", "Update failed"));
    }
  };

  const inferLink = (n: { type?: string; id: string }) => {
    const tp = (n.type || "").toLowerCase();
    if (tp.includes("order")) return "/admin/bookings";
    if (tp.includes("ticket")) return "/admin/tickets";
    if (tp.includes("invoice")) return "/admin/invoices";
    if (tp.includes("user") || tp.includes("client")) return "/admin/clients";
    return "";
  };
  const fmtTime = (t: string) => {
    if (!t) return "";
    const d = new Date(t);
    if (isNaN(d.getTime())) return t;
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return L("الآن", "Just now");
    if (diff < 3600) return L(`منذ ${Math.floor(diff / 60)} د`, `${Math.floor(diff / 60)}m ago`);
    if (diff < 86400) return L(`منذ ${Math.floor(diff / 3600)} س`, `${Math.floor(diff / 3600)}h ago`);
    return d.toLocaleDateString();
  };

  const iconFor = (type?: string) => {
    if (type === "order") return ShoppingBag;
    if (type === "payment" || type === "success") return CheckCircle2;
    if (type === "warning" || type === "alert") return AlertCircle;
    return BellRing;
  };
  const toneFor = (type?: string) => {
    if (type === "payment" || type === "success") return "bg-emerald-100 text-emerald-700";
    if (type === "warning" || type === "alert") return "bg-amber-100 text-amber-700";
    return "bg-primary/10 text-primary";
  };

  return (
    <div className="min-h-screen bg-muted/40 flex" dir={dir}>
      {/* Sidebar */}
      <aside className={`${mobileOpen ? "translate-x-0" : (dir === "rtl" ? "translate-x-full" : "-translate-x-full")} lg:translate-x-0 fixed lg:sticky top-0 ${dir === "rtl" ? "right-0 border-l" : "left-0 border-r"} z-40 h-screen w-72 shrink-0 border-border bg-card transition-transform overflow-y-auto`}>
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <img src={logoImg} alt="بوكينج" className="h-9 w-auto object-contain" />
          <div className="text-[11px] text-muted-foreground">{L("لوحة التحكم", "Admin panel")}</div>
        </div>
        <nav className="p-3 space-y-1 pb-10">
          {navGroups.map((g, i) => {
            if (g === "sep") return <div key={i} className="my-2 h-px bg-border" />;
            const Icon = g.icon;
            const active = g.children
              ? path.startsWith(g.to)
              : isActive(g.to, g.to === "/admin");
            if (g.children) {
              return (
                <div key={g.to}>
                  <button
                    onClick={() => setOpenSettings((v) => !v)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-primary/10 text-primary" : "text-foreground/75 hover:bg-muted"}`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {L(g.ar, g.en)}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition ${openSettings ? "rotate-180" : ""}`} />
                  </button>
                  {openSettings && (
                    <div className={`mt-1 ${dir === "rtl" ? "mr-4 border-r pr-3" : "ml-4 border-l pl-3"} space-y-1 border-border`}>
                      {g.children.map((c) => {
                        const CIcon = c.icon;
                        const cActive = isActive(c.to);
                        return (
                          <Link key={c.to} to={c.to as any} onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${cActive ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted"}`}>
                            <CIcon className="h-3.5 w-3.5" />
                            {L(c.ar, c.en)}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            if ((g as any).disabled) {
              return (
                <div key={g.to}
                  title={L("غير مفعّل — يتم سحب العمولة مقدماً من العميل", "Disabled — commission collected upfront from customer")}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/40 cursor-not-allowed select-none">
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{L(g.ar, g.en)}</span>
                  <span className="text-[10px] font-bold rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{L("معطّل", "Off")}</span>
                </div>
              );
            }
            return (
              <Link key={g.to} to={g.to as any} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/75 hover:bg-muted"}`}>
                <Icon className="h-4 w-4" />
                {L(g.ar, g.en)}
              </Link>
            );
          })}
          <div className="my-3 h-px bg-border" />
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50">
            <LogOut className="h-4 w-4" />
            {L("تسجيل الخروج", "Sign out")}
          </button>
        </nav>
      </aside>

      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur px-3 sm:px-6">
          <div className="flex flex-col gap-2 py-2 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label={L("القائمة", "Menu")}
              className="lg:hidden flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm hover:bg-muted active:scale-95 transition"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold truncate leading-tight">{title}</h1>
              {subtitle && <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto overflow-y-visible -mx-3 px-3 py-2 sm:mx-0 sm:px-0 sm:py-0 sm:overflow-visible">
            {action}
            <Link
              to={"/" as any}
              title={L("عرض الموقع", "View site")}
              className="hidden sm:inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-bold text-foreground/80 hover:border-primary hover:text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>{L("عرض الموقع", "View site")}</span>
            </Link>
            <Link
              to={"/" as any}
              aria-label={L("عرض الموقع", "View site")}
              className="sm:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
            <LangToggle />
            <Popover open={notifOpen} onOpenChange={(o) => { setNotifOpen(o); if (o) loadNotifs(); }}>
              <PopoverTrigger asChild>
                 <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted">
                  <Bell className="h-4 w-4" />
                  {unread > 0 && (
                    <span className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-card">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0" dir={dir}>
                <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                  <div className="font-bold text-sm">{L("الإشعارات", "Notifications")}</div>
                  {unread > 0 ? (
                    <button onClick={handleMarkAllRead} className="text-[11px] text-primary font-bold hover:underline">
                      {L("تعليم الكل كمقروء", "Mark all read")}
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">{L("لا جديد", "All read")}</span>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-border">
                  {notifLoading ? (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">{L("جارٍ التحميل…", "Loading…")}</div>
                  ) : notifs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">{L("لا توجد إشعارات", "No notifications")}</div>
                  ) : (
                    notifs.map((n) => {
                      const Ic = iconFor(n.type);
                      const handleClick = async () => {
                        if (!n.read) {
                          try { await adminNotificationsApi.markRead(n.id); } catch { /* ignore */ }
                          setNotifs((arr) => arr.map((x) => x.id === n.id ? { ...x, read: true } : x));
                          try {
                            const prev = JSON.parse(localStorage.getItem("saba_admin_notif_read") || "[]");
                            localStorage.setItem("saba_admin_notif_read", JSON.stringify(Array.from(new Set([...prev, n.id]))));
                          } catch { /* ignore */ }
                        }
                        setNotifOpen(false);
                        const target = n.link || inferLink(n);
                        if (!target) return;
                        if (/^https?:\/\//i.test(target)) { window.open(target, "_blank"); return; }
                        // Special handling for backend notification link patterns
                        const orderMatch = target.match(/^\/admin\/orders\/([^/?#]+)/);
                        const invoiceMatch = target.match(/^\/admin\/invoices\/([^/?#]+)/);
                        const contactMatch = target.match(/^\/admin\/contact-messages\//);
                        if (orderMatch) {
                          navigate({ to: "/admin/bookings" as any, search: { orderId: orderMatch[1] } as any });
                          return;
                        }
                        if (invoiceMatch) {
                          openInvoiceModal(invoiceMatch[1]);
                          return;
                        }
                        if (contactMatch) { navigate({ to: "/admin/clients" as any }); return; }
                        navigate({ to: target as any });
                      };
                      return (
                        <div key={n.id} onClick={handleClick} className={`flex gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer ${!n.read ? "bg-primary/5" : ""}`}>
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneFor(n.type)}`}>
                            <Ic className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold truncate">{n.title}</div>
                            {n.desc && <div className="text-xs text-muted-foreground truncate">{n.desc}</div>}
                            {n.time && <div className="text-[10px] text-muted-foreground mt-1">{fmtTime(n.time)}</div>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <Link
                  to={"/admin/settings/notifications" as any}
                  onClick={() => setNotifOpen(false)}
                  className="block w-full border-t border-border px-4 py-3 text-center text-xs font-bold text-primary hover:bg-muted/50"
                >
                  {L("إعدادات الإشعارات", "Notification settings")}
                </Link>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 hover:bg-muted transition">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{initials}</div>
                  <span className="hidden sm:block text-xs font-bold">{user?.name || L("المستخدم", "User")}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1" dir={dir}>
                <div className="px-3 py-2 border-b border-border mb-1">
                  <div className="text-sm font-bold truncate">{user?.name || L("المستخدم", "User")}</div>
                  {user?.email && <div className="text-[11px] text-muted-foreground truncate" dir="ltr">{user.email}</div>}
                </div>
                <Link to={"/admin/settings/profile" as any} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
                  <User className="h-4 w-4" />
                  {L("الملف الشخصي", "Profile")}
                </Link>
                <Link to={"/admin/settings/team" as any} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
                  <Settings className="h-4 w-4" />
                  {L("الإعدادات", "Settings")}
                </Link>
                <div className="my-1 h-px bg-border" />
                <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                  <LogOut className="h-4 w-4" />
                  {L("تسجيل الخروج", "Sign out")}
                </button>
              </PopoverContent>
            </Popover>
          </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children ?? <Outlet />}</main>
      </div>

      {/* Invoice popup (from notifications, anywhere in admin) */}
      <Dialog open={!!invoiceModal || invoiceLoading} onOpenChange={(o) => { if (!o) { setInvoiceModal(null); setInvoiceLoading(false); } }}>
        <DialogContent dir={dir} className="max-w-[860px] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>{L("الفاتورة", "Invoice")} {invoiceModal && <span dir="ltr">#{invoiceModal.number}</span>}</DialogTitle>
          </DialogHeader>
          {invoiceLoading && !invoiceModal && (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">{L("جارٍ التحميل...", "Loading...")}</div>
          )}
          {invoiceModal && (
            <div className="space-y-4 px-5 pb-5">
              <div className="overflow-x-auto rounded-xl border border-border bg-white">
                <div style={{ transform: "scale(0.92)", transformOrigin: "top center" }}>
                  <InvoiceDocument data={invoiceModal} />
                </div>
              </div>
              <div className="flex justify-end">
                <PrimaryButton onClick={() => renderInvoiceToPdf(invoiceModal)}>
                  <Download className="h-4 w-4" /> {L("تحميل PDF", "Download PDF")}
                </PrimaryButton>
              </div>
            </div>
          )}
          <DialogFooter className="px-5 pb-5">
            <GhostButton onClick={() => { setInvoiceModal(null); setInvoiceLoading(false); }}>{L("إغلاق", "Close")}</GhostButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* === Reusable bits === */

export function StatCard({ label, value, hint, icon: Icon, accent = "primary" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon: any; accent?: "primary" | "emerald" | "amber" | "rose" | "violet" | "muted" }) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-600",
    violet: "bg-violet-100 text-violet-700",
    muted: "bg-muted text-foreground/70",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {hint && <div data-ltr-number className="text-[11px] font-bold text-emerald-600">{hint}</div>}
      </div>
      <div data-ltr-number className="mt-4 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function PanelCard({ title, subtitle, action, children, className = "" }: { title?: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-base font-bold">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Pill({ tone = "muted", children }: { tone?: "primary" | "emerald" | "amber" | "rose" | "violet" | "muted" | "sky"; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary border-primary/20",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-600 border-rose-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    muted: "bg-muted text-foreground/70 border-border",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function PrimaryButton({ children, onClick, type = "button" }: { children: React.ReactNode; onClick?: () => void; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary-dark transition">
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold hover:bg-muted">
      {children}
    </button>
  );
}

function LangToggle() {
  const { lang, toggle } = useLang();
  const flag = lang === "ar" ? flagSa : flagUs;
  const code = lang === "ar" ? "AR" : "EN";
  return (
    <button onClick={toggle} title="تبديل اللغة / Toggle language" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-2 hover:bg-muted">
      <img src={flag} alt={code} className="h-4 w-6 object-cover rounded-sm" />
      <span className="text-[11px] font-bold">{code}</span>
    </button>
  );
}