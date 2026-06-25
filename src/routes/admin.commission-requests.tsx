import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout, PanelCard, Pill } from "@/components/admin/AdminLayout";
import { adminCommissionRequestsApi } from "@/lib/api/adminCommissionRequests";
import { adminPartnersApi } from "@/lib/api/adminPartners";
import { adminAgreementsApi } from "@/lib/api/adminAgreements";
import { toast } from "sonner";
import { Check, X, Loader2, Percent, Search, FileText } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";


export const Route = createFileRoute("/admin/commission-requests")({
  head: () => ({ meta: [{ title: "Commission Requests | Admin" }] }),
  component: CommissionRequestsPage,
});

type Req = {
  id: string;
  partner_id: string;
  current_commission_pct: number | null;
  current_deposit_pct: number | null;
  requested_commission_pct: number;
  requested_deposit_pct: number;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

type Partner = { id: string; vendor_name: string; owner_name: string; city: string; phone: string };


function CommissionRequestsPage() {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const [items, setItems] = useState<Req[]>([]);
  const [partners, setPartners] = useState<Record<string, Partner>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await adminCommissionRequestsApi.list();
      const map: Record<string, Partner> = {};

      res.items.forEach((r: any) => {
        if (r.partnerId && !map[r.partnerId]) {
          map[r.partnerId] = {
            id: r.partnerId,
            vendor_name: r.partnerName || r.partner_name || r.vendorName || r.vendor_name || "",
            owner_name: r.ownerName || r.owner_name || "",
            city: r.partnerCity || r.city || "",
            phone: r.partnerPhone || r.partner_phone || r.phone || "",
          };
        }
      });

      const ids = Array.from(new Set(res.items.map((r: any) => r.partnerId).filter(Boolean))) as string[];
      const enriched: Record<string, any> = {};
      const latestAg: Record<string, any> = {};
      await Promise.all(
        ids.map(async (pid) => {
          try {
            const p: any = await adminPartnersApi.get(pid);
            enriched[pid] = p;
            map[pid] = {
              id: pid,
              vendor_name:
                p.vendorName || p.vendor_name || p.nameAr || p.name_ar || p.name ||
                map[pid]?.vendor_name || "",
              owner_name:
                p.ownerName || p.owner_name || map[pid]?.owner_name || "",
              city: p.city || map[pid]?.city || "",
              phone: p.phone || map[pid]?.phone || "",
            };
          } catch { /* ignore */ }
          try {
            const ags = await adminAgreementsApi.listPartnerAgreements(pid);
            const signed = ags
              .filter((a) => a.status === "signed")
              .sort((a, b) => (b.signedAt || b.createdAt || "").localeCompare(a.signedAt || a.createdAt || ""))[0];
            latestAg[pid] = signed
              || ags.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0]
              || null;
          } catch { /* ignore */ }
        })
      );

      const rows: Req[] = res.items.map((r) => {
        const p = enriched[r.partnerId] || {};
        const ag = latestAg[r.partnerId];
        const fallbackCurrent =
          (ag && typeof ag.commissionPct === "number" ? ag.commissionPct : null) ??
          p.commissionPct ?? p.commission_pct ?? null;
        const fallbackDeposit =
          (ag && typeof ag.depositPct === "number" ? ag.depositPct : null) ??
          p.depositPct ?? p.deposit_pct ?? null;
        const rawCurCom = r.currentCommissionPct ?? (r as any).current_commission_pct;
        const rawCurDep = r.currentDepositPct ?? (r as any).current_deposit_pct;
        const curCom = rawCurCom != null && Number(rawCurCom) > 0 ? Number(rawCurCom) : fallbackCurrent;
        const curDep = rawCurDep != null && Number(rawCurDep) > 0 ? Number(rawCurDep) : fallbackDeposit;
        return {
          id: r.id,
          partner_id: r.partnerId,
          current_commission_pct: curCom,
          current_deposit_pct: curDep,
          requested_commission_pct: r.requestedCommissionPct,
          requested_deposit_pct: r.requestedDepositPct,
          reason: r.reason,
          status: r.status,
          admin_notes: r.adminNotes ?? null,
          created_at: r.createdAt,
        };
      });


      setItems(rows);
      setPartners(map);
    } catch (err: any) {
      toast.error(err?.message || L("تعذّر تحميل الطلبات", "Failed to load requests"));
      setItems([]);
      setPartners({});
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function decide(req: Req, status: "approved" | "rejected") {
    const adminNote = notes[req.id] || null;

    if (req.id.startsWith("demo-")) {
      setItems((prev) => prev.map((r) => r.id === req.id ? { ...r, status, admin_notes: adminNote } : r));
      toast.success(status === "approved" ? L("تمت الموافقة (بيانات تجريبية)", "Approved (demo data)") : L("تم رفض الطلب (بيانات تجريبية)", "Rejected (demo data)"));
      return;
    }

    try {
      await adminCommissionRequestsApi.decide(req.id, status, adminNote);
      toast.success(status === "approved" ? L("تمت الموافقة وتحديث النسبة", "Approved and percentage updated") : L("تم رفض الطلب", "Request rejected"));
      load();
    } catch (err: any) {
      toast.error(err?.message || L("تعذّر تحديث الطلب", "Failed to update request"));
    }
  }

  const byStatus = filter === "all" ? items : items.filter((i) => i.status === filter);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? byStatus.filter((i) => {
        const p = partners[i.partner_id];
        if (!p) return false;
        return (
          p.vendor_name?.toLowerCase().includes(q) ||
          p.owner_name?.toLowerCase().includes(q) ||
          p.phone?.toLowerCase().includes(q)
        );
      })
    : byStatus;
  const pendingCount = items.filter((i) => i.status === "pending").length;

  const locale = lang === "en" ? "en-US" : "ar";

  return (
    <AdminLayout
      title={L("طلبات تعديل العمولة", "Commission Change Requests")}
      subtitle={L(`${pendingCount} طلب بانتظار المراجعة`, `${pendingCount} pending review`)}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {([
            ["all", L("الكل", "All"), items.length],
            ["pending", L("بانتظار", "Pending"), pendingCount],
            ["approved", L("مقبولة", "Approved"), items.filter((i) => i.status === "approved").length],
            ["rejected", L("مرفوضة", "Rejected"), items.filter((i) => i.status === "rejected").length],
          ] as const).map(([k, l, n]) => (

            <button
              key={k}
              onClick={() => setFilter(k as any)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold ${filter === k ? "bg-primary text-primary-foreground" : "text-foreground/60"}`}
            >
              {l} <span className="opacity-70">({n})</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L("ابحث باسم المركز أو رقم الهاتف…", "Search by merchant or phone…")}
            className="w-full rounded-xl border border-border bg-background ps-10 pe-3 py-2 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <PanelCard title="">
          <div className="py-12 text-center text-sm text-muted-foreground">
            {q ? L("لا توجد نتائج مطابقة للبحث.", "No results match your search.") : L("لا توجد طلبات في هذا التصنيف.", "No requests in this category.")}
          </div>
        </PanelCard>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const p = partners[r.partner_id];
            const tone = r.status === "approved" ? "emerald" : r.status === "rejected" ? "rose" : "amber";
            const label = r.status === "approved" ? L("مقبول", "Approved") : r.status === "rejected" ? L("مرفوض", "Rejected") : L("بانتظار", "Pending");
            return (
              <PanelCard
                key={r.id}
                title={p?.vendor_name || p?.owner_name || L("مركز", "Merchant")}
                subtitle={p ? [p.owner_name, p.city, p.phone].filter(Boolean).join(" · ") : r.partner_id}
                action={<Pill tone={tone as any}>{label}</Pill>}
              >
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <Percent className="h-3.5 w-3.5" /> {L("نسبة العمولة / العربون", "Commission / deposit %")}
                    <span className="text-[10px] font-medium text-muted-foreground/70">{L("(العربون الذي يدفعه العميل هو عمولة المنصة)", "(Customer's deposit is the platform commission)")}</span>
                  </div>
                  <div className="mt-1 text-lg font-extrabold">
                    <span className="text-muted-foreground">{r.current_commission_pct ?? "—"}%</span>
                    <span className="mx-2 text-muted-foreground">←</span>
                    <span className="text-primary">{r.requested_commission_pct}%</span>
                  </div>
                </div>


                <div className="mt-4 rounded-2xl border border-border bg-card/60 p-4">
                  <div className="flex items-center gap-2 mb-3 text-sm font-bold">
                    <FileText className="h-4 w-4 text-primary" /> {L("تفاصيل الطلب", "Request details")}
                  </div>
                  <dl className="grid gap-y-2 gap-x-4 text-sm sm:grid-cols-2">
                    <div className="flex justify-between sm:block">
                      <dt className="text-xs font-bold text-muted-foreground">{L("المركز (مقدّم الخدمة)", "Merchant (service provider)")}</dt>
                      <dd className="font-semibold">{p?.vendor_name || "—"}</dd>
                    </div>
                    <div className="flex justify-between sm:block">
                      <dt className="text-xs font-bold text-muted-foreground">{L("المسؤول", "Contact person")}</dt>
                      <dd className="font-semibold">{p?.owner_name || "—"}</dd>
                    </div>
                    <div className="flex justify-between sm:block">
                      <dt className="text-xs font-bold text-muted-foreground">{L("المدينة", "City")}</dt>
                      <dd className="font-semibold">{p?.city || "—"}</dd>
                    </div>
                    <div className="flex justify-between sm:block">
                      <dt className="text-xs font-bold text-muted-foreground">{L("رقم الهاتف", "Phone")}</dt>
                      <dd className="font-semibold" dir="ltr">{p?.phone || "—"}</dd>
                    </div>
                    <div className="flex justify-between sm:block">
                      <dt className="text-xs font-bold text-muted-foreground">{L("تاريخ الإرسال", "Submitted at")}</dt>
                      <dd className="font-semibold">{new Date(r.created_at).toLocaleString(locale)}</dd>
                    </div>
                    <div className="flex justify-between sm:block">
                      <dt className="text-xs font-bold text-muted-foreground">{L("الحالة", "Status")}</dt>
                      <dd className="font-semibold">{label}</dd>
                    </div>
                  </dl>

                  <div className="mt-3 rounded-xl border border-border bg-background p-3 text-sm">
                    <div className="text-xs font-bold text-muted-foreground mb-1">{L("سبب الطلب كاملًا", "Full reason")}</div>
                    <div className="whitespace-pre-wrap leading-relaxed">{r.reason || L("لم يُذكر سبب.", "No reason provided.")}</div>
                  </div>

                  {r.status !== "pending" && (
                    <div
                      className={`mt-3 rounded-xl border p-3 text-sm ${r.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}
                    >
                      <div className="text-xs font-bold mb-1">
                        {r.status === "approved" ? L("ملاحظة الموافقة", "Approval note") : L("سبب الرفض", "Rejection reason")}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {r.admin_notes || (r.status === "approved" ? L("تمت الموافقة دون ملاحظات إضافية.", "Approved with no additional notes.") : L("تم الرفض دون ملاحظات إضافية.", "Rejected with no additional notes."))}
                      </div>
                    </div>
                  )}
                </div>

                {r.status === "pending" && (
                  <div className="mt-4 space-y-3">
                    <textarea
                      value={notes[r.id] || ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      placeholder={L("ملاحظة الإدارة (سبب الموافقة أو الرفض)…", "Admin note (reason for approval or rejection)…")}
                      rows={2}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => decide(r, "approved")}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-4 w-4" /> {L("موافقة وتطبيق النسبة", "Approve & apply rate")}
                      </button>
                      <button
                        onClick={() => decide(r, "rejected")}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                      >
                        <X className="h-4 w-4" /> {L("رفض", "Reject")}
                      </button>
                    </div>
                  </div>
                )}
              </PanelCard>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
