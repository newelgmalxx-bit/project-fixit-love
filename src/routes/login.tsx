import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff, Phone, KeyRound, Check, Loader2, AlertCircle, Store } from "lucide-react";
import { AuthHero } from "@/components/auth/AuthHero";
import { LangSwitch } from "@/components/layout/SiteHeader";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import { auth as authApi } from "@/lib/api/auth";
import { setToken, setUser as setStoredUser } from "@/lib/api/client";
import { useGoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";

type Tab = "email" | "phone" | "otp";

function LoginPage() {
  const [tab, setTab] = useState<Tab>("email");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const { t, dir, lang, toggle } = useLang();
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" }) as { redirect?: string };
  const redirectTo = search?.redirect;
  const { user, login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRe = /^\+?\d[\d\s-]{6,}$/;

  function destinationFor(u: any): string {
    if (redirectTo) return redirectTo;
    const role = String(u?.role ?? u?.user_role ?? u?.type ?? u?.account_type ?? "").toLowerCase();
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("[login] user role detected:", role, "from user:", u);
    }
    if (role === "admin") return "/admin";
    if (role === "partner") return "/partner-dashboard";
    return "/account";
  }

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate({ to: destinationFor(user) as any });
  }, [user, navigate, redirectTo]);

  function goAfterLogin(u?: any) {
    toast.success(t("auth.loggedIn"));
    navigate({ to: destinationFor(u || user) as any });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier || !password) {
      setError(t("auth.err.fillFields"));
      return;
    }
    if (tab === "email" && !emailRe.test(identifier.trim())) {
      setError(t("auth.err.validEmail"));
      return;
    }
    if (tab === "phone" && !phoneRe.test(identifier.trim())) {
      setError(t("auth.err.validPhone"));
      return;
    }
    setSubmitting(true);
    try {
      const creds = tab === "email"
        ? { email: identifier.trim(), password }
        : { phone: identifier.trim(), password };
      const res: any = await login(creds);
      if (res?.requiresOtp) {
        const emailForOtp = res.email || (tab === "email" ? identifier.trim() : "");
        navigate({ to: "/verify-otp", search: { email: emailForOtp, mode: "login" } as any } as any);
        return;
      }
      goAfterLogin(res?.user);
    } catch (err: any) {
      setError(err?.message || t("auth.err.invalidCreds"));
    } finally {
      setSubmitting(false);
    }
  }

  async function requestOtp() {
    setError(null);
    setOtpInfo(null);
    if (!emailRe.test(otpEmail.trim())) {
      setError(t("auth.err.validEmail"));
      return;
    }
    setSubmitting(true);
    try {
      await authApi.requestEmailOtp({ email: otpEmail.trim() });
      setOtpSent(true);
      setOtpInfo(t("auth.info.codeSent"));
    } catch (err: any) {
      setError(err?.message || t("auth.err.sendCodeFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    if (!/^\d{4,8}$/.test(otpCode.trim())) {
      setError(t("auth.err.enterCode"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.verifyEmailOtp({ email: otpEmail.trim(), otp: otpCode.trim() });
      if (res.data?.token) setToken(res.data.token);
      if (res.data?.user) setStoredUser(res.data.user);
      goAfterLogin(res.data?.user);
    } catch (err: any) {
      setError(err?.message || t("auth.err.invalidCode"));
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
        if (res.data?.token) setToken(res.data.token);
        if (res.data?.user) setStoredUser(res.data.user);
        goAfterLogin(res.data?.user);
      } catch (err: any) {
        setError(err?.message || t("auth.err.googleSignIn"));
      } finally {
        setSubmitting(false);
      }
    },
    onError: () => {
      setError(t("auth.err.googleSignIn"));
    },
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
        <div className="order-2 hidden lg:order-1 lg:block">
          <AuthHero />
        </div>

        {/* Form side */}
        <div className="order-1 lg:order-2 flex items-center px-4 py-8 sm:px-12 sm:py-10 lg:py-14">
          <div className="mx-auto w-full max-w-md">
            <div className="text-start">
              <h1 className="text-3xl font-extrabold text-foreground">{t("auth.login.title")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("auth.login.subtitleAlt")}</p>
              <div className={`mt-3 h-0.5 w-16 rounded-full bg-primary ${dir === "rtl" ? "mr-0 ml-auto" : "ml-0 mr-auto"}`} />
            </div>

            {/* Tabs */}
            <div className="mt-7 grid grid-cols-3 gap-2 rounded-2xl bg-secondary/40 p-1.5">
              <button
                type="button"
                onClick={() => { setTab("email"); setError(null); }}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  tab === "email" ? "bg-white text-primary shadow-sm ring-1 ring-primary/30" : "text-muted-foreground"
                }`}
              >
                <Mail className="h-4 w-4" />
                {t("auth.tab.email")}
              </button>
              <button
                type="button"
                onClick={() => { setTab("phone"); setError(null); }}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  tab === "phone" ? "bg-white text-primary shadow-sm ring-1 ring-primary/30" : "text-muted-foreground"
                }`}
              >
                <Phone className="h-4 w-4" />
                {t("auth.tab.phone")}
              </button>
              <button
                type="button"
                onClick={() => { setTab("otp"); setError(null); }}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  tab === "otp" ? "bg-white text-primary shadow-sm ring-1 ring-primary/30" : "text-muted-foreground"
                }`}
              >
                <KeyRound className="h-4 w-4" />
                {lang === "ar" ? "OTP" : "OTP"}
              </button>
            </div>

            {error && (
              <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="font-bold">{error}</div>
              </div>
            )}

            {tab !== "otp" ? (
              <form className="mt-6 space-y-5" onSubmit={onSubmit}>
                <Field
                  label={tab === "email" ? t("auth.tab.email") : t("auth.tab.phone")}
                  type={tab === "email" ? "email" : "tel"}
                  placeholder={tab === "email" ? t("auth.emailPh") : t("auth.phonePh")}
                  icon={tab === "email" ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  dirCtx={dir}
                  value={identifier}
                  onChange={setIdentifier}
                />

                <div className="text-start">
                  <label className="mb-1.5 block text-xs font-bold text-foreground">{t("auth.password")}</label>
                  <div className="relative">
                    <span className={`pointer-events-none absolute inset-y-0 ${dir === "rtl" ? "left-3" : "right-3"} flex items-center text-muted-foreground`}>
                      <Lock className="h-4 w-4" />
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className={`absolute inset-y-0 ${dir === "rtl" ? "right-3" : "left-3"} flex items-center text-muted-foreground transition hover:text-primary`}
                      aria-label={t("auth.show")}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <input
                      type={showPwd ? "text" : "password"}
                      placeholder={t("auth.passwordPh")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-border bg-white px-10 py-3 text-start text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Link to="/forgot-password" className="text-xs font-bold text-primary hover:underline">{t("auth.forgot")}</Link>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                    <span>{t("auth.remember")}</span>
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
                  className="relative z-20 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-70"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? t("auth.signingIn") : t("auth.signIn")}
                </button>
              </form>
            ) : (
              <form
                className="mt-6 space-y-5"
                onSubmit={(e) => { e.preventDefault(); otpSent ? verifyOtp() : requestOtp(); }}
              >
                {otpInfo && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 text-start">
                    {otpInfo}
                  </div>
                )}
                <Field
                  label={t("auth.tab.email")}
                  type="email"
                  placeholder={t("auth.emailPh")}
                  icon={<Mail className="h-4 w-4" />}
                  dirCtx={dir}
                  value={otpEmail}
                  onChange={(v) => { setOtpEmail(v); if (otpSent) { setOtpSent(false); setOtpCode(""); } }}
                />
                {otpSent && (
                  <div className="text-start">
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      {t("auth.codeLabel")}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      placeholder="••••••"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full rounded-xl border border-border bg-white px-4 py-3 text-center text-lg tracking-[0.5em] placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={requestOtp}
                      disabled={submitting}
                      className="mt-2 text-xs font-bold text-primary hover:underline disabled:opacity-60"
                    >
                      {t("auth.resendCode")}
                    </button>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="relative z-20 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-70"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting
                    ? t("auth.working")
                    : otpSent
                      ? t("auth.verifyCode")
                      : t("auth.sendCode")}
                </button>
              </form>
            )}

            <div className="relative z-0 my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] text-muted-foreground">{t("auth.orSocial")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white py-3 text-sm font-bold text-foreground shadow-sm transition hover:border-primary hover:bg-secondary/40 disabled:opacity-60"
            >
              <GoogleIcon className="h-5 w-5" />
              {t("auth.googleSignIn")}
            </button>

            <Link
              to="/partner-login"
              search={{ redirect: undefined } as any}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-3 text-sm font-bold text-primary transition hover:bg-primary/10"
            >
              <Store className="h-4 w-4" />
              {t("auth.partnerSignIn")}
            </Link>

            <p className="mt-7 text-center text-xs text-muted-foreground">
              {t("auth.noAccount")}{" "}
              <Link to="/signup" className="font-bold text-primary hover:underline">
                {t("auth.signup.cta")}
              </Link>
            </p>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              <Link to="/" className="font-bold text-primary hover:underline">{t("auth.backHome")}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, placeholder, icon, dirCtx, value, onChange }: { label: string; type: string; placeholder: string; icon: React.ReactNode; dirCtx?: "rtl" | "ltr"; value?: string; onChange?: (v: string) => void }) {
  const isPhone = type === "tel";
  const d = dirCtx || "rtl";

  return (
    <div className="text-start">
      <label className="mb-1.5 block text-xs font-bold text-foreground">{label}</label>
      <div className="relative">
        <span className={`pointer-events-none absolute inset-y-0 ${d === "rtl" ? "left-3" : "right-3"} flex items-center text-muted-foreground`}>{icon}</span>
        <input
          type={type}
          dir={isPhone ? "ltr" : undefined}
          inputMode={isPhone ? "tel" : undefined}
          placeholder={placeholder}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={`w-full rounded-xl border border-border bg-white px-10 py-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${isPhone ? "text-left placeholder:text-left" : "text-start"}`}
        />
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.3 0-11.5-5.2-11.5-11.5S17.7 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.4 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.4 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.7 36.6 43.5 30.8 43.5 24c0-1.2-.1-2.3 .1-3.5z" />
    </svg>
  );
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign In | koswmat" },
      { name: "description", content: "Sign in to access your dashboard and manage your projects." },
    ],
  }),
  component: LoginPage,
});
