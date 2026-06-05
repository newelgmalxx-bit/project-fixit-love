import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, PanelCard, PrimaryButton } from "@/components/admin/AdminLayout";
import { useState, useEffect } from "react";
import { Upload, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/image";
import { useLang } from "@/i18n/LanguageProvider";
import { admin as adminApi } from "@/lib/api";


export const Route = createFileRoute("/admin/site")({
  head: () => ({ meta: [{ title: "Site Settings | Admin" }] }),
  component: SiteSettingsPage,
});

function SiteSettingsPage() {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const [s, setS] = useState<any>({
    name: "خصومات", nameAr: "خصومات", nameEn: "koswmat",
    tagline: L("وكالتك الإبداعية لتصميم وتطوير المواقع والتطبيقات", "Your creative agency for web and app design & development"),
    descriptionAr: "", descriptionEn: "",
    email: "info@saba.sa", phone: "+966 55 000 0000", whatsapp: "",
    address: L("الرياض، المملكة العربية السعودية", "Riyadh, Saudi Arabia"),
    logo: "", invoiceLogo: "", favicon: "",
    facebook: "", instagram: "", twitter: "", linkedin: "", youtube: "", tiktok: "", snapchat: "",
    workHours: L("الأحد - الخميس · 9 ص - 6 م", "Sun - Thu · 9 AM - 6 PM"),
    maintenanceMode: false, primaryLang: "ar", currency: "SAR", vatPercent: 15,
    seo: { metaTitle: "", metaDescription: "", ogImage: "" },
    company: {
      logo: "", nameAr: "", nameEn: "", commercialRegister: "", taxNumber: "",
      addressAr: "", addressEn: "", phone: "", email: "", website: "",
      iban: "", bankName: "", invoiceFooterNoteAr: "", invoiceFooterNoteEn: "",
    },
  });
  const setC = (k: string, v: string) => setS((cur: any) => ({ ...cur, company: { ...(cur.company || {}), [k]: v } }));

  const setSeo = (k: string, v: string) => setS((cur: any) => ({ ...cur, seo: { ...(cur.seo || {}), [k]: v } }));

  useEffect(() => {
    (async () => {
      try {
        const raw: any = await adminApi.settings.get<any>("site");
        // Backend may return { items: {...} } / { settings: { site: {...}, company: {...} } } or flat
        const data = raw?.items ?? raw;
        const siteNested = data?.site ?? raw?.settings?.site ?? {};
        const companyNested = data?.company ?? raw?.settings?.company ?? {};
        const merged = { ...siteNested, ...data };
        if (merged && typeof merged === "object") {
          setS((cur: any) => ({
            ...cur,
            ...merged,
            seo: { ...(cur.seo || {}), ...((merged as any).seo && !Array.isArray((merged as any).seo) ? (merged as any).seo : {}) },
            company: { ...(cur.company || {}), ...(companyNested || {}) },
          }));
        }
      } catch {}
    })();
  }, []);

  const save = async () => {
    try { await adminApi.settings.update("site", s); toast.success(L("تم حفظ الإعدادات", "Settings saved")); }
    catch (e: any) { toast.error(e?.message || "Save failed"); }
  };
  const upload = (k: "logo" | "invoiceLogo" | "favicon") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setS({ ...s, [k]: await uploadImage(f) });
  };
  return (
    <AdminLayout title={L("إعدادات الموقع", "Site Settings")} subtitle={L("معلومات الشركة والهوية والتواصل", "Company info, identity, and contact")} action={<PrimaryButton onClick={save}>{L("حفظ التغييرات", "Save Changes")}</PrimaryButton>}>
      <div className="grid gap-6 lg:grid-cols-3">
        <PanelCard title={L("الهوية والشعار", "Identity & Logo")} className="lg:col-span-1">
          <div className="space-y-4">
            <Img label={L("الشعار العام", "Site Logo")} value={s.logo} onChange={upload("logo")} onClear={() => setS({ ...s, logo: "" })} t={L} />
            <Img label={L("شعار الفاتورة (نسخة بيضاء/فاتحة)", "Invoice Logo (white/light)")} value={s.invoiceLogo} onChange={upload("invoiceLogo")} onClear={() => setS({ ...s, invoiceLogo: "" })} t={L} />
            <Img label={L("أيقونة المتصفح Favicon", "Favicon")} value={s.favicon} onChange={upload("favicon")} onClear={() => setS({ ...s, favicon: "" })} small t={L} />
          </div>
        </PanelCard>

        <PanelCard title={L("معلومات أساسية", "Basic Information")} className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <Lbl label={L("اسم الموقع", "Site Name")}><input className={ic} value={s.name || ""} onChange={e => setS({ ...s, name: e.target.value })} /></Lbl>
            <Lbl label={L("الشعار النصي (Tagline)", "Tagline")}><input className={ic} value={s.tagline || ""} onChange={e => setS({ ...s, tagline: e.target.value })} /></Lbl>
            <Lbl label={L("الاسم بالعربية", "Name (Arabic)")}><input className={ic} value={s.nameAr || ""} onChange={e => setS({ ...s, nameAr: e.target.value })} /></Lbl>
            <Lbl label={L("الاسم بالإنجليزية", "Name (English)")}><input className={ic} dir="ltr" value={s.nameEn || ""} onChange={e => setS({ ...s, nameEn: e.target.value })} /></Lbl>
            <Lbl label={L("البريد الإلكتروني", "Email")}><input className={ic} value={s.email || ""} onChange={e => setS({ ...s, email: e.target.value })} /></Lbl>
            <Lbl label={L("رقم الجوال", "Phone")}><input type="tel" inputMode="tel" className={ic} dir="ltr" value={s.phone || ""} onChange={e => setS({ ...s, phone: e.target.value })} /></Lbl>
            <Lbl label={L("رقم واتساب", "WhatsApp Number")}><input type="tel" inputMode="tel" className={ic} dir="ltr" placeholder="+9665xxxxxxxx" value={s.whatsapp || ""} onChange={e => setS({ ...s, whatsapp: e.target.value })} /></Lbl>
            <Lbl label={L("ساعات العمل", "Work Hours")}><input className={ic} value={s.workHours || ""} onChange={e => setS({ ...s, workHours: e.target.value })} /></Lbl>
            <Lbl label={L("العنوان", "Address")} full><input className={ic} value={s.address || ""} onChange={e => setS({ ...s, address: e.target.value })} /></Lbl>
            <Lbl label={L("نص تذييل الموقع (Footer)", "Footer Description")} full><textarea rows={3} className={ic} placeholder={L("هذا النص يظهر في تذييل الموقع تحت الشعار", "This text appears in the site footer under the logo")} value={s.footerDescription || ""} onChange={e => setS({ ...s, footerDescription: e.target.value })} /></Lbl>
            <Lbl label={L("وصف الموقع (عربي)", "Description (AR)")} full><textarea rows={2} className={ic} value={s.descriptionAr || ""} onChange={e => setS({ ...s, descriptionAr: e.target.value })} /></Lbl>
            <Lbl label={L("وصف الموقع (إنجليزي)", "Description (EN)")} full><textarea rows={2} className={ic} dir="ltr" value={s.descriptionEn || ""} onChange={e => setS({ ...s, descriptionEn: e.target.value })} /></Lbl>
            <Lbl label={L("اللغة الافتراضية", "Default Language")}>
              <select className={ic} value={s.primaryLang} onChange={e => setS({ ...s, primaryLang: e.target.value })}>
                <option value="ar">العربية</option><option value="en">English</option>
              </select>
            </Lbl>
            <Lbl label={L("العملة", "Currency")}>
              <select className={ic} value={s.currency} onChange={e => setS({ ...s, currency: e.target.value })}>
                <option value="SAR">{L("ريال سعودي", "Saudi Riyal")} (SAR)</option><option value="USD">{L("دولار أمريكي", "US Dollar")} (USD)</option><option value="AED">{L("درهم إماراتي", "UAE Dirham")} (AED)</option>
              </select>
            </Lbl>
            <Lbl label={L("نسبة الضريبة %", "VAT %")}><input type="number" className={ic} dir="ltr" value={s.vatPercent ?? 15} onChange={e => setS({ ...s, vatPercent: Number(e.target.value) })} /></Lbl>
          </div>
        </PanelCard>

        <PanelCard title={L("إعدادات SEO", "SEO Settings")} className="lg:col-span-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Lbl label={L("عنوان الصفحة (Meta Title)", "Meta Title")}><input className={ic} value={s.seo?.metaTitle || ""} onChange={e => setSeo("metaTitle", e.target.value)} /></Lbl>
            <Lbl label={L("صورة المشاركة OG Image", "OG Image URL")}><input className={ic} dir="ltr" value={s.seo?.ogImage || ""} onChange={e => setSeo("ogImage", e.target.value)} /></Lbl>
            <Lbl label={L("الوصف (Meta Description)", "Meta Description")} full><textarea rows={2} className={ic} value={s.seo?.metaDescription || ""} onChange={e => setSeo("metaDescription", e.target.value)} /></Lbl>
          </div>
        </PanelCard>

        <PanelCard title={L("روابط التواصل الاجتماعي", "Social Media Links")} className="lg:col-span-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(["facebook","instagram","twitter","linkedin","tiktok","snapchat"] as const).map(k => (
              <Lbl key={k} label={k}><input className={ic} dir="ltr" placeholder={`https://${k}.com/...`} value={(s as any)[k]} onChange={e => setS({ ...s, [k]: e.target.value })} /></Lbl>
            ))}
          </div>
        </PanelCard>

        <PanelCard title={L("بيانات الشركة (تظهر في الفاتورة)", "Company Info (shown on invoice)")} className="lg:col-span-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Lbl label={L("الاسم بالعربية", "Name (Arabic)")}><input className={ic} value={s.company?.nameAr || ""} onChange={e => setC("nameAr", e.target.value)} /></Lbl>
            <Lbl label={L("الاسم بالإنجليزية", "Name (English)")}><input className={ic} dir="ltr" value={s.company?.nameEn || ""} onChange={e => setC("nameEn", e.target.value)} /></Lbl>
            <Lbl label={L("السجل التجاري", "Commercial Register")}><input className={ic} dir="ltr" placeholder="10 digits" value={s.company?.commercialRegister || ""} onChange={e => setC("commercialRegister", e.target.value)} /></Lbl>
            <Lbl label={L("الرقم الضريبي", "Tax Number")}><input className={ic} dir="ltr" placeholder="3xxxxxxxxxxx03" value={s.company?.taxNumber || ""} onChange={e => setC("taxNumber", e.target.value)} /></Lbl>
            <Lbl label={L("الجوال", "Phone")}><input className={ic} dir="ltr" value={s.company?.phone || ""} onChange={e => setC("phone", e.target.value)} /></Lbl>
            <Lbl label={L("البريد", "Email")}><input className={ic} dir="ltr" value={s.company?.email || ""} onChange={e => setC("email", e.target.value)} /></Lbl>
            <Lbl label={L("الموقع الإلكتروني", "Website")}><input className={ic} dir="ltr" value={s.company?.website || ""} onChange={e => setC("website", e.target.value)} /></Lbl>
            <Lbl label={L("اسم البنك", "Bank Name")}><input className={ic} value={s.company?.bankName || ""} onChange={e => setC("bankName", e.target.value)} /></Lbl>
            <Lbl label="IBAN"><input className={ic} dir="ltr" placeholder="SA..." value={s.company?.iban || ""} onChange={e => setC("iban", e.target.value)} /></Lbl>
            <Lbl label={L("العنوان بالعربية", "Address (Arabic)")} full><input className={ic} value={s.company?.addressAr || ""} onChange={e => setC("addressAr", e.target.value)} /></Lbl>
            <Lbl label={L("العنوان بالإنجليزية", "Address (English)")} full><input className={ic} dir="ltr" value={s.company?.addressEn || ""} onChange={e => setC("addressEn", e.target.value)} /></Lbl>
            <Lbl label={L("ملاحظة تذييل الفاتورة (عربي)", "Invoice Footer Note (AR)")} full><textarea rows={2} className={ic} value={s.company?.invoiceFooterNoteAr || ""} onChange={e => setC("invoiceFooterNoteAr", e.target.value)} /></Lbl>
            <Lbl label={L("ملاحظة تذييل الفاتورة (إنجليزي)", "Invoice Footer Note (EN)")} full><textarea rows={2} className={ic} dir="ltr" value={s.company?.invoiceFooterNoteEn || ""} onChange={e => setC("invoiceFooterNoteEn", e.target.value)} /></Lbl>
          </div>
        </PanelCard>

        <PanelCard title={L("شروط الإلغاء (تظهر للعميل عند الحجز)", "Cancellation Terms (shown to clients at booking)")} className="lg:col-span-3">
          <CancellationTermsEditor
            value={Array.isArray(s.cancellationTerms) ? s.cancellationTerms : []}
            onChange={(next) => setS({ ...s, cancellationTerms: next })}
            L={L}
          />
        </PanelCard>

        <PanelCard title={L("الأسئلة الشائعة (تظهر في صفحة العرض)", "FAQs (shown on offer page)")} className="lg:col-span-3">
          <FaqsEditor
            value={Array.isArray(s.faqs) ? s.faqs : []}
            onChange={(next) => setS({ ...s, faqs: next })}
            L={L}
          />
        </PanelCard>

        <PanelCard title={L("وضع الصيانة", "Maintenance Mode")} className="lg:col-span-3">
          <label className="flex items-center gap-3">
            <input type="checkbox" className="h-4 w-4" checked={s.maintenanceMode} onChange={e => setS({ ...s, maintenanceMode: e.target.checked })} />
            <span className="text-sm font-medium">{L("تفعيل وضع الصيانة (سيظهر للزوار صفحة \"الموقع تحت الصيانة\")", "Enable maintenance mode (visitors will see \"Site under maintenance\")")}</span>
          </label>
        </PanelCard>

      </div>
    </AdminLayout>
  );
}

