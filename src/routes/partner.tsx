import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Sparkles, TrendingUp, Users, BadgeCheck, ShieldCheck, Headphones, Store, ArrowLeft, Check,
  Mail, Lock, Eye, EyeOff, Loader2, ClipboardCheck, Package as PackageIcon, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useCategories } from "@/hooks/useCatalog";
import { partnerAuth } from "@/lib/api/partner";
import { partnerPackagesPublic, type PartnerPackage } from "@/lib/api/partnerPackages";
import { fmtSAR } from "@/data/admin";
import { useLang } from "@/i18n/LanguageProvider";
import partnerHero from "@/assets/partner-hero.webp";

export const Route = createFileRoute("/partner")({
  head: () => ({
    meta: [
      { title: "Become a Partner | Koswmat" },
      { name: "description", content: "Join Koswmat's partner network in Saudi Arabia — register your center (medical, salon, cupping, fitness, lab, spa, car wash) and receive new bookings easily through your private dashboard." },
      { property: "og:title", content: "Become a Partner | Koswmat" },
      { property: "og:description", content: "Grow your business and reach new customers across 7 categories on Koswmat's platform in Saudi Arabia." },
      { property: "og:image", content: partnerHero },
    ],
  }),
  component: PartnerPage,
});

type Form = {
  vendorName: string;
  ownerName: string;
  category: string;
  city: string;
  phone: string;
  email: string;
  password: string;
  commercialNumber: string;
  notes: string;
};

const initial: Form = {
  vendorName: "", ownerName: "", category: "", city: "",
  phone: "", email: "", password: "", commercialNumber: "", notes: "",
};

