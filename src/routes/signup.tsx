import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, Phone, User, MapPin, Globe, Check, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { AuthHero } from "@/components/auth/AuthHero";
import { LangSwitch } from "@/components/layout/SiteHeader";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import { auth as authApi } from "@/lib/api/auth";
import { setToken, setUser as setStoredUser } from "@/lib/api/client";
import { useGoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";

function SignupPage() {
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [agree, setAgree] = useState(false);
  const { t, dir, lang, toggle } = useLang();
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!name || !phone || !email || !pwd) {
      setError(t("auth.err.fillFields"));
      return;
    }
    if (pwd.length < 6) {
      setError(t("auth.err.pwdMin6"));
      return;
    }
    if (pwd !== pwd2) {
      setError(t("auth.err.pwdMismatch"));
      return;
    }
    if (!agree) {
      setError(t("auth.err.mustAgree"));
      return;
    }
    setSubmitting(true);
    try {
      const result = await signup({ name, email: email.trim(), phone, password: pwd, city } as any);
      if ((result as any).requiresOtp) {
        setInfo(t("auth.info.signupCheckEmail"));
        navigate({ to: "/verify-otp", search: { email: email.trim() } as any } as any);
        return;
      }
      toast.success(t("auth.accountCreated"));
      const role = (result as any)?.user?.role;
      const dest = role === "admin" ? "/admin" : role === "partner" ? "/partner-dashboard" : "/account";
      navigate({ to: dest as any });
    } catch (err: any) {
      const msg = err?.message || "";
      if (/registered|already|مستخدم|موجود/i.test(msg)) {
        setError(t("auth.err.emailUsed"));
      } else {
        setError(msg || t("auth.err.signupFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const googleSignup = useGoogleLogin({
    flow: "implicit",
    onSuccess: async (tokenResponse) => {
      setError(null);
      setSubmitting(true);
      try {
        const res = await authApi.google((tokenResponse as any).access_token);
        if (res.data?.token) setToken(res.data.token);
        if (res.data?.user) setStoredUser(res.data.user);
        toast.success(t("auth.signedIn"));
        const role = (res.data?.user as any)?.role;
        if (role === "admin") navigate({ to: "/admin" as any });
        else if (role === "partner") navigate({ to: "/partner-dashboard" as any });
        else navigate({ to: "/account" });
      } catch (err: any) {
        setError(err?.message || t("auth.err.googleSignUp"));
      } finally {
        setSubmitting(false);
      }
    },
    onError: () => setError(t("auth.err.googleSignUp")),
  });

  function signUpWithGoogle() {
    setError(null);
    googleSignup();
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-8" dir={dir}>
      <div className={`absolute top-4 z-20 ${dir === "rtl" ? "left-4" : "right-4"} sm:top-6 ${dir === "rtl" ? "sm:left-6" : "sm:right-6"}`}>
        <LangSwitch lang={lang} onClick={toggle} />
      </div>
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)] lg:grid-cols-2">
        <div className="hidden lg:block">
          <AuthHero variant="signup" />
        </div>

        <div className="flex items-center px-4 py-8 sm:px-12 sm:py-10 lg:py-14">
          <div className="mx-auto w-full max-w-md">
            <div className="text-start">
              <h1 className="text-3xl font-extrabold text-foreground">{t("auth.signup.title")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("auth.signup.subtitleAlt")}</p>
              <div className={`mt-3 h-0.5 w-16 rounded-full bg-primary ${dir === "rtl" ? "mr-0 ml-auto" : "ml-0 mr-auto"}`} />
            </div>

            <form className="mt-7 space-y-5" onSubmit={onSubmit}>
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="font-bold">{error}</div>
                </div>
              )}
              {info && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 text-start font-bold">
                  {info}
                </div>
              )}
              <Field label={t("auth.name")} type="text" placeholder={t("auth.namePh")} icon={<User className="h-4 w-4" />} dirCtx={dir} value={name} onChange={setName} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("auth.tab.phone")} type="tel" placeholder={t("auth.phonePh")} icon={<Phone className="h-4 w-4" />} dirCtx={dir} value={phone} onChange={setPhone} />
                <Field label={t("auth.tab.email")} type="email" placeholder={t("auth.emailPh")} icon={<Mail className="h-4 w-4" />} dirCtx={dir} value={email} onChange={setEmail} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("auth.region")} type="text" placeholder={t("auth.regionPh")} icon={<MapPin className="h-4 w-4" />} dirCtx={dir} value={city} onChange={setCity} />
                <SelectField label={t("auth.preferredLang")} placeholder={t("auth.preferredLangPh")} icon={<Globe className="h-4 w-4" />} kind="lang" dirCtx={dir} t={t} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <PasswordField label={t("auth.password")} show={show1} onToggle={() => setShow1(!show1)} dirCtx={dir} ph={t("auth.passwordPh")} value={pwd} onChange={setPwd} />
                <PasswordField label={t("auth.confirmPassword")} show={show2} onToggle={() => setShow2(!show2)} dirCtx={dir} ph={t("auth.passwordPh")} value={pwd2} onChange={setPwd2} />
              </div>

              <label className="flex cursor-pointer items-center justify-start gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setAgree(!agree)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                    agree ? "border-primary bg-primary text-white" : "border-border bg-white"
                  }`}
                >
                  {agree && <Check className="h-3 w-3" />}
                </button>
                <span className="text-muted-foreground">
                  {t("auth.agree.lead")}{" "}
                  <Link to={"/privacy" as any} className="font-bold text-primary hover:underline">{t("auth.agree.privacy")}</Link>
                  {" "}{t("auth.agree.and")}{" "}
                  <Link to={"/terms" as any} className="font-bold text-primary hover:underline">{t("auth.agree.terms")}</Link>
                </span>
              </label>

              <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-70">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? t("auth.creating") : t("auth.signupBtn")}
              </button>
            </form>

            <div className="my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] text-muted-foreground">{t("auth.orSocial")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={signUpWithGoogle}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white py-3 text-sm font-bold text-foreground shadow-sm transition hover:border-primary hover:bg-secondary/40 disabled:opacity-60"
            >
              <GoogleIcon className="h-5 w-5" />
              {t("auth.googleSignUp")}
            </button>

            <p className="mt-7 text-center text-xs text-muted-foreground">
              {t("auth.haveAccount")}{" "}
              <Link to="/login" search={{ redirect: undefined }} className="font-bold text-primary hover:underline">{t("auth.login.cta")}</Link>
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
        <input type={type} dir={isPhone ? "ltr" : undefined} inputMode={isPhone ? "tel" : undefined} placeholder={placeholder} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} className={`w-full rounded-xl border border-border bg-white px-10 py-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${isPhone ? "text-left placeholder:text-left" : "text-start"}`} />
      </div>
    </div>
  );
}

function SelectField({ label, placeholder, icon, kind, dirCtx, t, value, onChange }: { label: string; placeholder: string; icon: React.ReactNode; kind: "region" | "lang"; dirCtx: "rtl" | "ltr"; t: (k: any) => string; value?: string; onChange?: (v: string) => void }) {
  return (
    <div className="text-start">
      <label className="mb-1.5 block text-xs font-bold text-foreground">{label}</label>
      <div className="relative">
        <span className={`pointer-events-none absolute inset-y-0 ${dirCtx === "rtl" ? "left-3" : "right-3"} flex items-center text-muted-foreground`}>{icon}</span>
        <span className={`pointer-events-none absolute inset-y-0 ${dirCtx === "rtl" ? "right-3" : "left-3"} flex items-center text-muted-foreground`}>
          <ChevronDown className="h-4 w-4" />
        </span>
        <SelectOptions placeholder={placeholder} kind={kind} t={t} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function SelectOptions({ placeholder, kind, t, value, onChange }: { placeholder: string; kind: "region" | "lang"; t: (k: any) => string; value?: string; onChange?: (v: string) => void }) {
  const opts = kind === "lang"
    ? [t("auth.lang.ar"), t("auth.lang.en")]
    : [t("auth.region.sa"), t("auth.region.ae"), t("auth.region.eg"), t("auth.region.kw"), t("auth.region.qa"), t("auth.region.bh"), t("auth.region.om"), t("auth.region.jo")];
  return (
    <select
      value={value ?? ""}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className="w-full appearance-none rounded-xl border border-border bg-white px-10 py-3 text-start text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
    >
      <option value="">{placeholder}</option>
      {opts.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function PasswordField({ label, show, onToggle, dirCtx, ph, value, onChange }: { label: string; show: boolean; onToggle: () => void; dirCtx: "rtl" | "ltr"; ph: string; value?: string; onChange?: (v: string) => void }) {
  return (
    <div className="text-start">
      <label className="mb-1.5 block text-xs font-bold text-foreground">{label}</label>
      <div className="relative">
        <span className={`pointer-events-none absolute inset-y-0 ${dirCtx === "rtl" ? "left-3" : "right-3"} flex items-center text-muted-foreground`}>
          <Lock className="h-4 w-4" />
        </span>
        <button type="button" onClick={onToggle} className={`absolute inset-y-0 ${dirCtx === "rtl" ? "right-3" : "left-3"} flex items-center text-muted-foreground transition hover:text-primary`}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <input type={show ? "text" : "password"} placeholder={ph} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} className="w-full rounded-xl border border-border bg-white px-10 py-3 text-start text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
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

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account | koswmat" },
      { name: "description", content: "Create your koswmat account and start managing your projects easily." },
    ],
  }),
  component: SignupPage,
});
