import React from "react";
import sarLogo from "@/assets/sar.png";
import { publicApi } from "@/lib/api";

const SETTINGS_KEY = "saba_invoice_settings_v1";

function readCachedCompany(): { company?: InvoiceCompany; logo?: string; invoiceLogo?: string } {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const s = JSON.parse(raw);
    return { company: s?.company, logo: s?.logo, invoiceLogo: s?.invoiceLogo };
  } catch { return {}; }
}

function useAutoCompany(data: InvoiceData): InvoiceData {
  const [extra, setExtra] = React.useState(() => readCachedCompany());
  React.useEffect(() => {
    if (data.company && (data.invoiceLogo || data.logo || data.company.logo || data.company.invoiceLogo)) return;
    let alive = true;
    (async () => {
      try {
        const res: any = await publicApi.getSiteSettings();
        const d = res?.data ?? res;
        if (!alive || !d) return;
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(d)); } catch {}
        setExtra({ company: d.company, logo: d.logo, invoiceLogo: d.invoiceLogo });
      } catch {}
    })();
    return () => { alive = false; };
  }, [data]);
  return {
    ...data,
    logo: data.logo ?? extra.logo,
    invoiceLogo: data.invoiceLogo ?? extra.invoiceLogo,
    company: { ...(extra.company || {}), ...(data.company || {}) },
  };
}

export type InvoiceLine = {
  title: string;
  qty: number;
  price: number;
};

export type InvoiceCompany = {
  logo?: string;
  invoiceLogo?: string;
  nameAr?: string;
  nameEn?: string;
  commercialRegister?: string;
  taxNumber?: string;
  addressAr?: string;
  addressEn?: string;
  phone?: string;
  email?: string;
  website?: string;
  iban?: string;
  bankName?: string;
  invoiceFooterNoteAr?: string;
  invoiceFooterNoteEn?: string;
};

export type InvoiceData = {
  number: string;
  date: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCity?: string;
  paymentMethod?: string;
  paymentStatus?: "paid" | "unpaid" | "refunded" | string;
  items: InvoiceLine[];
  subtotal: number;
  vat: number;
  total: number;
  notes?: string;
  /** Branch (center location) info shown on the invoice */
  branchName?: string;
  branchAddress?: string;
  branchPhone?: string;
  /** Optional language for company labels (defaults to 'ar') */
  lang?: "ar" | "en";
  /** Site-wide logo (used as fallback for invoice logo) */
  logo?: string;
  /** Preferred invoice logo (white version for dark header) */
  invoiceLogo?: string;
  /** Company info from site settings */
  company?: InvoiceCompany;
};

const SAR = ({ n }: { n: number }) => (
  <span className="inline-flex items-center gap-1" dir="ltr">
    <span>{new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n)}</span>
    <img src={sarLogo} alt="SAR" style={{ height: "0.85em", width: "auto", opacity: 0.9 }} />
  </span>
);

