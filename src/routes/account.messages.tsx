import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Send, Lock, MessageSquare } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { demoMessages } from "@/data/demoMessages";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/account/messages")({
  head: () => ({ meta: [{ title: "الرسائل | حسابي" }] }),
  component: AccountMessagesPage,
});

function AccountMessagesPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [, force] = useState(0);
  useEffect(() => demoMessages.subscribe(() => force((n) => n + 1)), []);
  const all = demoMessages.list();
  const mine = all.filter((c) => !user?.name || c.userName === user.name);
  const list = mine.length > 0 ? mine : all;

  const [activeId, setActiveId] = useState<string | null>(list[0]?.id ?? null);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!activeId && list[0]) setActiveId(list[0].id);
  }, [list, activeId]);

  const active = list.find((c) => c.id === activeId) || null;

  useEffect(() => {
    if (active) demoMessages.markRead(active.id, "user");
  }, [active?.id]);

  const send = () => {
    if (!active || !text.trim() || active.closed) return;
    demoMessages.send(active.id, "user", text.trim());
    setText("");
  };

  return (
    <AccountLayout title={t("account.messages.title")} subtitle={t("account.messages.subtitle")}>
      <div className="grid gap-4 md:grid-cols-[280px_1fr] md:h-[560px]">
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="border-b border-border p-4 text-sm font-extrabold">{t("account.messages.conversations")}</div>
          <div className="max-h-[500px] overflow-y-auto">
            {list.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">{t("account.messages.empty")}</div>
            )}
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-start gap-3 border-b border-border p-3 text-start transition hover:bg-muted/30 ${activeId === c.id ? "bg-primary/5" : ""}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {c.partnerName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-bold">{c.partnerName}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{c.lastTime}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {c.messages[c.messages.length - 1]?.text ?? ""}
                    </span>
                    {c.unreadUser > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {c.unreadUser}
                      </span>
                    )}
                  </div>
                  {c.closed && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-rose-600">
                      <Lock className="h-3 w-3" /> {t("account.messages.closed")}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10" />
              <p className="text-sm">{t("account.messages.selectConversation")}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {active.partnerName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-extrabold">{active.partnerName}</div>
                    <div className="text-[11px] text-muted-foreground">{active.partnerCity}</div>
                  </div>
                </div>
                {active.closed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-600">
                    <Lock className="h-3 w-3" /> {t("account.messages.closedByAdmin")}
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
                {active.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                        m.from === "user"
                          ? "bg-gradient-to-br from-[#3F2A6B] to-[#E0254D] text-white"
                          : "bg-card border border-border"
                      }`}
                    >
                      <div>{m.text}</div>
                      <div className={`mt-1 text-[10px] ${m.from === "user" ? "text-white/70" : "text-muted-foreground"}`}>
                        {m.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {active.closed ? (
                <div className="border-t border-border bg-rose-50/40 p-3 text-center text-xs text-rose-600">
                  <Lock className="me-1 inline h-3 w-3" />
                  {t("account.messages.closedHint")}{active.closedReason ? ` — ${active.closedReason}` : ""}
                </div>
              ) : (
                <div className="flex items-center gap-2 border-t border-border p-3">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                    placeholder={t("account.messages.typeHere")}
                    className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                  <button
                    onClick={send}
                    className="rounded-full bg-gradient-to-r from-[#3F2A6B] to-[#E0254D] p-3 text-white shadow"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AccountLayout>
  );
}
