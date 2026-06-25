import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { AdminLayout, PanelCard } from "@/components/admin/AdminLayout";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/admin/messages")({
  head: () => ({ meta: [{ title: "Messages | Admin" }] }),
  component: AdminMessagesPage,
});

function AdminMessagesPage() {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  return (
    <AdminLayout title={L("الرسائل", "Messages")} subtitle={L("عرض ومتابعة محادثات العملاء مع المراكز", "View and follow conversations between customers and merchants")}>
      <PanelCard>
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 opacity-40" />
          <p className="text-sm font-bold">{L("لا توجد محادثات بعد", "No conversations yet")}</p>
          <p className="max-w-md text-xs">
            {L(
              "ستظهر هنا محادثات العملاء مع المراكز عند تفعيل خدمة المراسلة في الخلفية.",
              "Customer conversations with merchants will appear here once the messaging service is enabled.",
            )}
          </p>
        </div>
      </PanelCard>
    </AdminLayout>
  );
}