export const InvoiceDocument = React.forwardRef<HTMLDivElement, { data: InvoiceData }>(({ data: input }, ref) => {
  const data = useAutoCompany(input);
  const paid = data.paymentStatus === "paid";
  const lang = data.lang === "en" ? "en" : "ar";
  const isAr = lang === "ar";
  const c: InvoiceCompany = data.company || {};
  const logoUrl = data.invoiceLogo || c.invoiceLogo || data.logo || c.logo;
  const companyName = (isAr ? (c.nameAr || c.nameEn) : (c.nameEn || c.nameAr)) || "خصومات";
  const companySub = isAr ? "koswmat" : "خصومات";
  const address = (isAr ? (c.addressAr || c.addressEn) : (c.addressEn || c.addressAr)) || "";
  const footerNote = (isAr ? (c.invoiceFooterNoteAr || c.invoiceFooterNoteEn) : (c.invoiceFooterNoteEn || c.invoiceFooterNoteAr)) || "";

  const L = (a: string, e: string) => (isAr ? a : e);

  const startAlign: "right" | "left" = isAr ? "right" : "left";
  const endAlign: "right" | "left" = isAr ? "left" : "right";

  return (
    <div
      ref={ref}
      dir={isAr ? "rtl" : "ltr"}
      style={{
        width: "794px",
        minHeight: "1123px",
        background: "#ffffff",
        color: "#1a1a1a",
        fontFamily: "'Tajawal','Segoe UI',Tahoma,Arial,sans-serif",
        padding: 0,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* Header band */}
      <div
        style={{
          background: "linear-gradient(135deg,#00AEC6,#007a8a)",
          color: "#fff",
          padding: "32px 44px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 0, flex: 1 }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt={companyName}
              crossOrigin="anonymous"
              style={{ height: 64, width: "auto", maxWidth: 200, objectFit: "contain", flexShrink: 0 }}
            />
          )}
          <div style={{ minWidth: 0, textAlign: startAlign }}>
            <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2 }}>{companyName}</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 3, letterSpacing: 0.3 }}>{companySub}</div>
          </div>
        </div>
        <div style={{ textAlign: endAlign, flexShrink: 0 }}>
          <div
            style={{
              display: "inline-block",
              padding: "6px 14px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.15)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            {L("فاتورة ضريبية", "TAX INVOICE")}
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{L("رقم الفاتورة", "Invoice #")}</div>
          <div dir="ltr" style={{ fontSize: 18, fontWeight: 800, marginTop: 2, textAlign: endAlign }}>
            #{data.number}
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 8 }}>{L("التاريخ", "Date")}</div>
          <div dir="ltr" style={{ fontWeight: 700, textAlign: endAlign }}>{data.date}</div>
        </div>
      </div>

      {/* Company meta strip */}
      {(c.commercialRegister || c.taxNumber || address || c.phone || c.email || c.website) && (
        <div
          style={{
            background: "#f3f6fa",
            borderBottom: "1px solid #e5e7eb",
            padding: "14px 44px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px 24px",
            fontSize: 11.5,
            color: "#374151",
            textAlign: startAlign,
          }}
        >
          {c.taxNumber && (
            <div><strong style={{ color: "#00AEC6" }}>{L("الرقم الضريبي:", "Tax #:")}</strong> <span dir="ltr">{c.taxNumber}</span></div>
          )}
          {c.commercialRegister && (
            <div><strong style={{ color: "#00AEC6" }}>{L("السجل التجاري:", "CR #:")}</strong> <span dir="ltr">{c.commercialRegister}</span></div>
          )}
          {c.phone && (
            <div><strong style={{ color: "#00AEC6" }}>{L("الجوال:", "Phone:")}</strong> <span dir="ltr">{c.phone}</span></div>
          )}
          {c.email && (
            <div><strong style={{ color: "#00AEC6" }}>{L("البريد:", "Email:")}</strong> <span dir="ltr">{c.email}</span></div>
          )}
          {address && (
            <div style={{ gridColumn: "1 / -1" }}><strong style={{ color: "#00AEC6" }}>{L("العنوان:", "Address:")}</strong> {address}</div>
          )}
          {c.website && (
            <div style={{ gridColumn: "1 / -1" }}><strong style={{ color: "#00AEC6" }}>{L("الموقع:", "Website:")}</strong> <span dir="ltr">{c.website}</span></div>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: "32px 44px" }}>
        {/* Parties */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, fontSize: 13 }}>
          <div style={{ textAlign: startAlign }}>
            <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{L("فاتورة إلى", "Bill to")}</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>{data.clientName || "—"}</div>
            {data.clientEmail && <div style={{ color: "#4b5563", marginTop: 3 }}>{data.clientEmail}</div>}
            {data.clientPhone && <div dir="ltr" style={{ color: "#4b5563", marginTop: 3, textAlign: startAlign }}>{data.clientPhone}</div>}
            {data.clientCity && <div style={{ color: "#4b5563", marginTop: 3 }}>{data.clientCity}</div>}
          </div>
          <div style={{ textAlign: endAlign }}>
            <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{L("طريقة الدفع", "Payment method")}</div>
            <div style={{ fontWeight: 700, color: "#111827" }}>{data.paymentMethod || "—"}</div>
            <div style={{ marginTop: 10 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "5px 14px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  background: paid ? "#d1fae5" : data.paymentStatus === "refunded" ? "#fee2e2" : "#fef3c7",
                  color: paid ? "#065f46" : data.paymentStatus === "refunded" ? "#991b1b" : "#92400e",
                  border: `1px solid ${paid ? "#a7f3d0" : data.paymentStatus === "refunded" ? "#fecaca" : "#fde68a"}`,
                }}
              >
                {paid ? L("مدفوعة", "Paid") : data.paymentStatus === "refunded" ? L("مستردة", "Refunded") : L("بانتظار الدفع", "Awaiting payment")}
              </span>
            </div>
          </div>
        </div>

        {/* Items table */}
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, marginTop: 28, fontSize: 13, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: "#00AEC6", color: "#fff" }}>
              <th style={{ textAlign: startAlign, padding: "12px 14px", fontWeight: 700, fontSize: 12 }}>{L("الخدمة", "Service")}</th>
              <th style={{ textAlign: "center", padding: "12px 14px", fontWeight: 700, fontSize: 12, width: 90 }}>{L("عدد الأمتار", "Meters")}</th>
              <th style={{ textAlign: endAlign, padding: "12px 14px", fontWeight: 700, fontSize: 12, width: 130 }}>{L("السعر", "Price")}</th>
              <th style={{ textAlign: endAlign, padding: "12px 14px", fontWeight: 700, fontSize: 12, width: 130 }}>{L("الإجمالي", "Total")}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ padding: "13px 14px", fontWeight: 600, textAlign: startAlign, borderBottom: "1px solid #f1f5f9" }}>{it.title}</td>
                <td style={{ padding: "13px 14px", textAlign: "center", borderBottom: "1px solid #f1f5f9" }} dir="ltr">{it.qty}</td>
                <td style={{ padding: "13px 14px", textAlign: endAlign, borderBottom: "1px solid #f1f5f9" }}><SAR n={it.price} /></td>
                <td style={{ padding: "13px 14px", textAlign: endAlign, fontWeight: 700, borderBottom: "1px solid #f1f5f9" }}><SAR n={it.price * it.qty} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {(data.branchName || data.branchAddress || data.branchPhone) && (
          <div style={{ marginTop: 18, padding: "12px 16px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 10, fontSize: 12, color: "#134e4a", textAlign: startAlign }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: "#00AEC6" }}>{L("فرع الاستلام / تنفيذ الخدمة", "Service branch")}</div>
            {data.branchName && <div style={{ fontWeight: 700 }}>{data.branchName}</div>}
            {data.branchAddress && <div style={{ marginTop: 3 }}>{data.branchAddress}</div>}
            {data.branchPhone && <div dir="ltr" style={{ marginTop: 3, textAlign: startAlign }}>{data.branchPhone}</div>}
          </div>
        )}


        {/* Totals */}
        <div style={{ display: "flex", justifyContent: endAlign === "left" ? "flex-start" : "flex-end", marginTop: 24 }}>
          <div style={{ width: 340, fontSize: 13 }}>
            <Row label={L("المجموع الفرعي", "Subtotal")} value={<SAR n={data.subtotal} />} />
            <Row label={L("ضريبة القيمة المضافة (15%)", "VAT (15%)")} value={<SAR n={data.vat} />} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 10,
                padding: "12px 16px",
                borderRadius: 10,
                background: "linear-gradient(135deg,#00AEC6,#007a8a)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              <span>{L("الإجمالي", "Total")}</span>
              <SAR n={data.total} />
            </div>
          </div>
        </div>

        {/* Bank details */}
        {(c.iban || c.bankName) && (
          <div style={{ marginTop: 24, padding: "14px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12, color: "#374151", textAlign: startAlign }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: "#00AEC6" }}>{L("بيانات التحويل البنكي", "Bank transfer details")}</div>
            {c.bankName && <div style={{ marginTop: 3 }}>{L("البنك:", "Bank:")} <strong>{c.bankName}</strong></div>}
            {c.iban && <div style={{ marginTop: 3 }}>IBAN: <strong dir="ltr">{c.iban}</strong></div>}
          </div>
        )}

        {data.notes && (
          <div style={{ marginTop: 16, padding: "14px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, fontSize: 12, color: "#4b5563", textAlign: startAlign }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: "#92400e" }}>{L("ملاحظات", "Notes")}</div>
            {data.notes}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 18, borderTop: "1px solid #e5e7eb", textAlign: "center", color: "#6b7280", fontSize: 11 }}>
          {footerNote ? (
            <div style={{ marginBottom: 6 }}>{footerNote}</div>
          ) : (
            <div style={{ marginBottom: 6 }}>{L(`شكراً لاختياركم ${companyName}`, `Thank you for your business with ${companyName}`)}</div>
          )}
          <div style={{ color: "#9ca3af", direction: "ltr" }}>
            {[c.website, c.email, c.phone].filter(Boolean).join(" • ")}
          </div>
        </div>
      </div>
    </div>
  );
});
InvoiceDocument.displayName = "InvoiceDocument";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#4b5563" }}>
      <span>{label}</span>
      <span style={{ fontWeight: 600, color: "#1f2937" }}>{value}</span>
    </div>
  );
}
