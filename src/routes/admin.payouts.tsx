import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout, PanelCard, Pill } from "@/components/admin/AdminLayout";
import { toast } from "sonner";
import { Check, X, Wallet, TrendingUp, Clock } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/admin/payouts")({
  head: () => ({ meta: [{ title: "Payouts | Admin" }] }),
  component: PayoutsPage,
});

type Payout = {
  id: string;
  partnerAr: string; partnerEn: string;
  cityAr: string; cityEn: string;
  amount: number;
  iban: string;
  bankAr: string; bankEn: string;
  dateAr: string; dateEn: string;
  status: "pending" | "approved" | "rejected";
};

const initialPayouts: Payout[] = [
  { id: "WD-1042", partnerAr: "مركز جمال ريم", partnerEn: "Reem Beauty Center", cityAr: "الرياض", cityEn: "Riyadh", amount: 4820, iban: "SA03 8000 0000 6080 1016 7519", bankAr: "الراجحي", bankEn: "Al Rajhi", dateAr: "اليوم 10:24", dateEn: "Today 10:24", status: "pending" },
  { id: "WD-1041", partnerAr: "عيادة د. سلمى", partnerEn: "Dr. Salma Clinic", cityAr: "جدة", cityEn: "Jeddah", amount: 7200, iban: "SA44 2000 0001 2345 6789 0123", bankAr: "الأهلي", bankEn: "Al Ahli", dateAr: "أمس 16:45", dateEn: "Yesterday 16:45", status: "pending" },
  { id: "WD-1038", partnerAr: "سبا اللؤلؤة", partnerEn: "Pearl Spa", cityAr: "الدمام", cityEn: "Dammam", amount: 3150, iban: "SA12 3000 0009 8765 4321 0987", bankAr: "الإنماء", bankEn: "Al Inma", dateAr: "قبل يومين", dateEn: "2 days ago", status: "approved" },
  { id: "WD-1035", partnerAr: "مركز التألق", partnerEn: "Talluq Center", cityAr: "الرياض", cityEn: "Riyadh", amount: 1980, iban: "SA56 4000 0005 6789 1234 5678", bankAr: "الرياض", bankEn: "Riyad Bank", dateAr: "قبل 4 أيام", dateEn: "4 days ago", status: "rejected" },
];

function PayoutsPage() {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const [items, setItems] = useState<Payout[]>(initialPayouts);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  function decide(id: string, status: "approved" | "rejected") {
    setItems((arr) => arr.map((p) => (p.id === id ? { ...p, status } : p)));
    toast.success(status === "approved" ? L("تمت الموافقة على السحب", "Payout approved") : L("تم رفض الطلب", "Request rejected"));
  }

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);
  const totals = {
    pending: items.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0),
    approved: items.filter((i) => i.status === "approved").reduce((s, i) => s + i.amount, 0),
    total: items.reduce((s, i) => s + i.amount, 0),
  };
  const currency = L("ر.س", "SAR");

  const cards = [
    { label: L("بانتظار المراجعة", "Pending review"), value: `${totals.pending.toLocaleString()} ${currency}`, icon: Clock, color: "from-amber-500 to-orange-600" },
    { label: L("تمت الموافقة", "Approved"), value: `${totals.approved.toLocaleString()} ${currency}`, icon: Wallet, color: "from-emerald-500 to-teal-600" },
    { label: L("إجمالي السحوبات", "Total payouts"), value: `${totals.total.toLocaleString()} ${currency}`, icon: TrendingUp, color: "from-violet-500 to-purple-600" },
  ];

  return (
    <AdminLayout title={L("المدفوعات والسحوبات", "Payouts & Withdrawals")} subtitle={L("مراجعة طلبات سحب أرصدة الشركاء", "Review partner withdrawal requests")}>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-3xl border border-border bg-card p-6">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${c.color} text-white shadow`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-2xl font-black text-foreground" dir="ltr">{c.value}</div>
            <div className="mt-1 text-xs font-bold text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 inline-flex flex-wrap rounded-xl border border-border bg-card p-1">
        {([
          ["pending", L("بانتظار", "Pending"), items.filter((i) => i.status === "pending").length],
          ["approved", L("مقبولة", "Approved"), items.filter((i) => i.status === "approved").length],
          ["rejected", L("مرفوضة", "Rejected"), items.filter((i) => i.status === "rejected").length],
          ["all", L("الكل", "All"), items.length],
        ] as const).map(([k, l, n]) => (
          <button key={k} onClick={() => setFilter(k as any)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold ${filter === k ? "bg-primary text-primary-foreground" : "text-foreground/60"}`}>
            {l} <span className="opacity-70">({n})</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((p) => {
          const tone = p.status === "approved" ? "emerald" : p.status === "rejected" ? "rose" : "amber";
          const label = p.status === "approved" ? L("مقبول", "Approved") : p.status === "rejected" ? L("مرفوض", "Rejected") : L("بانتظار", "Pending");
          const partner = L(p.partnerAr, p.partnerEn);
          const city = L(p.cityAr, p.cityEn);
          const date = L(p.dateAr, p.dateEn);
          const bank = L(p.bankAr, p.bankEn);
          return (
            <PanelCard key={p.id} title={partner}
              subtitle={`${p.id} · ${city} · ${date}`}
              action={<Pill tone={tone as any}>{label}</Pill>}>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-muted/30 p-3">
                  <div className="text-xs font-bold text-muted-foreground">{L("المبلغ", "Amount")}</div>
                  <div className="mt-1 text-lg font-extrabold text-primary" dir="ltr">{p.amount.toLocaleString()} {currency}</div>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-3">
                  <div className="text-xs font-bold text-muted-foreground">{L("البنك", "Bank")}</div>
                  <div className="mt-1 text-sm font-bold">{bank}</div>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-3">
                  <div className="text-xs font-bold text-muted-foreground">IBAN</div>
                  <div className="mt-1 text-xs font-mono" dir="ltr">{p.iban}</div>
                </div>
              </div>
              {p.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => decide(p.id, "approved")}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                    <Check className="h-4 w-4" /> {L("موافقة وتحويل", "Approve & transfer")}
                  </button>
                  <button onClick={() => decide(p.id, "rejected")}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">
                    <X className="h-4 w-4" /> {L("رفض", "Reject")}
                  </button>
                </div>
              )}
            </PanelCard>
          );
        })}
      </div>
    </AdminLayout>
  );
}
