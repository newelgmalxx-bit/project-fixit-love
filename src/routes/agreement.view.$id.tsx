import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { publicApi } from "@/lib/api/public";
import { Loader2, Printer } from "lucide-react";
import {
  buildAgreementHtmlForPartner,
  printAgreementPdf,
  type MockPartner,
  type MockAgreement,
} from "@/lib/agreementMock";

export const Route = createFileRoute("/agreement/view/$id")({
  head: () => ({ meta: [{ title: "اتفاقية الشراكة - عرض PDF" }] }),
  component: AgreementPdfView,
});

function AgreementPdfView() {
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [agreement, setAgreement] = useState<MockAgreement | null>(null);
  const [partnerData, setPartnerData] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const ag = await publicApi.getAgreement(id);
      if (!ag) { setLoading(false); return; }
      setAgreement({
        id: ag.id,
        partner_id: ag.partnerId,
        template_id: null,
        template_version: ag.version,
        commission_pct: Number((ag as any).commissionPct ?? 0),
        deposit_pct: Number((ag as any).depositPct ?? 0),
        status: ag.status,
        signed_name: ag.signerName,
        signed_at: ag.signedAt,
        signature_image: (ag as any).signatureImage || null,
        admin_notes: null,
        created_at: ag.createdAt || new Date().toISOString(),
      });
      if (ag.partnerId) {
        try {
          const p = await publicApi.getPartner(ag.partnerId);
          setPartnerData(p);
        } catch { /* ignore */ }
      }
      setLoading(false);
    })();
  }, [id]);

  const partner: MockPartner = useMemo(() => {
    const p: any = partnerData || {};
    return {
      id: String(p?.id ?? agreement?.partner_id ?? ""),
      vendor_name:
        p?.vendorNameAr || p?.vendorName || p?.nameAr || p?.name || p?.vendor_name || "—",
      owner_name: p?.ownerName || p?.owner_name || "—",
      city: p?.cityName || p?.city || p?.address || "—",
      phone: p?.phone || "—",
      email: p?.email || null,
      commercial_number: p?.commercialNumber || p?.commercial_number || null,
      status: p?.status || "active",
      commission_pct: agreement?.commission_pct ?? null,
      deposit_pct: agreement?.deposit_pct ?? null,
    };
  }, [agreement, partnerData]);

  const html = useMemo(
    () => (agreement ? buildAgreementHtmlForPartner(partner, agreement, null) : ""),
    [agreement, partner],
  );

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!agreement) {
    return <div className="p-10 text-center" dir="rtl">الاتفاقية غير موجودة</div>;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-600">اضغط الزر لطباعة الاتفاقية أو حفظها PDF</span>
        <button
          onClick={() => printAgreementPdf(html)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          <Printer className="h-4 w-4" /> طباعة / حفظ PDF
        </button>
      </div>
      <iframe srcDoc={html} title="اتفاقية الشراكة" className="w-full" style={{ height: "calc(100vh - 56px)", border: 0, background: "#fff" }} />
    </div>
  );
}
