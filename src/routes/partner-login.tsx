import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { auth as authApi } from "@/lib/api/auth";
import { setToken, setUser as setStoredUser } from "@/lib/api/client";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Store,
  ShieldCheck,
  BarChart3,
  Headphones,
  CloudCog,
  Check,
  AlertCircle,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { partnerAuth } from "@/lib/api/partner";
import { LangSwitch } from "@/components/layout/SiteHeader";
import { useLang } from "@/i18n/LanguageProvider";
import partnerHero from "@/assets/partner-hero.webp";
import bookingLogo from "@/assets/booking-logo.png";

export const Route = createFileRoute("/partner-login")({
  head: () => ({
    meta: [
      { title: "Partner Login | Koswmat" },
      { name: "description", content: "Sign in to your partner dashboard to manage offers, bookings, and revenue on Koswmat." },
    ],
  }),
  component: PartnerLoginPage,
});

type Tab = "email" | "phone";

function PartnerLoginPage() {
  const [tab, setTab] = useState<Tab>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { lang, dir, toggle } = useLang();

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const phoneRe = /^\+?\d[\d\s-]{6,}$/;

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = tab === "email" ? email.trim() : phone.trim();
    if (!id || !password) {
      setError(lang === "ar" ? "يرجى تعبئة جميع الحقول" : "Please fill all fields");
      return;
    }
    if (tab === "email" && !emailRe.test(id)) {
      setError(lang === "ar" ? "أدخل بريدًا إلكترونيًا صحيحًا" : "Enter a valid email");
      return;
    }
    if (tab === "phone" && !phoneRe.test(id)) {
      setError(lang === "ar" ? "أدخل رقم جوال صحيح" : "Enter a valid phone number");
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await partnerAuth.login({ emailOrPhone: id, password });
      if (res?.requiresOtp) {
        const emailForOtp = res.email || (tab === "email" ? id : "");
        navigate({ to: "/verify-otp", search: { email: emailForOtp, mode: "partner" } as any } as any);
        return;
      }
      toast.success(lang === "ar" ? "مرحباً بك مجدداً" : "Welcome back");
      navigate({ to: "/partner-dashboard" as any });
    } catch (err: any) {
      const status = err?.status;
      const errs = err?.errors;
      const fieldMsg =
        errs && typeof errs === "object"
          ? Object.values(errs)
              .flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []))
              .map(String)
              .join(" — ")
          : "";
      let msg = err?.message;
      if (status === 409) {
        msg = err?.message || (lang === "ar"
          ? "يوجد أكثر من حساب مرتبط بهذا البريد/الجوال، تواصل مع الدعم لدمج الحسابات"
          : "Multiple accounts are linked to this email/phone. Please contact support to merge them.");
      } else if (status === 401 && fieldMsg) {
        msg = fieldMsg;
      } else if (!msg && fieldMsg) {
        msg = fieldMsg;
      }
      setError(msg || (lang === "ar" ? "البريد أو كلمة المرور غير صحيحة" : "Invalid email or password"));
    } finally {
      setSubmitting(false);
    }
  }

  const googleLogin = useGoogleLogin({
    flow: "implicit",
    onSuccess: async (tokenResponse) => {
      setError(null);
      setSubmitting(true);
      try {
        const res = await authApi.google((tokenResponse as any).access_token);
        const user = res.data?.user as any;
        const role = user?.role;
        if (role && role !== "partner" && role !== "admin") {
          setError(lang === "ar"
            ? "هذا الحساب ليس حساب شريك. الرجاء استخدام تسجيل دخول العملاء."
            : "This account is not a partner account. Please use the customer sign-in.");
          return;
        }
        if (res.data?.token) setToken(res.data.token);
        if (user) setStoredUser(user);
        toast.success(lang === "ar" ? "مرحباً بك" : "Welcome");
        if (role === "admin") navigate({ to: "/admin" as any });
        else navigate({ to: "/partner-dashboard" as any });
      } catch (err: any) {
        setError(err?.message || (lang === "ar" ? "فشل تسجيل الدخول بجوجل" : "Google sign-in failed"));
      } finally {
        setSubmitting(false);
      }
    },
    onError: () => setError(lang === "ar" ? "فشل تسجيل الدخول بجوجل" : "Google sign-in failed"),
  });

  function signInWithGoogle() {
    setError(null);
    googleLogin();
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-8" dir={dir}>
      <div className={`absolute top-4 z-20 ${dir === "rtl" ? "left-4" : "right-4"} sm:top-6 ${dir === "rtl" ? "sm:left-6" : "sm:right-6"}`}>
        <LangSwitch lang={lang} onClick={toggle} />
      </div>

      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)] lg:grid-cols-2">
        {/* Hero side */}
        <div className="order-2 hidden lg:order-1 lg:block">
          <PartnerAuthHero />
        </div>

        {/* Form side */}
        <div className="order-1 lg:order-2 flex items-center px-4 py-8 sm:px-12 sm:py-10 lg:py-14">
          <div className="mx-auto w-full max-w-md">
            <div className="text-start">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                <Store className="h-3 w-3" />
                {lang === "ar" ? "منطقة الشركاء" : "Partners area"}
              </span>
              <h1 className="mt-3 text-3xl font-extrabold text-foreground">
                {lang === "ar" ? "تسجيل دخول الشريك" : "Partner sign in"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {lang === "ar"
                  ? "ادخل لإدارة عروضك وحجوزاتك ومتابعة إيراداتك"
                  : "Manage your offers, bookings and revenue"}
              </p>
              <div className={`mt-3 h-0.5 w-16 rounded-full bg-primary ${dir === "rtl" ? "mr-0 ml-auto" : "ml-0 mr-auto"}`} />
            </div>

            {/* Tabs: Email / Phone */}
            <div className="mt-7 grid grid-cols-2 gap-2 rounded-2xl bg-secondary/40 p-1.5">
              <button
                type="button"
                onClick={() => { setTab("email"); setError(null); }}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  tab === "email" ? "bg-white text-primary shadow-sm ring-1 ring-primary/30" : "text-muted-foreground"
                }`}
              >
                <Mail className="h-4 w-4" />
                {lang === "ar" ? "البريد الإلكتروني" : "Email"}
              </button>
              <button
                type="button"
                onClick={() => { setTab("phone"); setError(null); }}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  tab === "phone" ? "bg-white text-primary shadow-sm ring-1 ring-primary/30" : "text-muted-foreground"
                }`}
              >
                <Phone className="h-4 w-4" />
                {lang === "ar" ? "رقم الهاتف" : "Phone"}
              </button>
            </div>

            {error && (
              <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="font-bold">{error}</div>
              </div>
            )}

            <form className="mt-6 space-y-5" onSubmit={onSubmitPassword}>
              {tab === "email" ? (
                <Field
                  label={lang === "ar" ? "البريد الإلكتروني" : "Email"}
                  type="email"
                  placeholder="you@example.com"
                  icon={<Mail className="h-4 w-4" />}
                  dirCtx={dir}
                  value={email}
                  onChange={setEmail}
                />
              ) : (
                <Field
                  label={lang === "ar" ? "رقم الهاتف" : "Phone"}
                  type="tel"
                  placeholder="+9665XXXXXXXX"
                  icon={<Phone className="h-4 w-4" />}
                  dirCtx={dir}
                  value={phone}
                  onChange={setPhone}
                />
              )}

              <div className="text-start">
                <label className="mb-1.5 block text-xs font-bold text-foreground">
                  {lang === "ar" ? "كلمة المرور" : "Password"}
                </label>
                <div className="relative">
                  <span className={`pointer-events-none absolute inset-y-0 ${dir === "rtl" ? "left-3" : "right-3"} flex items-center text-muted-foreground`}>
                    <Lock className="h-4 w-4" />
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className={`absolute inset-y-0 ${dir === "rtl" ? "right-3" : "left-3"} flex items-center text-muted-foreground transition hover:text-primary`}
                    aria-label={lang === "ar" ? "إظهار/إخفاء" : "Show/hide"}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-border bg-white px-10 py-3 text-start text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Link to="/forgot-password" className="text-xs font-bold text-primary hover:underline">
                  {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
                </Link>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                  <span>{lang === "ar" ? "تذكرني" : "Remember me"}</span>
                  <button
                    type="button"
                    onClick={() => setRemember(!remember)}
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                      remember ? "border-primary bg-primary text-white" : "border-border bg-white"
                    }`}
                  >
                    {remember && <Check className="h-3 w-3" />}
                  </button>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] py-3.5 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting
                  ? (lang === "ar" ? "جاري الدخول..." : "Signing in...")
                  : (lang === "ar" ? "دخول" : "Sign in")}
              </button>
            </form>


            {/* Google sign-in hidden for partners until backend adds /auth/partner/oauth/google */}

            <p className="mt-7 text-center text-xs text-muted-foreground">
              {lang === "ar" ? "ليس لديك حساب شريك؟" : "Don't have a partner account?"}{" "}
              <Link to="/partner" className="font-bold text-primary hover:underline">
                {lang === "ar" ? "إنشاء حساب شريك" : "Create partner account"}
              </Link>
            </p>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              <Link to="/" className="font-bold text-primary hover:underline">
                {lang === "ar" ? "العودة للرئيسية" : "Back to home"}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  placeholder,
  icon,
  dirCtx,
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder: string;
  icon: React.ReactNode;
  dirCtx?: "rtl" | "ltr";
  value?: string;
  onChange?: (v: string) => void;
}) {
  const d = dirCtx || "rtl";
  return (
    <div className="text-start">
      <label className="mb-1.5 block text-xs font-bold text-foreground">{label}</label>
      <div className="relative">
        <span className={`pointer-events-none absolute inset-y-0 ${d === "rtl" ? "left-3" : "right-3"} flex items-center text-muted-foreground`}>
          {icon}
        </span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className="w-full rounded-xl border border-border bg-white px-10 py-3 text-start text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.3 0-11.5-5.2-11.5-11.5S17.7 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.4 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.4 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.7 36.6 43.5 30.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function PartnerAuthHero() {
  const { lang, dir } = useLang();
  const features = [
    { icon: BarChart3, title: lang === "ar" ? "تقارير لحظية" : "Live reports", desc: lang === "ar" ? "تابع أداءك" : "Track perf." },
    { icon: CloudCog, title: lang === "ar" ? "إدارة العروض" : "Manage offers", desc: lang === "ar" ? "بسهولة" : "Effortless" },
    { icon: Headphones, title: lang === "ar" ? "دعم متخصص" : "Expert support", desc: lang === "ar" ? "٢٤/٧" : "24/7" },
    { icon: ShieldCheck, title: lang === "ar" ? "حماية كاملة" : "Full protection", desc: lang === "ar" ? "حسابك آمن" : "Secure" },
  ];
  const align = dir === "rtl" ? "text-right" : "text-left";
  const dividerAlign = dir === "rtl" ? "ms-auto" : "me-auto";
  return (
    <div
      dir={dir}
      className="relative flex h-full flex-col justify-between overflow-hidden p-6 text-white sm:p-10"
      style={{ background: "linear-gradient(135deg, #3F2A6B 0%, #5b3a8a 55%, #E0254D 100%)" }}
    >
      <img src={partnerHero} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

      <div className="relative flex justify-start">
        <img src={bookingLogo} alt="Booking" className="h-12 w-auto rounded-xl bg-white/95 p-2 shadow-lg sm:h-14" />
      </div>

      <div className={`relative mt-6 ${align}`}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold backdrop-blur">
          <Store className="h-3 w-3" />
          {lang === "ar" ? "منصة الشركاء" : "Partners platform"}
        </span>
        <h2 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">
          {lang === "ar" ? "نمِّ أعمالك معنا" : "Grow your business with us"}
        </h2>
        <div className={`my-3 h-0.5 w-16 rounded-full bg-white/60 ${dividerAlign}`} />
        <p className="text-xs leading-6 text-white/85 sm:text-sm sm:leading-7">
          {lang === "ar"
            ? "اعرض خدماتك أمام آلاف العملاء، استقبل الحجوزات، وتابع إيراداتك من لوحة واحدة احترافية."
            : "Showcase your services to thousands of customers, receive bookings and track revenue from one professional dashboard."}
        </p>
      </div>

      <div className="relative my-6 flex justify-center">
        <div className="w-full max-w-xs overflow-hidden rounded-3xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)] ring-1 ring-white/10 sm:max-w-sm lg:max-w-md">
          <img src={partnerHero} alt="" className="aspect-square w-full object-cover" />
        </div>
      </div>

      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur">
              <f.icon className="h-4 w-4" />
            </div>
            <div className="text-[11px] font-bold">{f.title}</div>
            <div className="text-[10px] text-white/70">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
