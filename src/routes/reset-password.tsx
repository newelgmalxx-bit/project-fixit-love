import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import api, { ApiError } from "@/lib/api";
import { LangSwitch } from "@/components/layout/SiteHeader";
import { AuthHero } from "@/components/auth/AuthHero";

function ResetPasswordPage() {
  const { dir, lang, toggle, t } = useLang();
  const navigate = useNavigate();
  const search = useSearch({ from: "/reset-password" }) as { token?: string };
  const token = search?.token || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error(t("auth.err.invalidResetToken"));
      return;
    }
    if (password.length < 8) {
      toast.error(t("auth.err.pwdMin8"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("auth.err.pwdMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      await (api as any).auth.reset(token, password);
      toast.success(t("auth.reset.updated"));
      navigate({ to: "/login", search: { redirect: undefined } });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("auth.err.resetFailed");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function PwdField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
    return (
      <div className="text-start">
        <label className="mb-1.5 block text-xs font-bold text-foreground">{label}</label>
        <div className="relative">
          <span className={`pointer-events-none absolute inset-y-0 ${dir === "rtl" ? "left-3" : "right-3"} flex items-center text-muted-foreground`}>
            <Lock className="h-4 w-4" />
          </span>
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className={`absolute inset-y-0 ${dir === "rtl" ? "right-3" : "left-3"} flex items-center text-muted-foreground transition hover:text-primary`}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="••••••••"
            dir={dir}
            className="w-full rounded-xl border border-border bg-white px-10 py-3 text-start text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-8" dir={dir}>
      <div className={`absolute top-4 z-20 ${dir === "rtl" ? "left-4" : "right-4"} sm:top-6 ${dir === "rtl" ? "sm:left-6" : "sm:right-6"}`}>
        <LangSwitch lang={lang} onClick={toggle} />
      </div>
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)] lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <AuthHero />
        </div>
        <div className="order-1 lg:order-2 flex items-center px-4 py-10 sm:px-12 lg:py-14">
          <div className="mx-auto w-full max-w-md">
            <div className="text-start">
              <h1 className="text-3xl font-extrabold text-foreground">
                {t("auth.reset.title")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("auth.reset.subtitle")}
              </p>
              <div className={`mt-3 h-0.5 w-16 rounded-full bg-primary ${dir === "rtl" ? "mr-0 ml-auto" : "ml-0 mr-auto"}`} />
            </div>

            {!token && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 text-start">
                {t("auth.reset.invalidLink")}
              </div>
            )}

            <form className="mt-6 w-full space-y-5" onSubmit={onSubmit}>
              <PwdField value={password} onChange={setPassword} label={t("auth.reset.newPassword")} />
              <PwdField value={confirm} onChange={setConfirm} label={t("auth.reset.confirm")} />
              <button
                type="submit"
                disabled={submitting || !token}
                className="block w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-60"
              >
                {submitting
                  ? t("auth.saving")
                  : t("auth.reset.save")}
              </button>
            </form>

            <p className="mt-7 text-center text-xs text-muted-foreground">
              <Link to="/login" search={{ redirect: undefined }} className="font-bold text-primary hover:underline">
                {t("auth.backToLogin")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Reset Password | koswmat" },
      { name: "description", content: "إعادة تعيين كلمة المرور لحسابك في خصومات." },
    ],
  }),
  component: ResetPasswordPage,
});