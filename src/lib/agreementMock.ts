import { extractAgreementClauses } from "@/lib/agreementClauses";

// Shared in-memory + localStorage mock store so the admin can issue an
// agreement and the partner dashboard receives it (demo flow only).

export type MockTemplate = {
  id: string;
  version: string;
  title: string;
  body: string;
  is_active: boolean;
};

export type MockPartner = {
  id: string;
  vendor_name: string;
  owner_name: string;
  city: string;
  phone: string;
  email: string | null;
  commercial_number: string | null;
  status: string; // pending | active
  commission_pct: number | null;
  deposit_pct: number | null;
  created_at?: string;
};

export type MockAgreement = {
  id: string;
  partner_id: string;
  template_id: string | null;
  template_version: string | null;
  commission_pct: number;
  deposit_pct: number;
  status: string; // sent | signed | rejected
  source?: string | null;
  signed_name: string | null;
  signed_at: string | null;
  signature_image?: string | null;
  admin_notes: string | null;
  custom_title?: string | null;
  custom_body?: string | null;
  pdf_path?: string | null;
  created_at: string;
};

const KEY = "mock_agreement_store_v3";
const EVENT = "mock-agreement-store-change";

export const DEMO_PARTNER_ID = "demo-partner";

const DEFAULT_TEMPLATES: MockTemplate[] = [
  {
    id: "tpl-1",
    version: "v2026-01",
    title: "اتفاقية الشراكة والعمولة",
    body: "1. تُحتسب نسبة {commission_pct}% كعربون يدفعه العميل عند الحجز، ويُعدّ في الوقت نفسه عمولة المنصة على هذا الحجز.\n2. يلتزم المركز بتقديم الخدمة بالجودة والسعر المعلن في العرض.\n3. يلتزم المركز بتأكيد أو رفض الحجز خلال مدة معقولة من استلامه.\n4. أي خلاف بين المركز والعميل يُحل ودياً، ويحق للمنصة التدخل لحماية حقوق الطرفين.\n5. تُحفظ هذه الاتفاقية إلكترونياً وتُعتبر سارية فور التوقيع عليها.",
    is_active: true,
  },
  {
    id: "tpl-2",
    version: "v2026-02",
    title: "اتفاقية المراكز المميزة",
    body: "بنود خاصة بالمراكز المميزة مع نسبة عمولة {commission_pct}% وأولوية في الظهور.",
    is_active: false,
  },
];

const DEFAULT_PARTNERS: MockPartner[] = [];

const DEFAULT_AGREEMENTS: MockAgreement[] = [];

type StoreShape = {
  templates: MockTemplate[];
  partners: MockPartner[];
  agreements: MockAgreement[];
};

function defaults(): StoreShape {
  return {
    templates: [...DEFAULT_TEMPLATES],
    partners: [...DEFAULT_PARTNERS],
    agreements: [...DEFAULT_AGREEMENTS],
  };
}

export function loadStore(): StoreShape {
  if (typeof window === "undefined") return defaults();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return {
      templates: parsed.templates && parsed.templates.length ? parsed.templates : DEFAULT_TEMPLATES,
      partners: parsed.partners && parsed.partners.length ? parsed.partners : DEFAULT_PARTNERS,
      agreements: parsed.agreements && parsed.agreements.length ? parsed.agreements : DEFAULT_AGREEMENTS,
    };
  } catch {
    return defaults();
  }
}

