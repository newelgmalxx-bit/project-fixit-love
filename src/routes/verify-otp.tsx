import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, KeyRound, Loader2, AlertCircle, Check } from "lucide-react";
import { LangSwitch } from "@/components/layout/SiteHeader";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import { auth as authApi } from "@/lib/api/auth";
import { setToken, setUser as setStoredUser } from "@/lib/api/client";
import { partnerAuth, setStoredPartner } from "@/lib/api/partner";
import { toast } from "sonner";

function destinationFor(role?: string): string {
  if (role === "admin") return "/admin";
  if (role === "partner") return "/partner-dashboard";
  return "/account";
}

function VerifyOtpPage() {
  const { lang, dir, t, toggle } = useLang();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const search = useSearch({ from: "/verify-otp" }) as { email?: string; mode?: string };
  const emailFromQuery = search?.email || "";
  const mode: "signup" | "login" | "partner" =
    search?.mode === "login" ? "login" : search?.mode === "partner" ? "partner" : "signup";

  const [email, setEmail] = useState(emailFromQuery);
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (user) navigate({ to: destinationFor(user.role) as any });
  }, [user, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("auth.err.validEmail"));
      return;
    }
    if (!/^\d{4,8}$/.test(otp.trim())) {
      setError(t("auth.err.enterCode"));
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "partner") {
        const d: any = await partnerAuth.verifyLoginOtp({ email: email.trim(), otp: otp.trim() });
        if (d?.partner) setStoredPartner(d.partner);
        if (d?.user) setStoredUser(d.user);
        await refresh();
        toast.success(t("auth.loggedIn"));
        navigate({ to: "/partner-dashboard" as any });
        return;
      }
      const data: any = mode === "login"
        ? await authApi.verifyEmailOtp({ email: email.trim(), otp: otp.trim() })
        : await authApi.verifyRegisterOtp({ email: email.trim(), otp: otp.trim() });
      const token = data?.token ?? data?.data?.token;
      const u = data?.user ?? data?.data?.user;
      if (token) setToken(token);
      if (u) setStoredUser(u);
      await refresh();
      toast.success(mode === "login" ? t("auth.loggedIn") : t("auth.accountVerified"));
      navigate({ to: destinationFor(u?.role) as any });
    } catch (err: any) {
      setError(err?.message || t("auth.err.invalidExpiredCode"));
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setError(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("auth.err.validEmail"));
      return;
    }
    setResending(true);
    try {
      if (mode === "partner") {
        await partnerAuth.resendLoginOtp({ email: email.trim() });
      } else if (mode === "login") {
        await authApi.requestEmailOtp({ email: email.trim() });
      } else {
        await authApi.resendRegisterOtp({ email: email.trim() });
      }
      setInfo(t("auth.info.newCodeSent"));
      setCooldown(60);
    } catch (err: any) {
      setError(err?.message || t("auth.err.resendFailed"));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-8" dir={dir}>
      <div className={`absolute top-4 z-20 ${dir === "rtl" ? "left-4" : "right-4"} sm:top-6`}>
        <LangSwitch lang={lang} onClick={toggle} />
      </div>
      <div className="mx-auto flex max-w-md flex-col items-center justify-center pt-16">
        <div className="w-full rounded-3xl bg-white p-8 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)]">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound className="h-7 w-7" />
            </div>
          </div>
          <h1 className="text-center text-2xl font-extrabold text-foreground">
            {t("auth.verify.title")}
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {t("auth.verify.subtitle")}
          </p>

          {error && (
            <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="font-bold">{error}</div>
            </div>
          )}
          {info && !error && (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="font-bold">{info}</div>
            </div>
          )}

          <form className="mt-6 space-y-5" onSubmit={onSubmit}>
            <div className="text-start">
              <label className="mb-1.5 block text-xs font-bold text-foreground">
                {t("auth.email")}
              </label>
              <div className="relative">
                <span className={`pointer-events-none absolute inset-y-0 ${dir === "rtl" ? "left-3" : "right-3"} flex items-center text-muted-foreground`}>
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-border bg-white px-10 py-3 text-start text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

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
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-center text-lg tracking-[0.5em] placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={resend}
                disabled={resending || cooldown > 0}
                className="mt-2 text-xs font-bold text-primary hover:underline disabled:opacity-60"
              >
                {cooldown > 0
                  ? `${t("auth.resendIn")} ${cooldown}${t("auth.seconds")}`
                  : t("auth.resendCode")}
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting
                ? t("auth.verifying")
                : t("auth.verify")}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/login" className="font-bold text-primary hover:underline">
              {t("auth.backToLogin")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/verify-otp")({
  validateSearch: (s: Record<string, unknown>) => ({ email: (s.email as string) || "", mode: (s.mode as string) || "signup" }),
  component: VerifyOtpPage,
});