const ic = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
function Lbl({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`text-xs font-bold space-y-1.5 block ${full ? "sm:col-span-2 lg:col-span-3" : ""}`}>{label}{children}</label>;
}
function Img({ label, value, onChange, onClear, small, t }: { label: string; value: string; onChange: (e: any) => void; onClear: () => void; small?: boolean; t: (a: string, e: string) => string }) {
  return (
    <div>
      <div className="text-xs font-bold mb-2">{label}</div>
      <div className={`flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 ${small ? "h-20" : "h-32"}`}>
        {value ? <img loading="lazy" decoding="async" src={value} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">{t("لا توجد صورة", "No image")}</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <label className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary cursor-pointer hover:bg-primary/10">
          <Upload className="h-3.5 w-3.5" /> {t("رفع", "Upload")}
          <input type="file" accept="image/*" className="hidden" onChange={onChange} />
        </label>
        {value && <button onClick={onClear} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-rose-600">{t("حذف", "Delete")}</button>}
      </div>
    </div>
  );
}

function CancellationTermsEditor({ value, onChange, L }: { value: string[]; onChange: (v: string[]) => void; L: (a: string, e: string) => string }) {
  const items = value.length ? value : [
    "إلغاء مجاني واسترداد العربون قبل 6 ساعات من الموعد.",
    "خصم 50% من العربون عند الإلغاء قبل أقل من 6 ساعات.",
    "العربون غير مسترد في حال عدم الحضور بدون إشعار.",
  ];
  const update = (i: number, v: string) => onChange(items.map((x, j) => (i === j ? v : x)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const add = () => onChange([...items, ""]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= items.length) return;
    const next = items.slice(); [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((t, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 text-xs font-bold text-muted-foreground w-6 text-center">{i + 1}.</span>
          <textarea rows={2} className={ic + " flex-1"} value={t} onChange={e => update(i, e.target.value)} />
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => move(i, -1)} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground" title={L("للأعلى", "Up")}><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => move(i, 1)} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground" title={L("للأسفل", "Down")}><ArrowDown className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => remove(i)} className="rounded-md border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50" title={L("حذف", "Delete")}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10">
        <Plus className="h-3.5 w-3.5" /> {L("إضافة شرط", "Add term")}
      </button>
    </div>
  );
}

