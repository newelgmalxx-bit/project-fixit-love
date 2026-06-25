import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ChevronLeft, Send } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import type { Order } from "@/data/account";
import { useLang } from "@/i18n/LanguageProvider";
import { account } from "@/lib/api";
import { normalizeOrder } from "@/lib/api/normalize";
import { toast } from "sonner";

export const Route = createFileRoute("/account/tickets/new")({
  validateSearch: z.object({ order: z.string().optional() }),
  head: () => ({ meta: [{ title: "New Ticket | koswmat" }] }),
  component: NewTicket,
});

function NewTicket() {
  const { t, dir } = useLang();
  const { order: presetOrder } = Route.useSearch();
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [orderId, setOrderId] = useState(presetOrder ?? "");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    account.listOrders({ limit: 50 })
      .then((res) => setOrders((res.items || []).map(normalizeOrder)))
      .catch(() => setOrders([]));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await account.createTicket({
        subject: subject.trim(),
        orderId: orderId || undefined,
        priority,
        message: message.trim(),
      });
      toast.success(t("account.ticket.new.submit"));
      navigate({ to: "/account/tickets" as any });
    } catch (err: any) {
      toast.error(err?.message || "Failed");
      setSubmitting(false);
    }
  };

  return (
    <AccountLayout title={t("account.ticket.new.title")} subtitle={t("account.ticket.new.subtitle")}>
      <Link to={"/account/tickets" as any} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ChevronLeft className={`h-4 w-4 ${dir === "ltr" ? "rotate-180" : ""}`} /> {t("account.ticket.backAll")}
      </Link>

      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-bold">{t("account.ticket.new.subject")}</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            maxLength={120}
            placeholder={t("account.ticket.new.subjectPh")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-bold">{t("account.ticket.new.linkedOrder")}</label>
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{t("account.ticket.new.none")}</option>
            {orders.map((o) => (
                <option key={o.id} value={o.id}>{o.number}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold">{t("account.ticket.new.priority")}</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="low">{t("account.ticket.priority.low")}</option>
              <option value="normal">{t("account.ticket.priority.normal")}</option>
              <option value="high">{t("account.ticket.priority.high")}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-bold">{t("account.ticket.new.message")}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={6}
            maxLength={2000}
            placeholder={t("account.ticket.new.messagePh")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
          <Link to={"/account/tickets" as any} className="rounded-full border border-border px-5 py-2.5 text-sm font-bold hover:bg-muted">
            {t("account.ticket.new.cancel")}
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {submitting ? t("account.ticket.new.submitting") : t("account.ticket.new.submit")}
          </button>
        </div>
      </form>
    </AccountLayout>
  );
}