import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { partnerApi, getStoredPartner, type PartnerProfile } from "@/lib/api/partner";
import { toast } from "sonner";
import { Loader2, Check, Download, ArrowRight } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import {
  buildAgreementHtmlForPartner,
  printAgreementPdf,
  type MockPartner,
  type MockAgreement,
} from "@/lib/agreementMock";

export const Route = createFileRoute("/partner/agreement/$id")({
  head: () => ({ meta: [{ title: "Partnership Agreement | Koswmat" }] }),
  component: PartnerAgreementPage,
});

function toMockPartner(p: PartnerProfile | null, a: MockAgreement | null): MockPartner {
  const any = (p || {}) as any;
  return {
    id: String(any.id ?? ""),
    vendor_name: any.vendorName || any.name || any.nameAr || any.vendor_name || "—",
    owner_name: any.ownerName || any.owner_name || any.contactName || "—",
    city: any.city || any.cityName || any.address || "—",
    phone: any.phone || "—",
    email: any.email || null,
    commercial_number: any.commercialNumber || any.commercial_number || null,
    status: any.status || "active",
    commission_pct: a?.commission_pct ?? any.commissionPct ?? null,
    deposit_pct: a?.deposit_pct ?? any.depositPct ?? null,
  };
}

function PartnerAgreementPage() {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agreement, setAgreement] = useState<MockAgreement | null>(null);
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [signature, setSignature] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPartner(getStoredPartner());
    (async () => {
      try {
        const res = await partnerApi.getAgreementById(id);
        const a: any = res.agreement;
        if (!a) { toast.error(L("الاتفاقية غير موجودة", "Agreement not found")); setLoading(false); return; }
        setAgreement({
          id: a.id,
          partner_id: a.partnerId ?? a.partner_id,
          template_id: a.templateId ?? null,
          template_version: a.templateVersion ? `v${a.templateVersion}` : null,
          commission_pct: Number(a.commissionPct ?? a.commission_pct ?? 0),
          deposit_pct: Number(a.depositPct ?? a.deposit_pct ?? 0),
          status: a.status,
          signed_name: a.signedName ?? null,
          signed_at: a.signedAt ?? null,
          signature_image: a.signatureImage ?? null,
          admin_notes: a.adminNotes ?? null,
          created_at: a.createdAt ?? new Date().toISOString(),
        });
      } catch (err: any) {
        toast.error(err?.message || L("الاتفاقية غير موجودة", "Agreement not found"));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const mockPartner = useMemo(() => toMockPartner(partner, agreement), [partner, agreement]);
  const html = useMemo(
    () => (agreement ? buildAgreementHtmlForPartner(mockPartner, agreement, null) : ""),
    [agreement, mockPartner],
  );

  async function sign() {
    if (!signature.trim() || !agree) {
      toast.error(L("الرجاء كتابة الاسم الكامل والموافقة على الشروط", "Please enter your full name and agree to the terms"));
      return;
    }
    setSubmitting(true);
    try {
      await partnerApi.signAgreement(id, {
        signedName: signature.trim(),
        signatureImage: signature.trim(),
      });
      toast.success(L("تم توقيع الاتفاقية بنجاح", "Agreement signed successfully"));
      setAgreement((p) => p && ({
        ...p,
        status: "signed",
        signed_name: signature.trim(),
        signed_at: new Date().toISOString(),
      }));
    } catch (err: any) {
      toast.error(err?.message || L("تعذّر توقيع الاتفاقية", "Could not sign the agreement"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" dir={dir}>
        <div className="text-center">
          <p className="text-lg font-bold">{L("الاتفاقية غير موجودة أو تم حذفها", "Agreement not found or has been deleted")}</p>
          <Link to={"/partner-dashboard" as any} className="mt-4 inline-block text-primary font-bold">{L("العودة للوحة التحكم", "Back to dashboard")}</Link>
        </div>
      </div>
    );
  }

  const signed = agreement.status === "signed";

  return (
    <div className="min-h-screen bg-muted/30 py-8" dir={dir}>
      <div className="mx-auto max-w-5xl px-4 space-y-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <h1 className="text-lg font-extrabold">{L("مراجعة اتفاقية الشراكة", "Review partnership agreement")}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {L("راجع الاتفاقية أدناه ثم وقّع إلكترونياً. سيتم حفظ نسخة موقّعة بنفس الشكل للطباعة والتنزيل.", "Review the agreement below, then sign electronically. A signed copy will be saved in the same format for printing and download.")}
          </p>
        </div>

        <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
          <iframe
            srcDoc={html}
            title={L("اتفاقية الشراكة", "Partnership Agreement")}
            className="w-full h-[75vh] bg-white"
          />
        </div>

        {signed ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
            <div className="flex items-center gap-2 font-extrabold">
              <Check className="h-5 w-5" /> {L("تم توقيع الاتفاقية", "Agreement signed")}
            </div>
            <div className="mt-2 text-sm">
              {L("وقّع بواسطة", "Signed by")} <b>{agreement.signed_name}</b> {L("بتاريخ", "on")} {new Date(agreement.signed_at!).toLocaleString(lang === "en" ? "en-US" : "ar-SA")}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <button
                onClick={() => printAgreementPdf(html)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                <Download className="h-4 w-4" /> {L("تحميل / طباعة PDF", "Download / Print PDF")}
              </button>
              <button
                onClick={() => navigate({ to: "/partner-dashboard" as any })}
                className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold"
              >
                <ArrowRight className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} /> {L("الذهاب للوحة التحكم", "Go to dashboard")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
            <div>
              <label className="text-xs font-bold">{L("التوقيع الإلكتروني (الاسم الكامل) *", "E-signature (full name) *")}</label>
              <input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={L("الاسم الكامل", "Full name")}
                className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span className="text-xs">
                {L("راجعت الاتفاقية أعلاه وأوافق إلكترونياً على جميع بنودها وعلى نسبة", "I have reviewed the agreement above and electronically agree to all its terms and the rate of")} <b>{agreement.commission_pct}%</b>.
              </span>
            </label>
            <button
              onClick={sign}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] px-6 py-3 text-sm font-extrabold text-white shadow-lg disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting ? L("جاري التوقيع...", "Signing...") : L("وقّع الاتفاقية", "Sign agreement")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
