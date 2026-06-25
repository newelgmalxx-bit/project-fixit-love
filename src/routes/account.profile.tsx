import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { User, Mail, Phone, MapPin, Save, Lock, Loader2 } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import api, { account } from "@/lib/api";
import { toast } from "sonner";
import { uploadImage } from "@/lib/image";

export const Route = createFileRoute("/account/profile")({
  head: () => ({ meta: [{ title: "My Profile | koswmat" }] }),
  component: Profile,
});

function Profile() {
  const { t, dir } = useLang();
  const { user, refresh } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.avatar || "");
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    city: user?.city || "",
    avatar: (user?.name || "?").trim().charAt(0).toUpperCase(),
    joinedAt: (user?.createdAt || "").slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSent, setPwdSent] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        city: user.city || "",
        avatar: (user.name || "?").trim().charAt(0).toUpperCase(),
        joinedAt: (user.createdAt || "").slice(0, 10),
      });
      setAvatarUrl(user.avatar || "");
    }
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await account.updateProfile({ name: form.name, phone: form.phone, city: form.city });
      await refresh();
      setSaved(true);
      toast.success(t("account.profile.saved"));
      setTimeout(() => setSaved(false), 2200);
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!form.email) {
      toast.error(dir === "rtl" ? "لا يوجد بريد إلكتروني مرتبط بالحساب" : "No email on this account");
      return;
    }
    setPwdLoading(true);
    try {
      await (api as any).auth.forgot(form.email.trim());
      setPwdSent(true);
      toast.success(
        dir === "rtl"
          ? `تم إرسال رابط تغيير كلمة المرور إلى ${form.email}`
          : `Password reset link sent to ${form.email}`
      );
    } catch (err: any) {
      toast.error(err?.message || (dir === "rtl" ? "تعذّر إرسال الرابط" : "Failed to send reset link"));
    } finally {
      setPwdLoading(false);
    }
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImage(f);
      setAvatarUrl(url);
      await account.updateProfile({
        name: form.name,
        phone: form.phone || undefined,
        city: form.city || undefined,
        avatar: url,
      });
      await refresh();
      toast.success(t("account.profile.saved"));
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <AccountLayout title={t("account.profile.title")} subtitle={t("account.profile.subtitle")}>
      <form onSubmit={save} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt={form.name} className="h-20 w-20 rounded-full object-cover shadow-lg" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-3xl font-bold text-white shadow-lg">
              {form.avatar}
            </div>
          )}
          <div className={`flex-1 text-center ${dir === "rtl" ? "sm:text-right" : "sm:text-left"}`}>
            <h2 className="text-lg font-bold">{form.name}</h2>
            <p className="text-sm text-muted-foreground">{t("account.profile.memberSince")} {form.joinedAt}</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-bold hover:bg-muted disabled:opacity-60"
          >
            {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("account.profile.changeAvatar")}
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field icon={User} label={t("account.profile.fullName")} value={form.name} onChange={(v) => setForm({ ...form, name: v })} dir={dir} />
          <Field icon={Mail} label={t("account.profile.email")} value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" dir={dir} />
          <Field icon={Phone} label={t("account.profile.phone")} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} type="tel" dir={dir} />
          <Field icon={MapPin} label={t("account.profile.city")} value={form.city} onChange={(v) => setForm({ ...form, city: v })} dir={dir} />
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
          {saved ? (
            <span className="text-sm font-bold text-emerald-600">{t("account.profile.saved")}</span>
          ) : <span />}
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("account.profile.save")}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold">{t("account.profile.password")}</h3>
            <p className="text-xs text-muted-foreground">
              {dir === "rtl"
                ? "سنرسل رابط تغيير كلمة المرور إلى بريدك الإلكتروني"
                : "We'll email you a secure link to change your password"}
            </p>
          </div>
          <button
            type="button"
            onClick={requestPasswordReset}
            disabled={pwdLoading}
            className="ms-auto inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-bold hover:bg-muted disabled:opacity-60"
          >
            {pwdLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {pwdLoading
              ? (dir === "rtl" ? "جاري الإرسال..." : "Sending...")
              : t("account.profile.changePassword")}
          </button>
        </div>
        {pwdSent && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
            {dir === "rtl"
              ? `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${form.email}. افتح بريدك الإلكتروني واتبع الرابط لتغيير كلمة المرور.`
              : `A password reset link has been sent to ${form.email}. Open your inbox and follow the link to change your password.`}
          </div>
        )}
      </div>
    </AccountLayout>
  );
}

function Field({ icon: Icon, label, value, onChange, type = "text", dir = "rtl" }: { icon: any; label: string; value: string; onChange: (v: string) => void; type?: string; dir?: "rtl" | "ltr" }) {
  const isPhone = type === "tel";
  const sideClass = dir === "rtl" ? "right-3" : "left-3";
  const padSide = dir === "rtl" ? "pr-10 pl-3" : "pl-10 pr-3";
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold">{label}</label>
      <div className="relative">
        <Icon className={`absolute ${sideClass} top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground`} />
        <input
          type={isPhone ? "tel" : type}
          dir={isPhone ? "ltr" : undefined}
          inputMode={isPhone ? "tel" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border border-border bg-background py-2.5 ${padSide} text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${isPhone ? "text-left" : ""}`}
        />
      </div>
    </div>
  );
}