function PartnerPage() {
  const { categories } = useCategories();
  const { lang, dir } = useLang();
  const L = <T extends React.ReactNode>(a: T, e: T): T => (lang === "en" ? e : a);
  const [f, setF] = useState<Form>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [packages, setPackages] = useState<PartnerPackage[]>([]);
  const [packageId, setPackageId] = useState<string>("");
  const [expandedPkg, setExpandedPkg] = useState<string>("");
  const navigate = useNavigate();
  const upd = <K extends keyof Form,>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const arrowFlip = dir === "ltr" ? "rotate-180" : "";

  const benefits = useMemo(() => [
    { icon: TrendingUp, title: L("زيادة الحجوزات", "More bookings"), text: L("وصول لآلاف العملاء الباحثين عن خدمتك يومياً في جميع التصنيفات", "Reach thousands of customers searching for your service daily across all categories") },
    { icon: Users, title: L("عملاء حقيقيون", "Real customers"), text: L("حجوزات مؤكدة ومدفوعة مسبقاً عبر المنصة", "Confirmed and prepaid bookings through the platform") },
    { icon: BadgeCheck, title: L("ملف موثّق", "Verified profile"), text: L("علامة توثيق وتقييمات حقيقية تبني ثقة عملائك", "Verification badge and real reviews that build customer trust") },
    { icon: ShieldCheck, title: L("مدفوعات آمنة", "Secure payments"), text: L("تسوية مالية أسبوعية مع تقارير مفصّلة", "Weekly settlements with detailed reports") },
    { icon: Headphones, title: L("دعم مخصّص", "Dedicated support"), text: L("مدير حساب يساعدك على رفع أدائك", "Account manager to help you grow") },
    { icon: Store, title: L("لوحة تحكم خاصة", "Private dashboard"), text: L("إدارة كاملة للعروض والحجوزات والإحصائيات لكل تصنيف", "Full management of offers, bookings, and analytics per category") },
  ], [lang]);

  const steps = useMemo(() => [
    { n: "01", title: L("سجّل بياناتك", "Register your details"), text: L("أنشئ حساب الشريك خلال دقيقتين", "Create a partner account in 2 minutes") },
    { n: "02", title: L("مراجعة من الإدارة", "Admin review"), text: L("نراجع طلبك ونرسل لك اتفاقية الشراكة مع نسبة العمولة", "We review your request and send the partnership agreement with the commission rate") },
    { n: "03", title: L("وقّع الاتفاقية", "Sign the agreement"), text: L("افتح اتفاقيتك من لوحة التحكم ووقّعها إلكترونياً", "Open the agreement from your dashboard and e-sign it") },
    { n: "04", title: L("تفعيل وبدء العمل", "Activation & start"), text: L("يتم تفعيل حسابك تلقائياً بعد التوقيع — أضف عروضك واستقبل الحجوزات", "Your account is activated automatically after signing — add offers and accept bookings") },
  ], [lang]);

  useEffect(() => {
    partnerPackagesPublic.list().then((list) => {
      setPackages(list);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.vendorName || !f.ownerName || !f.phone || !f.category || !f.city || !f.email || !f.password) {
      toast.error(L("يرجى تعبئة كل الحقول المطلوبة", "Please fill in all required fields"));
      return;
    }
    if (f.password.length < 8) {
      toast.error(L("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "Password must be at least 8 characters"));
      return;
    }
    setSubmitting(true);
    try {
      await partnerAuth.register({
        vendorName: f.vendorName,
        ownerName: f.ownerName,
        email: f.email.trim(),
        phone: f.phone,
        password: f.password,
        category: f.category,
        city: f.city,
        commercialNumber: f.commercialNumber || undefined,
        notes: f.notes || undefined,
        packageId: packageId || undefined,
      });
      setSubmitted(true);
      toast.success(L("تم استلام طلبك بنجاح. ستراجعه الإدارة وترسل لك اتفاقية الشراكة قريباً.", "Your request has been received. The admin will review it and send you the partnership agreement soon."));
      setF(initial);
      setTimeout(() => navigate({ to: "/partner-dashboard" as any }), 2000);
    } catch (err: any) {
      toast.error(err?.message || L("حدث خطأ، حاول مرة أخرى", "Something went wrong, please try again"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background" dir={dir}>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero with image */}
        <section className="relative overflow-hidden">
          <img
            src={partnerHero}
            alt={L("شراكة خصومات", "Koswmat Partnership")}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#3F2A6B]/85 via-[#5b3a8a]/75 to-[#E0254D]/80" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 text-white sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold backdrop-blur">
                <Sparkles className="h-3 w-3" /> {L("فرصة لأصحاب المراكز الطبية، الصالونات، الحجامة، اللياقة، المختبرات، السبا، وغسيل السيارات", "An opportunity for owners of medical centers, salons, cupping, fitness, labs, spa, and car wash centers")}
              </span>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight drop-shadow sm:text-5xl">
                {L(<>كن شريكاً مع <span className="text-amber-300">خصومات</span><br />ووسّع نشاطك</>, <>Become a partner with <span className="text-amber-300">Koswmat</span><br />and grow your business</>)}
              </h1>
              <p className="mt-4 max-w-lg text-base text-white/90">
                {L("انضم لأكثر من 500 مركز شريك على منصتنا في 7 تصنيفات مختلفة. سجّل مركزك واستلم لوحة تحكم خاصة بك تدير منها كل العروض والحجوزات والإيرادات.", "Join 500+ partner centers on our platform across 7 categories. Register your center and get a private dashboard to manage all offers, bookings, and revenue.")}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-bold">
                <a href="#partner-form" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-foreground shadow-lg transition hover:-translate-y-0.5">
                  {L("سجّل الآن مجاناً", "Register now for free")} <ArrowLeft className={`h-4 w-4 ${arrowFlip}`} />
                </a>
                <Link to={"/partner-login" as any} className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-3 text-white backdrop-blur transition hover:bg-white/20">
                  {L("لدي حساب شريك", "I have a partner account")}
                </Link>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                {[
                  { n: "+500", l: L("مركز شريك", "Partner centers") },
                  { n: "+10K", l: L("حجز شهري", "Monthly bookings") },
                  { n: "4.8★", l: L("رضا الشركاء", "Partner satisfaction") },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
                    <div className="text-xl font-black">{s.n}</div>
                    <div className="text-[11px] text-white/80">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="relative rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur">
                <div className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-white/80">{L("7 تصنيفات مفتوحة للشراكة", "7 categories open for partnership")}</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {categories.map((c) => {
                    const name = lang === "en" ? ((c as any).nameEn || c.nameAr) : c.nameAr;
                    return (
                      <div key={c.slug} className="group relative overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                        <img src={c.cover} alt={name} className="h-20 w-full object-cover opacity-80 transition group-hover:scale-110 group-hover:opacity-100" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-white">
                            <span>{c.icon}</span>
                            <span className="truncate">{name}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Form */}
        <section id="partner-form" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
            <div className="bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] p-6 text-white">
              <h2 className="text-2xl font-extrabold">{L("أنشئ حساب الشريك", "Create your partner account")}</h2>
              <p className="mt-1 text-sm text-white/85">{L("عبّي البيانات وهتحصل على لوحة تحكم خاصة بك بعد الموافقة", "Fill in the details — you'll get a private dashboard after approval")}</p>
            </div>

            {submitted && (
              <div className="m-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                <Check className="h-5 w-5" />
                <div className="text-sm font-bold">{L("تم استلام طلبك — جاري تحويلك للوحة التحكم", "Your request has been received — redirecting to the dashboard")}</div>
              </div>
            )}

            <form onSubmit={submit} className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
              <Field label={L("اسم المركز *", "Center name *")} value={f.vendorName} onChange={(v) => upd("vendorName", v)} placeholder={L("مثال: مركز لمسة جمال / مغسلة الصفوة", "e.g. Beauty Touch Center / Al-Safwa Car Wash")} />
              <Field label={L("اسم المسؤول *", "Manager name *")} value={f.ownerName} onChange={(v) => upd("ownerName", v)} placeholder={L("الاسم الكامل", "Full name")} />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-foreground">{L("التصنيف *", "Category *")}</label>
                <select
                  value={f.category}
                  onChange={(e) => upd("category", e.target.value)}
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">{L("اختر التصنيف", "Choose a category")}</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>{lang === "en" ? ((c as any).nameEn || c.nameAr) : c.nameAr}</option>
                  ))}
                </select>
              </div>
              <Field label={L("المدينة *", "City *")} value={f.city} onChange={(v) => upd("city", v)} placeholder={L("الرياض", "Riyadh")} />

              <Field label={L("رقم الجوال *", "Phone *")} value={f.phone} onChange={(v) => upd("phone", v)} placeholder="+966 5X XXX XXXX" type="tel" />
              <Field label={L("البريد الإلكتروني *", "Email *")} value={f.email} onChange={(v) => upd("email", v)} placeholder="you@example.com" type="email" icon={<Mail className="h-4 w-4" />} />

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-foreground">{L("كلمة المرور * (8 أحرف على الأقل)", "Password * (8 characters minimum)")}</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={f.password}
                    onChange={(e) => upd("password", e.target.value)}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-xl border border-border bg-background ps-9 pe-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Field label={L("السجل التجاري", "Commercial register")} value={f.commercialNumber} onChange={(v) => upd("commercialNumber", v)} placeholder="1010XXXXXX" className="sm:col-span-2" />

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-foreground">{L("ملاحظات إضافية", "Additional notes")}</label>
                <textarea
                  value={f.notes}
                  onChange={(e) => upd("notes", e.target.value)}
                  rows={3}
                  placeholder={L("عرّفنا أكتر عن نشاطك...", "Tell us more about your business...")}
                  className="rounded-xl border border-border bg-background p-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {packages.length > 0 && (
                <div className="sm:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-extrabold text-foreground">{L("طلبات إضافية ( الاشتراك في الاعلان الممول )", "Add-ons (Sponsored ads subscription)")} <span className="text-[11px] font-normal text-muted-foreground">— {L("اختياري", "optional")}</span></label>
                    <span className="text-[11px] text-muted-foreground">{L("السداد يتم خارج المنصة", "Payment is handled off-platform")}</span>
                  </div>
                  <div className="space-y-2">
                    {packages.map((p) => {
                      const checked = packageId === p.id;
                      const open = expandedPkg === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`rounded-2xl border-2 transition ${
                            checked ? "border-primary bg-primary/5" : "border-border bg-background"
                          }`}
                        >
                          <div className="flex items-center gap-3 p-3">
                            <button
                              type="button"
                              onClick={() => setPackageId(checked ? "" : p.id)}
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                                checked ? "border-primary bg-primary text-white" : "border-border bg-background"
                              }`}
                              aria-label={L("اختيار الباقة", "Select package")}
                            >
                              {checked && <Check className="h-3.5 w-3.5" />}
                            </button>
                            <PackageIcon className="h-4 w-4 text-primary shrink-0" />
                            <button
                              type="button"
                              onClick={() => setPackageId(checked ? "" : p.id)}
                              className="flex-1 text-start text-sm font-extrabold text-foreground"
                            >
                              {lang === "en" ? ((p as any).nameEn || p.nameAr || p.name) : (p.nameAr || p.name)}
                            </button>
                            <span className="text-sm font-black text-foreground">{fmtSAR(p.price)}</span>
                            <button
                              type="button"
                              onClick={() => setExpandedPkg(open ? "" : p.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={L("عرض التفاصيل", "Show details")}
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                            </button>
                          </div>
                          {open && (
                            <div className="border-t border-border/60 px-4 py-3">
                              {p.description && (
                                <p className="text-xs text-muted-foreground leading-6">{p.description}</p>
                              )}
                              {p.features && p.features.length > 0 && (
                                <ul className="mt-2 space-y-1.5">
                                  {p.features.map((feat, i) => (
                                    <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                      <span>{feat}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


              {/* Workflow notice */}
              <div className="sm:col-span-2 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <div className="text-xs leading-6 text-foreground/85">
                    {lang === "en" ? (
                      <>After sending the request, your center account is created with status <b className="text-primary">Under review</b>. The admin reviews your details and sends the partnership agreement (including your commission/deposit rate) to your partner dashboard. Once you e-sign the agreement, your account is <b className="text-primary">activated automatically</b> and you can add offers and accept bookings.</>
                    ) : (
                      <>بعد إرسال الطلب يتم إنشاء حساب مركزك بحالة <b className="text-primary">قيد المراجعة</b>. تقوم الإدارة بمراجعة بياناتك وإرسال اتفاقية الشراكة (تتضمّن نسبة العمولة/العربون الخاصة بمركزك) إلى لوحة تحكم الشريك. بمجرد توقيع الاتفاقية إلكترونياً من حسابك يتم <b className="text-primary">تفعيل الحساب تلقائياً</b> وتتمكن من إضافة العروض واستقبال الحجوزات.</>
                    )}
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-6 py-3.5 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {submitting ? L("جاري إرسال الطلب...", "Submitting...") : L("إرسال طلب الانضمام", "Send join request")}
                  {!submitting && <ArrowLeft className={`h-4 w-4 ${arrowFlip}`} />}
                </button>
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  {submitted ? L("تم استلام طلبك — جاري تحويلك للوحة التحكم...", "Your request has been received — redirecting to the dashboard...") : L("سيصلك إشعار داخل لوحة تحكم الشريك بمجرد إرسال الاتفاقية من الإدارة.", "You'll get a notification in your partner dashboard as soon as the admin sends the agreement.")}
                </p>
              </div>

            </form>
          </div>
        </section>

        {/* Benefits */}
        <section id="benefits" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
              {L("لماذا تنضم", "Why join")}{" "}
              <span className="bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] bg-clip-text text-transparent">{L("إلينا؟", "us?")}</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              {L("مزايا حقيقية تجعل شراكتك مع خصومات قراراً رابحاً", "Real benefits that make partnering with Koswmat a winning decision")}
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title} className="group rounded-3xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3F2A6B] to-[#E0254D] text-white shadow-md transition group-hover:scale-110">
                  <b.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold text-foreground">{b.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="bg-muted/30 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">{L("كيف نبدأ؟", "How do we start?")}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                {L("4 خطوات بسيطة ويصبح ملفك جاهزاً", "4 simple steps and your profile is ready")}
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s) => (
                <div key={s.n} className="relative rounded-3xl border border-border bg-card p-6">
                  <div className="text-4xl font-black bg-gradient-to-br from-[#3F2A6B] to-[#E0254D] bg-clip-text text-transparent">
                    {s.n}
                  </div>
                  <h3 className="mt-3 text-base font-extrabold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>


      <SiteFooter />
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", className = "", icon,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; className?: string; icon?: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-bold text-foreground">{label}</label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted-foreground">{icon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`h-11 w-full rounded-xl border border-border bg-background ${icon ? "ps-9" : "ps-3"} pe-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20`}
        />
      </div>
    </div>
  );
}