export function saveStore(s: StoreShape) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeStore(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function resetStore() {
  saveStore(defaults());
}

/* ============ Agreement HTML + PDF ============ */

export function buildAgreementHtmlForPartner(
  p: MockPartner,
  a: MockAgreement | null,
  tpl: MockTemplate | null
): string {
  // Defensive: ensure all string fields are never undefined/null before .slice() or string ops
  const safeId = (p?.id ?? "");
  const safeVendorName = (p?.vendor_name ?? "");
  const safeOwnerName = (p?.owner_name ?? "");
  const safeCity = (p?.city ?? "");
  const safePhone = (p?.phone ?? "");
  const safeEmail = (p?.email ?? "");
  const safeCommercialNumber = (p?.commercial_number ?? "");

  const seedNum = parseInt(safeId.replace(/\D/g, "").slice(-3) || "0", 10) || 1;
  const agreementId = a?.id ?? "";
  const number = a
    ? `AGR-${new Date(a.created_at || new Date()).getFullYear()}-${(agreementId || String(seedNum)).slice(-4).toUpperCase()}`
    : `AGR-${new Date().getFullYear()}-${String(seedNum).padStart(4, "0")}`;
  const commission = a ? a.commission_pct : (p?.commission_pct ?? 10);
  const deposit = a ? a.deposit_pct : (p?.deposit_pct ?? 20);
  const signedAt = a?.signed_at ? new Date(a.signed_at).toLocaleString("ar-SA") : "—";
  const version = a?.template_version || tpl?.version || "v1.0";
  const sourceBody = (a?.custom_body && a.custom_body.trim()) ? a.custom_body : ((tpl as any)?.resolvedBody || tpl?.body || (a as any)?.body || "");
  const rawBody = sourceBody.replace(/\{commission_pct\}/g, String(commission)).replace(/\{deposit_pct\}/g, String(deposit));
  const clauses = extractAgreementClauses(rawBody);
  const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const clausesHtml = clauses.length
    ? `<ol>${clauses.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ol>`
    : `<p style="color:#9ca3af">— لم يتم إضافة بنود بعد —</p>`;

  const logoUrl = typeof window !== "undefined" ? `${window.location.origin}/brand-logo.png` : "/brand-logo.png";
  const today = new Date().toLocaleDateString("ar-SA");
  const displaySignedAt = a?.signed_at ? new Date(a.signed_at).toLocaleDateString("ar-SA") : today;
  const signedStamp = a?.status === "signed";

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<title>عقد اشتراك - ${safeVendorName}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI','Tahoma','Arial',sans-serif;margin:0;padding:24px;background:#f3f4f6;color:#111;line-height:1.8}
  .doc{max-width:820px;margin:0 auto;background:#fff;border:1px solid #d1d5db;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .header{background:linear-gradient(135deg,#3F2A6B 0%,#5b3a99 100%);padding:18px 28px;display:flex;align-items:center;gap:16px;border-bottom:4px solid #E0254D}
  .header img{height:54px;width:auto;background:#fff;border-radius:8px;padding:6px}
  .header .brand{color:#fff}
  .header .brand .name{font-size:22px;font-weight:900;letter-spacing:.5px}
  .header .brand .tag{font-size:12px;opacity:.85;margin-top:2px}
  .inner{padding:28px 32px}
  h1{text-align:center;font-size:24px;margin:8px 0 6px;color:#3F2A6B;font-weight:900}
  .contract-meta{text-align:center;font-size:13px;color:#374151;margin-bottom:22px;line-height:1.9}
  .contract-meta b{color:#3F2A6B}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0 8px}
  .party{border:1px solid #d1d5db;border-radius:6px;overflow:hidden;font-size:13px}
  .party .ph{background:#3F2A6B;color:#fff;padding:8px 12px;font-weight:800;font-size:13px;text-align:center}
  .party table{width:100%;border-collapse:collapse}
  .party td{padding:7px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  .party tr:last-child td{border-bottom:0}
  .party td.k{background:#f9fafb;color:#374151;font-weight:700;width:42%;white-space:nowrap}
  .party td.v{color:#111;word-break:break-word}
  h2{color:#3F2A6B;font-size:15px;margin:22px 0 8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
  p,ol{font-size:13.5px;color:#1f2937;margin:6px 0}
  ol{padding-inline-start:22px}
  ol li{margin:4px 0}
  .custom{background:#fafafa;border:1px solid #eee;border-radius:6px;padding:10px 14px;white-space:pre-wrap;font-size:13px;margin-top:6px}
  .signatures{margin-top:34px;display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .sig{border:1px solid #d1d5db;border-radius:6px;padding:14px;text-align:center;background:#fafafa}
  .sig .label{font-size:11px;color:#6b7280;font-weight:700;margin-bottom:8px}
  .sig .box{height:80px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px dashed #cbd5e1;border-radius:4px;margin-bottom:8px}
  .sig .box img{max-height:70px;max-width:90%;object-fit:contain}
  .sig .platform-sig{font-family:'Brush Script MT','Lucida Handwriting',cursive;font-size:32px;color:#3F2A6B}
  .sig .name{font-weight:800;color:#111;font-size:13px}
  .sig .role{font-size:11px;color:#6b7280;margin-top:2px}
  .stamp{margin:22px 0 4px;border:2px dashed #16a34a;color:#16a34a;padding:10px;border-radius:6px;text-align:center;font-weight:bold;font-size:13px}
  .footer{margin-top:22px;padding-top:14px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#6b7280}
  @media print{body{background:#fff;padding:0}.doc{border:0;box-shadow:none;border-radius:0}}
</style></head>
<body>
<div class="doc">
  <div class="header">
    <img src="${logoUrl}" alt="خصومات" onerror="this.style.display='none'"/>
    <div class="brand">
      <div class="name">خصومات</div>
      <div class="tag">منصة العروض والحجوزات في المملكة العربية السعودية</div>
    </div>
  </div>

  <div class="inner">
    <h1>عقد اشتراك</h1>
    <div class="contract-meta">
      تم إبرام هذا العقد بمدينة <b>الرياض</b> بالمملكة العربية السعودية بتاريخ <b>${displaySignedAt}</b><br/>
      وبرقم <b>${number}</b> — الإصدار <b>${version}</b>
    </div>

    <div class="parties">
      <div class="party">
        <div class="ph">الطرف الأول (المنصة)</div>
        <table>
          <tr><td class="k">الاسم التجاري</td><td class="v">منصة خصومات</td></tr>
          <tr><td class="k">المقر</td><td class="v">الرياض — المملكة العربية السعودية</td></tr>
          <tr><td class="k">السجل التجاري</td><td class="v">1010XXXXXXX</td></tr>
          <tr><td class="k">البريد الإلكتروني</td><td class="v">info@koswmat.com</td></tr>
          <tr><td class="k">الموقع</td><td class="v">koswmat.com</td></tr>
        </table>
      </div>
      <div class="party">
        <div class="ph">الطرف الثاني (الشريك)</div>
        <table>
          <tr><td class="k">اسم المركز</td><td class="v">${safeVendorName || "—"}</td></tr>
          <tr><td class="k">المسؤول</td><td class="v">${safeOwnerName || "—"}</td></tr>
          ${safeCommercialNumber ? `<tr><td class="k">السجل التجاري</td><td class="v">${safeCommercialNumber}</td></tr>` : ""}
          <tr><td class="k">الجوال</td><td class="v" dir="ltr">${safePhone || "—"}</td></tr>
          ${safeEmail ? `<tr><td class="k">البريد الإلكتروني</td><td class="v" dir="ltr">${safeEmail}</td></tr>` : ""}
          <tr><td class="k">المدينة</td><td class="v">${safeCity || "—"}</td></tr>
        </table>
      </div>
    </div>

    <h2>1. تمهيد</h2>
    <p>تُبرم هذه الاتفاقية بين <b>منصة خصومات</b> ("الطرف الأول") وبين المركز المذكور أعلاه ("الطرف الثاني")، وذلك بهدف عرض خدمات الشريك وحجزها عبر المنصة وفق البنود التالية.</p>

    <h2>2. العمولة والعربون</h2>
    <p>يوافق الطرف الثاني على نسبة عمولة قدرها <b>${commission}%</b> من قيمة كل حجز يتم عبر المنصة، وتُحتسب كعربون قدره <b>${deposit}%</b> يُدفع مقدمًا من العميل ويُحوَّل للمنصة كعمولة عن الخدمة.</p>

    <h2>3. بنود الاتفاقية</h2>
    ${clausesHtml}

    <div class="signatures">
      <div class="sig">
        <div class="label">عن الطرف الأول (المنصة)</div>
        <div class="box"><div class="platform-sig">Khasomat</div></div>
        <div class="name">إدارة منصة خصومات</div>
        <div class="role">المدير التنفيذي</div>
      </div>
      <div class="sig">
        <div class="label">عن الطرف الثاني (الشريك)</div>
        <div class="box">
          ${a?.signature_image ? `<img src="${a.signature_image}" alt="توقيع الشريك"/>` : `<span style="color:#9ca3af;font-size:11px">— لم يتم التوقيع بعد —</span>`}
        </div>
        <div class="name">${a?.signed_name || safeOwnerName || "—"}</div>
        <div class="role">${safeVendorName}</div>
      </div>
    </div>

    ${signedStamp ? `<div class="stamp">✓ موقّعة إلكترونيًا بتاريخ ${displaySignedAt} — ${number}</div>` : ""}

    <div class="footer">
      هذه الوثيقة موقّعة إلكترونيًا عبر منصة خصومات · ${number} · ${version}
    </div>
  </div>
</div>
</body></html>`;
}

export function printAgreementPdf(html: string) {
  // Inject a print trigger so the new window auto-opens the print dialog
  // (which is where "Save as PDF" lives) after images/fonts load.
  const injected = html.replace(
    "</body>",
    `<script>
      (function(){
        function go(){ try { window.focus(); window.print(); } catch(e){} }
        if (document.readyState === 'complete') { setTimeout(go, 300); }
        else { window.addEventListener('load', function(){ setTimeout(go, 300); }); }
      })();
    </script></body>`
  );

  // Prefer a new tab — reliable across browsers and gives the user the
  // native print → "Save as PDF" flow.
  const win = window.open("", "_blank");
  if (win) {
    win.document.open();
    win.document.write(injected);
    win.document.close();
    return;
  }

  // Popup blocked → fallback to a hidden iframe.
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  const trigger = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {}
    setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 2000);
  };
  if (iframe.contentWindow) {
    iframe.contentWindow.addEventListener("load", () => setTimeout(trigger, 300));
  }
  setTimeout(trigger, 800);
}