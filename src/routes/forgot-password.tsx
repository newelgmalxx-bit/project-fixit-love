import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import api, { ApiError } from "@/lib/api";
import { LangSwitch } from "@/components/layout/SiteHeader";
import { AuthHero } from "@/components/auth/AuthHero";

function ForgotPasswordPage() {
  const { t, dir, lang, toggle } = useLang();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.trim())) {
      toast.error(t("auth.err.validEmail"));
      return;
    }
    setSubmitting(true);
    try {
      await (api as any).auth.forgot(email.trim());
      setSent(true);
      toast.success(t("auth.info.recoverySent"));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("auth.err.sendFailed");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
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
        <div className="order-1 lg:order-2 flex items-center px-6 py-10 sm:px-12 lg:py-14">
          <div className="mx-auto w-full max-w-md">
            <div className="text-start">
              <h1 className="text-3xl font-extrabold text-foreground">
                {t("auth.forgot.title")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("auth.forgot.subtitle")}
              </p>
              <div className={`mt-3 h-0.5 w-16 rounded-full bg-primary ${dir === "rtl" ? "mr-0 ml-auto" : "ml-0 mr-auto"}`} />
            </div>

            {sent ? (
              <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 text-start">
                {t("auth.forgot.sent")}
              </div>
            ) : (
              <form className="mt-7 space-y-5" onSubmit={onSubmit}>
                <div className="text-start">
                  <label className="mb-1.5 block text-xs font-bold text-foreground">{t("auth.tab.email")}</label>
                  <div className="relative">
                    <span className={`pointer-events-none absolute inset-y-0 ${dir === "rtl" ? "left-3" : "right-3"} flex items-center text-muted-foreground`}>
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("auth.emailPh")}
                      className="w-full rounded-xl border border-border bg-white px-10 py-3 text-start text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-primary-dark disabled:opacity-60"
                >
                  {submitting
                    ? t("auth.sending")
                    : t("auth.forgot.send")}
                </button>
              </form>
            )}

            <p className="mt-7 text-center text-xs text-muted-foreground">
              <Link to="/login" search={{ redirect: undefined }} className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
                <ArrowLeft className={`h-3.5 w-3.5 ${dir === "rtl" ? "rotate-180" : ""}`} />
                {t("auth.backToLogin")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password | koswmat" },
      { name: "description", content: "استعادة كلمة المرور لحسابك في خصومات." },
    ],
  }),
  component: ForgotPasswordPage,
});