import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AdminLayout, PanelCard, Pill } from "@/components/admin/AdminLayout";
import { toast } from "sonner";
import { Loader2, FileText, Send, Eye, FolderOpen, Phone, Mail, CheckCircle2, XCircle, Plus, Trash2, ArrowUp, ArrowDown, RefreshCw, Pencil, Link2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/i18n/LanguageProvider";
import { extractAgreementClauses } from "@/lib/agreementClauses";
import {
  buildAgreementHtmlForPartner, printAgreementPdf,
  type MockTemplate as Template,
  type MockPartner as Partner,
  type MockAgreement as Agreement,
} from "@/lib/agreementMock";
import { adminPartnersApi, type AdminPartner } from "@/lib/api/adminPartners";
import { adminAgreementsApi, type ApiAgreementTemplate, type ApiPartnerAgreement } from "@/lib/api/adminAgreements";

function mapApiPartner(p: AdminPartner): Partner {
  const any = p as any;
  return {
    id: String(p.id),
    vendor_name:
      any.vendorNameAr || any.vendorName || p.nameAr || p.nameEn || any.name || p.email || `#${p.id}`,
    owner_name:
      any.ownerName || any.owner_name || any.contactName || any.userName || "—",
    city: any.address || any.cityName || any.city_name || p.city || "—",
    phone: p.phone || "—",
    email: p.email || null,
    commercial_number: any.commercialNumber || any.commercial_number || null,
    status: p.status || "pending",
    commission_pct: typeof p.commissionPct === "number" ? p.commissionPct : null,
    deposit_pct: typeof p.depositPct === "number" ? p.depositPct : null,
    created_at: p.createdAt || any.created_at,
  };
}

function mapApiTemplate(t: ApiAgreementTemplate): Template {
  return {
    id: t.id,
    version: `v${t.version}`,
    title: t.title,
    body: t.body,
    is_active: t.isActive,
  };
}

function mapApiAgreement(a: ApiPartnerAgreement): Agreement {
  return {
    id: a.id,
    partner_id: a.partnerId,
    template_id: a.templateId,
    template_version: a.templateVersion ? `v${a.templateVersion}` : null,
    commission_pct: a.commissionPct,
    deposit_pct: a.depositPct,
    status: a.status === "pending" ? "sent" : a.status,
    source: "admin_issued",
    signed_name: a.signedName,
    signed_at: a.signedAt,
    signature_image: a.signatureImage,
    admin_notes: a.adminNotes,
    custom_title: a.customTitle,
    custom_body: a.customBody || a.body || null,
    pdf_path: null,
    created_at: a.createdAt,
  };
}

export const Route = createFileRoute("/admin/agreements")({
  head: () => ({ meta: [{ title: "Partner Agreements | Admin" }] }),
  component: AgreementsPage,
});

// ============ Single fixed agreement template ============
const FIXED_TEMPLATE_TITLE = "اتفاقية الشراكة والعمولة";
const FIXED_TEMPLATE_BODY =
  "تقديم الخدمات بالجودة المعلنة والالتزام بالأسعار المنشورة.\n" +
  "احترام مواعيد الحجوزات وعدم رفض العملاء بدون مبرر.\n" +
  "المحافظة على بيانات العملاء وعدم استخدامها خارج نطاق الخدمة.\n" +
  "تحويل المبالغ المستحقة بعد خصم العمولة خلال 7 أيام عمل.\n" +
  "يحق لأي طرف فسخ الاتفاقية بإشعار خطي قبل 30 يومًا.\n" +
  "تخضع هذه الاتفاقية لأنظمة المملكة العربية السعودية.";

async function ensureFixedTemplate(): Promise<Template | null> {
  try {
    const list = await adminAgreementsApi.listTemplates();
    const active = list.find((t) => t.isActive) || list[0];
    if (active) return mapApiTemplate(active);
    const created = await adminAgreementsApi.createTemplate({
      title: FIXED_TEMPLATE_TITLE,
      body: FIXED_TEMPLATE_BODY,
      version: 1,
      isActive: true,
    });
    return mapApiTemplate(created);
  } catch (e) {
    console.error("ensureFixedTemplate failed", e);
    return null;
  }
}

// NOTE: We intentionally do NOT call PUT /admin/partners/{id} to sync the rate.
// The agreement create/update endpoints already sync commission_pct / deposit_pct
// on the partners row (only those two columns). Calling the generic partner-update
// endpoint with a partial body triggers a backend bug (admin_14.php line ~4122)
// that converts empty/missing partner columns to NULL and wipes the partner data
// (name, email, phone, address, working hours...). Do not re-introduce this call
// until the backend bug is fixed.

function AgreementsPage() {
  const { lang } = useLang();
  const L = (ar: string, en: string) => (lang === "en" ? en : ar);
  return (
    <AdminLayout title={L("اتفاقيات الشركاء", "Partner Agreements")}>
      <RequestsTab />
    </AdminLayout>
  );
}

/* ============ Requests ============ */

function RequestsTab() {
  const { lang, dir } = useLang();
  const L = (ar: string, en: string) => (lang === "en" ? en : ar);
  const locale = lang === "en" ? "en-US" : "ar-SA";
  const statusLabel = (s: string) =>
    s === "active" ? L("مفعّل", "Active")
    : s === "pending" ? L("قيد الانتظار", "Pending")
    : s === "suspended" ? L("موقوف", "Suspended")
    : s;

  const [partners, setPartners] = useState<Partner[]>([]);
  const [latestByPartner, setLatestByPartner] = useState<Record<string, ApiPartnerAgreement | null>>({});
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [openFor, setOpenFor] = useState<Partner | null>(null);
  const [fileFor, setFileFor] = useState<Partner | null>(null);
  const [viewAg, setViewAg] = useState<{ partner: Partner; ag: Agreement } | null>(null);
  const [editAg, setEditAg] = useState<{ partnerId: string; ag: ApiPartnerAgreement } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "active">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [partnersRes, tpl] = await Promise.all([
        adminPartnersApi.list({ limit: 200 }),
        ensureFixedTemplate(),
      ]);
      const rows = (partnersRes.items || []).map(mapApiPartner);
      rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

      const latestMap: Record<string, ApiPartnerAgreement | null> = {};
      await Promise.all(
        rows.map(async (p) => {
          try {
            const ags = await adminAgreementsApi.listPartnerAgreements(p.id);
            const signed = ags
              .filter((a) => a.status === "signed")
              .sort((a, b) => (b.signedAt || b.createdAt || "").localeCompare(a.signedAt || a.createdAt || ""))[0];
            const latest = signed
              || ags.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0]
              || null;
            latestMap[p.id] = latest;
            if (latest) {
              if (typeof latest.commissionPct === "number") p.commission_pct = latest.commissionPct;
              if (typeof latest.depositPct === "number") p.deposit_pct = latest.depositPct;
            }
          } catch { latestMap[p.id] = null; }
        })
      );

      setPartners([...rows]);
      setLatestByPartner(latestMap);
      setTemplate(tpl);
    } catch (e: any) {
      console.error("Failed to load", e);
      toast.error(L("تعذّر تحميل البيانات", "Failed to load data"));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => { load(); }, [load]);

  async function resendOuter(partnerId: string, a: ApiPartnerAgreement) {
    setResendingId(a.id);
    try {
      const r = await adminAgreementsApi.resendAgreementEmail(partnerId, a.id);
      toast.success(r?.emailSent
        ? L("تم إرسال الإيميل مجدداً", "Email resent successfully")
        : L("تم تجديد التوكن (لم يتم إرسال إيميل)", "Token renewed (no email sent)"));
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل إعادة الإرسال", "Failed to resend"));
    } finally {
      setResendingId(null);
    }
  }

  const filteredPartners = partners.filter((p) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return p.status === "pending";
    if (statusFilter === "active") return p.status === "active";
    return true;
  });

  const counts = {
    all: partners.length,
    pending: partners.filter((p) => p.status === "pending").length,
    active: partners.filter((p) => p.status === "active").length,
  };

  return (
    <>
      <PanelCard
        title={L("الشركاء واتفاقياتهم", "Partners & their agreements")}
        action={
          <div className="flex gap-1.5">
            {([
              ["all", L("الكل", "All"), counts.all],
              ["pending", L("قيد الانتظار", "Pending"), counts.pending],
              ["active", L("مفعّل", "Active"), counts.active],
            ] as const).map(([key, label, n]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key as any)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  statusFilter === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/70"
                }`}
              >
                {label} ({n})
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filteredPartners.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{L("لا يوجد شركاء بهذه الحالة.", "No partners with this status.")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className={dir === "rtl" ? "py-2 text-right" : "py-2 text-left"}>{L("المركز", "Merchant")}</th>
                  <th className={dir === "rtl" ? "py-2 text-right" : "py-2 text-left"}>{L("التواصل", "Contact")}</th>
                  <th className={dir === "rtl" ? "py-2 text-right" : "py-2 text-left"}>{L("حالة الشريك", "Partner status")}</th>
                  <th className={dir === "rtl" ? "py-2 text-right" : "py-2 text-left"}>{L("الاتفاقية", "Agreement")}</th>
                  <th className={dir === "rtl" ? "py-2 text-right" : "py-2 text-left"}>{L("النسبة الحالية", "Current rate")}</th>
                  <th className={dir === "rtl" ? "py-2 text-right" : "py-2 text-left"}>{L("إجراء", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartners.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-3">
                      <div className="font-bold">{p.vendor_name}</div>
                      <div className="text-xs text-muted-foreground">{p.owner_name} · {p.city}</div>
                    </td>
                    <td className="py-3 text-xs">
                      <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</div>
                      {p.email && <div className="flex items-center gap-1 text-muted-foreground mt-0.5"><Mail className="h-3 w-3" />{p.email}</div>}
                    </td>
                    <td className="py-3"><Pill tone={p.status === "active" ? "emerald" : "amber"}>{statusLabel(p.status)}</Pill></td>
                    <td className="py-3 align-middle whitespace-nowrap">
                      {(() => {
                        const latest = latestByPartner[p.id];
                        if (!latest) return <Pill tone="muted">{L("لا توجد", "None")}</Pill>;
                        if (latest.status === "signed") return (
                          <div className="inline-flex items-center gap-2">
                            <Pill tone="emerald"><CheckCircle2 className="h-3 w-3 inline ml-0.5" /> {L("موقّعة", "Signed")}</Pill>
                            {latest.signedAt && (
                              <span className="text-[10px] text-muted-foreground" dir="ltr">
                                {new Date(latest.signedAt).toLocaleDateString(locale)}
                              </span>
                            )}
                          </div>
                        );
                        if (latest.status === "cancelled" || latest.status === "rejected") return (
                          <Pill tone="rose"><XCircle className="h-3 w-3 inline ml-0.5" /> {L("ملغاة", "Cancelled")}</Pill>
                        );
                        return <Pill tone="amber">{L("بانتظار التوقيع", "Awaiting signature")}</Pill>;
                      })()}
                    </td>

                    <td className="py-3 text-xs font-bold">
                      {p.commission_pct != null ? `${p.commission_pct}%` : <span className="text-muted-foreground font-normal">—</span>}
                    </td>

                    <td className="py-3">
                      {(() => {
                        const latest = latestByPartner[p.id];
                        const isPending = latest && latest.status === "pending";
                        return (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => setFileFor(p)}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-bold hover:bg-muted"
                            >
                              <FolderOpen className="h-3 w-3" /> {L("الملف", "File")}
                            </button>
                            <button
                              onClick={() => setOpenFor(p)}
                              disabled={!template}
                              className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                              title={!template ? L("جارٍ تهيئة قالب الاتفاقية...", "Preparing agreement template...") : ""}
                            >
                              <Send className="h-3 w-3" />
                              {L("إصدار اتفاقية", "Issue agreement")}
                            </button>
                            {latest && (
                              <button
                                onClick={() => setViewAg({ partner: p, ag: mapApiAgreement(latest) })}
                                className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground hover:opacity-90"
                              >
                                <Eye className="h-3 w-3" /> {L("عرض", "View")}
                              </button>
                            )}
                            {isPending && (
                              <>
                                <button
                                  onClick={() => setEditAg({ partnerId: p.id, ag: latest! })}
                                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-bold hover:bg-muted"
                                >
                                  <Pencil className="h-3 w-3" /> {L("تعديل", "Edit")}
                                </button>
                                <button
                                  onClick={() => resendOuter(p.id, latest!)}
                                  disabled={resendingId === latest!.id}
                                  className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 disabled:opacity-60"
                                >
                                  {resendingId === latest!.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                  {L("إعادة إرسال الإيميل", "Resend email")}
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>

      {openFor && template && (
        <IssueAgreementDialog
          partner={openFor}
          template={template}
          onClose={() => setOpenFor(null)}
          onSaved={() => { setOpenFor(null); load(); }}
        />
      )}

      {fileFor && (
        <PartnerFileDialog
          partner={fileFor}
          template={template}
          onClose={() => setFileFor(null)}
        />
      )}

      {viewAg && (
        <Dialog open onOpenChange={(o) => !o && setViewAg(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir={dir}>
            <DialogHeader>
              <DialogTitle>{L("عرض الاتفاقية", "View agreement")} — {viewAg.partner.vendor_name}</DialogTitle>
            </DialogHeader>
            <iframe
              srcDoc={buildAgreementHtmlForPartner(viewAg.partner, viewAg.ag, template)}
              className="w-full h-[70vh] rounded-lg border"
            />
            <DialogFooter>
              <button onClick={() => setViewAg(null)} className="rounded-full px-4 py-2 text-sm">{L("إغلاق", "Close")}</button>
              <button
                onClick={() => printAgreementPdf(buildAgreementHtmlForPartner(viewAg.partner, viewAg.ag, template))}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                <FileText className="h-4 w-4" /> {L("تحميل PDF", "Download PDF")}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editAg && (
        <EditPendingAgreementDialog
          partnerId={editAg.partnerId}
          agreement={editAg.ag}
          onClose={() => setEditAg(null)}
          onSaved={() => { setEditAg(null); load(); }}
        />
      )}
    </>
  );
}



function PartnerFileDialog({
  partner, template, onClose,
}: { partner: Partner; template: Template | null; onClose: () => void }) {
  const { lang, dir } = useLang();
  const L = (ar: string, en: string) => (lang === "en" ? en : ar);
  const locale = lang === "en" ? "en-US" : "ar-SA";
  const statusLabel = (s: string) =>
    s === "active" ? L("مفعّل", "Active")
    : s === "pending" ? L("قيد الانتظار", "Pending")
    : s === "suspended" ? L("موقوف", "Suspended")
    : s;

  const [apiAgreements, setApiAgreements] = useState<ApiPartnerAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewAg, setViewAg] = useState<Agreement | null>(null);
  const [editAg, setEditAg] = useState<ApiPartnerAgreement | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await adminAgreementsApi.listPartnerAgreements(partner.id);
      setApiAgreements(items);
    } catch (e) {
      console.error(e);
      toast.error(L("تعذّر تحميل الاتفاقيات", "Failed to load agreements"));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner.id, lang]);

  useEffect(() => { load(); }, [load]);

  function tplTitle(_id: string | null, version: string | null) {
    return template ? `${template.title} · ${template.version}` : (version ? L(`نسخة ${version}`, `Version ${version}`) : FIXED_TEMPLATE_TITLE);
  }

  async function resend(a: ApiPartnerAgreement) {
    setResendingId(a.id);
    try {
      const r = await adminAgreementsApi.resendAgreementEmail(partner.id, a.id);
      toast.success(r?.emailSent
        ? L("تم إرسال الإيميل مجدداً", "Email resent successfully")
        : L("تم تجديد التوكن (لم يتم إرسال إيميل — البريد غير متوفر)", "Token renewed (no email sent — address unavailable)"));
      load();
    } catch (e: any) {
      toast.error(e?.message || L("فشل إعادة الإرسال", "Failed to resend"));
    } finally {
      setResendingId(null);
    }
  }

  const viewHtml = viewAg ? buildAgreementHtmlForPartner(partner, viewAg, template) : "";

  function statusBadge(s: string) {
    if (s === "signed") return <Pill tone="emerald"><CheckCircle2 className="h-3 w-3 inline ml-0.5" /> {L("موقّعة", "Signed")}</Pill>;
    if (s === "cancelled" || s === "rejected") return <Pill tone="rose"><XCircle className="h-3 w-3 inline ml-0.5" /> {L("ملغاة", "Cancelled")}</Pill>;
    return <Pill tone="amber">{L("بانتظار التوقيع", "Awaiting signature")}</Pill>;
  }

  function emailStatusBadge(s?: string | null) {
    if (!s) return <span className="text-[10px] text-muted-foreground">{L("لم يُرسل", "Not sent")}</span>;
    if (s === "sent") return <Pill tone="emerald"><Mail className="h-3 w-3 inline ml-0.5" /> {L("أُرسل", "Sent")}</Pill>;
    if (s === "queued") return <Pill tone="amber"><Mail className="h-3 w-3 inline ml-0.5" /> {L("في الطابور", "Queued")}</Pill>;
    if (s === "failed") return <Pill tone="rose"><XCircle className="h-3 w-3 inline ml-0.5" /> {L("فشل", "Failed")}</Pill>;
    return <Pill tone="muted">{s}</Pill>;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            {L("ملف الشريك:", "Partner file:")} {partner.vendor_name}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-2xl border bg-muted/30 p-4 text-sm space-y-2">
          <div className="font-bold text-base mb-2">{L("البيانات الأساسية", "Basic information")}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div><span className="text-muted-foreground">{L("المسؤول:", "Owner:")}</span> <b>{partner.owner_name}</b></div>
            <div><span className="text-muted-foreground">{L("المدينة:", "City:")}</span> <b>{partner.city}</b></div>
            <div className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-primary" /><b>{partner.phone}</b></div>
            {partner.email && <div className="flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-primary" /><b>{partner.email}</b></div>}
            {partner.commercial_number && <div><span className="text-muted-foreground">{L("السجل التجاري:", "Commercial reg.:")}</span> <b>{partner.commercial_number}</b></div>}
            <div><span className="text-muted-foreground">{L("الحالة:", "Status:")}</span> <Pill tone={partner.status === "active" ? "emerald" : "amber"}>{statusLabel(partner.status)}</Pill></div>
          </div>
        </div>

        <div className="mt-4">
          <div className="font-bold text-base mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {L("سجل الاتفاقيات", "Agreements history")} ({apiAgreements.length})
          </div>
          {loading ? (
            <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : apiAgreements.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {L("لا توجد اتفاقيات بعد", "No agreements yet")}
            </div>
          ) : (
            <div className="space-y-2">
              {apiAgreements.map((a) => {
                const isPending = a.status === "pending";
                return (
                  <div key={a.id} className="rounded-xl border bg-background p-3 text-sm">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <b className="text-xs">{tplTitle(a.templateId, a.templateVersion ? `v${a.templateVersion}` : null)}</b>
                          {statusBadge(a.status)}
                          {isPending && emailStatusBadge(a.emailLastStatus)}
                          {typeof a.emailResentCount === "number" && a.emailResentCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">{L("إعادة إرسال:", "Resends:")} {a.emailResentCount}×</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {L("النسبة:", "Rate:")} <b className="text-foreground">{a.commissionPct}%</b> · {L("أُرسلت", "Sent")} {new Date(a.createdAt).toLocaleString(locale)}
                        </div>
                        {a.emailSentAt && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {L("آخر إرسال إيميل:", "Last email sent:")} {new Date(a.emailSentAt).toLocaleString(locale)}
                          </div>
                        )}
                        {a.signedAt && (
                          <div className="mt-1 text-xs text-emerald-700">
                            {L("باسم", "By")} <b>{a.signedName}</b> · {new Date(a.signedAt).toLocaleString(locale)}
                          </div>
                        )}
                        {a.adminNotes && (
                          <div className="mt-1 text-[11px] text-muted-foreground">{L("ملاحظات:", "Notes:")} {a.adminNotes}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <button
                          onClick={() => setViewAg(mapApiAgreement(a))}
                          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:opacity-90"
                        >
                          <Eye className="h-3 w-3" /> {L("عرض", "View")}
                        </button>
                        {isPending && (
                          <>
                            <button
                              onClick={() => setEditAg(a)}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-bold hover:bg-muted"
                            >
                              <Pencil className="h-3 w-3" /> {L("تعديل", "Edit")}
                            </button>
                            <button
                              onClick={() => resend(a)}
                              disabled={resendingId === a.id}
                              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/10 disabled:opacity-60"
                            >
                              {resendingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                              {L("إعادة إرسال الإيميل", "Resend email")}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm">{L("إغلاق", "Close")}</button>
        </DialogFooter>

        {viewAg && (
          <Dialog open onOpenChange={(o) => !o && setViewAg(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir={dir}>
              <DialogHeader>
                <DialogTitle>{L("عرض الاتفاقية", "View agreement")}</DialogTitle>
              </DialogHeader>
              <iframe srcDoc={viewHtml} className="w-full h-[70vh] rounded-lg border" />
              <DialogFooter>
                <button onClick={() => setViewAg(null)} className="rounded-full px-4 py-2 text-sm">{L("إغلاق", "Close")}</button>
                <button
                  onClick={() => printAgreementPdf(viewHtml)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                >
                  <FileText className="h-4 w-4" /> {L("تحميل PDF", "Download PDF")}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {editAg && (
          <EditPendingAgreementDialog
            partnerId={partner.id}
            agreement={editAg}
            onClose={() => setEditAg(null)}
            onSaved={() => { setEditAg(null); load(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditPendingAgreementDialog({
  partnerId, agreement, onClose, onSaved,
}: { partnerId: string; agreement: ApiPartnerAgreement; onClose: () => void; onSaved: () => void }) {
  const { lang, dir } = useLang();
  const L = (ar: string, en: string) => (lang === "en" ? en : ar);

  const [rate, setRate] = useState<number>(agreement.commissionPct ?? agreement.depositPct ?? 10);

  const [title, setTitle] = useState<string>(agreement.customTitle || agreement.title || "");
  const [body, setBody] = useState<string>(agreement.customBody || agreement.body || "");
  const [notes, setNotes] = useState<string>(agreement.adminNotes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!body.trim()) { toast.error(L("نص الاتفاقية مطلوب", "Agreement body is required")); return; }
    setSaving(true);
    try {
      await adminAgreementsApi.updatePartnerAgreement(partnerId, agreement.id, {
        commissionPct: rate,
        depositPct: rate,

        customTitle: title.trim() || null,
        customBody: body,
        adminNotes: notes || null,
      });
      toast.success(L("تم تحديث الاتفاقية وإعادة الإرسال للشريك", "Agreement updated and resent to partner"));
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || L("تعذّر التحديث أو حفظ النسبة على المركز", "Failed to update or save rate on merchant"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" /> {L("تعديل اتفاقية بانتظار التوقيع", "Edit pending agreement")}
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <Link2 className="inline h-3.5 w-3.5 ml-1" />
          {L("بعد الحفظ سيتم إنشاء توكن جديد وإعادة إرسال الإيميل تلقائياً للشريك.", "On save, a new token is generated and the email is automatically resent to the partner.")}
        </div>
        <div className="space-y-3 mt-3">
          <div>
            <Label>{L("نسبة العمولة / العربون %", "Commission / deposit rate %")}</Label>
            <Input type="number" min={0} max={100} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
            <p className="mt-1 text-[11px] text-muted-foreground">{L("العميل يدفع نفس النسبة كعربون وهي عمولة المنصة على الحجز.", "The customer pays the same rate as a deposit, which is the platform commission on the booking.")}</p>
          </div>

          <div>
            <Label>{L("عنوان الاتفاقية", "Agreement title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>{L("نص الاتفاقية", "Agreement body")}</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="font-mono text-xs leading-relaxed" />
          </div>
          <div>
            <Label>{L("ملاحظات الإدارة", "Admin notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm">{L("إلغاء", "Cancel")}</button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {L("حفظ وإعادة إرسال", "Save & resend")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function IssueAgreementDialog({
  partner, template, onClose, onSaved,
}: { partner: Partner; template: Template; onClose: () => void; onSaved: () => void }) {
  const { lang, dir } = useLang();
  const L = (ar: string, en: string) => (lang === "en" ? en : ar);

  const defaultClauses = extractAgreementClauses(template.body);

  const [rate, setRate] = useState<number>(partner.commission_pct ?? partner.deposit_pct ?? 10);
  const [title, setTitle] = useState<string>(template.title);
  const [clauses, setClauses] = useState<string[]>(defaultClauses.length ? defaultClauses : [""]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const bodyText = clauses.map((c) => c.trim()).filter(Boolean).join("\n\n");

  function updateClause(i: number, v: string) {
    setClauses((prev) => prev.map((c, idx) => (idx === i ? v : c)));
  }
  function addClause() {
    setClauses((prev) => [...prev, ""]);
  }
  function removeClause(i: number) {
    setClauses((prev) => (prev.length === 1 ? [""] : prev.filter((_, idx) => idx !== i)));
  }
  function moveClause(i: number, dir: -1 | 1) {
    setClauses((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }
  function resetClauses() {
    setClauses(defaultClauses.length ? defaultClauses : [""]);
  }

  const previewHtml = previewing
    ? buildAgreementHtmlForPartner(
        partner,
        {
          id: "preview",
          partner_id: partner.id,
          template_id: template.id,
          template_version: template.version,
          commission_pct: rate,
          deposit_pct: rate,
          status: "sent",
          source: "admin_issued",
          signed_name: null,
          signed_at: null,
          signature_image: null,
          admin_notes: notes || null,
          pdf_path: null,
          created_at: new Date().toISOString(),
        },
        { ...template, title, body: bodyText },
      )
    : "";

  async function send() {
    if (!title.trim()) {
      toast.error(L("العنوان مطلوب", "Title is required"));
      return;
    }
    if (!bodyText.trim()) {
      toast.error(L("أضف بندًا واحدًا على الأقل", "Add at least one clause"));
      return;
    }
    setSaving(true);
    try {
      await adminAgreementsApi.createPartnerAgreement(partner.id, {
        templateId: template.id,
        commissionPct: rate,
        depositPct: rate,
        customTitle: title.trim() !== template.title ? title.trim() : null,
        customBody: bodyText,
        adminNotes: notes || null,
      });
      toast.success(L("تم إصدار الاتفاقية وحفظها في قاعدة البيانات", "Agreement issued and saved to the database"));
      onSaved();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || L("تعذّر إصدار الاتفاقية أو حفظ النسبة على المركز", "Failed to issue agreement or save rate on merchant"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle>{L("إصدار اتفاقية لـ", "Issue agreement for")} {partner.vendor_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
            {L("القالب الأساسي:", "Base template:")} <b className="text-foreground">{template.title}</b> ({template.version}).
            {" "}{L("يمكنك تعديل العنوان والنص أدناه قبل الإرسال — التعديلات تُحفظ مع هذه الاتفاقية فقط ولا تغيّر القالب.", "You can edit the title and body below before sending — changes are saved with this agreement only and do not modify the template.")}
          </div>

          <div>
            <Label>{L("نسبة العمولة / العربون (%)", "Commission / deposit rate (%)")}</Label>
            <Input type="number" min={0} max={100} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {L("يتم استبدال", "Replaces")} <code>{"{commission_pct}"}</code> {L("داخل النص بهذه النسبة تلقائياً.", "inside the body with this rate automatically.")}
            </p>
          </div>

          <div>
            <Label>{L("عنوان الاتفاقية", "Agreement title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>{L("بنود الاتفاقية", "Agreement clauses")}</Label>
              <button
                type="button"
                onClick={resetClauses}
                className="text-[11px] text-primary hover:underline"
              >
                {L("إعادة تعيين من القالب", "Reset from template")}
              </button>
            </div>
            <div className="space-y-2">
              {clauses.map((c, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {i + 1}
                  </div>
                  <Textarea
                    value={c}
                    onChange={(e) => updateClause(i, e.target.value)}
                    rows={2}
                    placeholder={L(`البند رقم ${i + 1}...`, `Clause #${i + 1}...`)}
                    className="flex-1 min-h-[44px] text-xs leading-relaxed"
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveClause(i, -1)}
                      disabled={i === 0}
                      className="flex h-6 w-6 items-center justify-center rounded-md border bg-background hover:bg-muted disabled:opacity-40"
                      title={L("تحريك لأعلى", "Move up")}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveClause(i, 1)}
                      disabled={i === clauses.length - 1}
                      className="flex h-6 w-6 items-center justify-center rounded-md border bg-background hover:bg-muted disabled:opacity-40"
                      title={L("تحريك لأسفل", "Move down")}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeClause(i)}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-rose-200 bg-background text-rose-600 hover:bg-rose-50"
                      title={L("حذف البند", "Remove clause")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addClause}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5" /> {L("إضافة بند جديد", "Add new clause")}
            </button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {L("يمكنك استخدام", "You can use")} <code>{"{commission_pct}"}</code> {L("و", "and")} <code>{"{deposit_pct}"}</code> {L("داخل البنود لاستبدالهما بالنسبة تلقائيًا.", "inside clauses to substitute the rate automatically.")}
            </p>
          </div>

          <div>
            <Label>{L("ملاحظات للشريك (اختياري)", "Notes for partner (optional)")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm">{L("إلغاء", "Cancel")}</button>
          <button
            onClick={() => {
              if (!title.trim() || !bodyText.trim()) {
                toast.error(L("العنوان وبند واحد على الأقل مطلوبان", "Title and at least one clause are required"));
                return;
              }
              setPreviewing(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-bold hover:bg-muted"
          >
            <Eye className="h-4 w-4" /> {L("مراجعة قبل الإرسال", "Review before sending")}
          </button>
          <button
            onClick={send}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {L("إرسال الاتفاقية للشريك", "Send agreement to partner")}
          </button>
        </DialogFooter>

        {previewing && (
          <Dialog open onOpenChange={(o) => !o && setPreviewing(false)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir={dir}>
              <DialogHeader>
                <DialogTitle>{L("معاينة الاتفاقية قبل الإرسال", "Preview agreement before sending")}</DialogTitle>
              </DialogHeader>
              <iframe srcDoc={previewHtml} className="w-full h-[65vh] rounded-lg border" />
              <DialogFooter>
                <button onClick={() => setPreviewing(false)} className="rounded-full px-4 py-2 text-sm">
                  {L("رجوع للتعديل", "Back to edit")}
                </button>
                <button
                  onClick={async () => { await send(); setPreviewing(false); }}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {L("تأكيد الإرسال", "Confirm send")}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
