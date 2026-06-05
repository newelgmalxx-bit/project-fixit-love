import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, PanelCard, PrimaryButton, Pill, GhostButton, StatCard } from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { Plus, Trash2, Edit, UserCheck, Users, Shield, ShieldCheck, Loader2 } from "lucide-react";
import { adminUsers as initial, type AdminUser } from "@/data/admin";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { admin as adminApi } from "@/lib/api";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users | Admin" }] }),
  component: UsersPage,
});

type Form = {
  name: string;
  email: string;
  phone: string;
  city: string;
  avatar: string;
  role: AdminUser["role"];
  status: "active" | "suspended" | "pending";
  language: "ar" | "en";
  email_verified: boolean;
  password: string;
};
const empty: Form = {
  name: "",
  email: "",
  phone: "",
  city: "",
  avatar: "",
  role: "support",
  status: "active",
  language: "ar",
  email_verified: false,
  password: "",
};

const displayJoinedDate = (value?: unknown) => {
  const raw = typeof value === "string" ? value : value ? String(value) : "";
  if (!raw) return "—";

  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];

  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toISOString().slice(0, 10);
};

function UsersPage() {
  const { lang, dir } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const roleMap = {
    owner: { l: L("مالك", "Owner"), t: "amber" as const },
    admin: { l: L("مدير", "Admin"), t: "primary" as const },
    manager: { l: L("مشرف", "Manager"), t: "violet" as const },
    support: { l: L("دعم", "Support"), t: "emerald" as const },
    partner: { l: L("شريك", "Partner"), t: "violet" as const },
    client: { l: L("عميل", "Client"), t: "sky" as const },
  } as const;
  const [users, setUsers] = useState<AdminUser[]>(initial);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<Form>(empty);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const reload = () => {
    adminApi.users.list()
      .then((d) => {
        const items: AdminUser[] = (d.items || []).map((u: any) => ({
          id: u.id, name: u.name, email: u.email, phone: u.phone ?? "",
          role: (u.role as any) || "support",
          active: (u.status ?? "active") === "active",
          joinedAt: displayJoinedDate(u.created_at ?? u.createdAt ?? u.user?.created_at ?? u.user?.createdAt),
          city: u.city ?? "",
        } as AdminUser & { city: string }));
        if (items.length) setUsers(items);
      })
      .catch(() => {});
  };
  useEffect(() => { reload(); }, []);

  const openAdd = () => { setEditId(null); setF(empty); setOpen(true); };
  const openEdit = async (u: AdminUser) => {
    setEditId(u.id);
    setF({ ...empty, name: u.name, email: u.email, phone: u.phone, city: (u as any).city || "", role: u.role, status: u.active ? "active" : "suspended" });
    setOpen(true);
    setLoadingForm(true);
    try {
      const user: any = await adminApi.users.get(u.id);
      if (user) {
        setF({
          name: user.name ?? u.name ?? "",
          email: user.email ?? u.email ?? "",
          phone: user.phone ?? u.phone ?? "",
          city: user.city ?? user.city_name ?? user.cityName ?? (u as any).city ?? "",
          avatar: user.avatar ?? user.avatar_url ?? "",
          role: (user.role as any) || u.role || "support",
          status: (user.status as any) || (u.active ? "active" : "suspended"),
          language: (user.language as any) || "ar",
          email_verified: !!(user.email_verified ?? user.emailVerified),
          password: "",
        });
      }
    } catch {
      toast.error(L("تعذر تحميل بيانات المستخدم", "Failed to load user data"));
    } finally {
      setLoadingForm(false);
    }
  };

  const save = async () => {
    if (!f.name || !f.email) { toast.error(L("الاسم والبريد مطلوبان", "Name and email are required")); return; }
    setSaving(true);
    if (editId) {
      const payload: any = {
        name: f.name,
        email: f.email,
        phone: f.phone,
        city: f.city,
        avatar: f.avatar,
        role: f.role,
        status: f.status,
        language: f.language,
        email_verified: f.email_verified,
      };
      if (f.password) payload.password = f.password;
      try {
        await adminApi.users.update(editId, payload);
        setUsers(users.map(u => u.id === editId ? { ...u, name: f.name, email: f.email, phone: f.phone, role: f.role, active: f.status === "active" } : u));
        toast.success(L("تم التحديث", "Updated"));
        setOpen(false);
        reload();
      } catch (e: any) {
        toast.error(e?.message || L("فشل الحفظ", "Save failed"));
      } finally {
        setSaving(false);
      }
    } else {
      try {
        const res: any = await adminApi.users.invite({ name: f.name, email: f.email, phone: f.phone, role: f.role, password: f.password });
        const id = res?.id || res?.data?.id || "u" + Date.now();
        setUsers([{ id, name: f.name, email: f.email, phone: f.phone, role: f.role, active: f.status === "active", joinedAt: new Date().toLocaleDateString(lang === "en" ? "en-US" : "ar-SA") }, ...users]);
        toast.success(L("تم إضافة المستخدم", "User added"));
        setOpen(false);
        reload();
      } catch (e: any) {
        toast.error(e?.message || L("فشل الإضافة", "Failed to add"));
      } finally {
        setSaving(false);
      }
    }
  };

  const doRemove = async (u: AdminUser) => {
    const prev = users;
    setUsers(users.filter(x => x.id !== u.id));
    try {
      await adminApi.users.remove(u.id);
      toast.success(L("تم الحذف", "Deleted"));
    } catch (e: any) {
      setUsers(prev);
      toast.error(e?.message || L("فشل الحذف", "Delete failed"));
    } finally {
      setConfirmDelete(null);
    }
  };

  const toggle = async (u: AdminUser) => {
    const next = !u.active;
    setUsers(users.map(x => x.id === u.id ? { ...x, active: next } : x));
    try {
      await adminApi.users.setStatus(u.id, next ? "active" : "suspended");
    } catch (e: any) {
      setUsers(users.map(x => x.id === u.id ? { ...x, active: !next } : x));
      toast.error(e?.message || L("فشل تحديث الحالة", "Status update failed"));
    }
  };
  const knobOn = dir === "rtl" ? "right-0.5" : "left-0.5";
  const knobOff = dir === "rtl" ? "right-5" : "left-5";
  const textAlign = dir === "rtl" ? "text-right" : "text-left";

  return (
    <AdminLayout title={L("إدارة المستخدمين", "User Management")} subtitle={L("إدارة فريق العمل والصلاحيات", "Manage team and permissions")} action={<PrimaryButton onClick={openAdd}><Plus className="h-4 w-4" /> {L("إضافة مستخدم", "Add User")}</PrimaryButton>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label={L("إجمالي المستخدمين", "Total Users")} value={users.length} icon={Users} accent="primary" />
        <StatCard label={L("نشطون", "Active")} value={users.filter(u => u.active).length} icon={UserCheck} accent="emerald" />
        <StatCard label={L("مدراء", "Admins")} value={users.filter(u => u.role === "admin" || u.role === "owner").length} icon={ShieldCheck} accent="amber" />
        <StatCard label={L("موقوفون", "Suspended")} value={users.filter(u => !u.active).length} icon={Shield} accent="rose" />
      </div>

      <PanelCard>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className={`${textAlign} text-xs text-muted-foreground border-b border-border`}>
                <th className="px-3 py-3 font-medium">{L("المستخدم", "User")}</th>
                <th className="px-3 py-3 font-medium">{L("البريد", "Email")}</th>
                <th className="px-3 py-3 font-medium">{L("الجوال", "Phone")}</th>
                <th className="px-3 py-3 font-medium">{L("المدينة", "City")}</th>
                <th className="px-3 py-3 font-medium">{L("الدور", "Role")}</th>
                <th className="px-3 py-3 font-medium">{L("الحالة", "Status")}</th>
                <th className="px-3 py-3 font-medium">{L("انضم", "Joined")}</th>
                <th className="px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const r = roleMap[u.role] ?? { l: u.role || "—", t: "primary" as const };
                const initials = u.name.split(" ").map(n => n[0]).slice(0, 2).join("");
                return (
                  <tr key={u.id} className="border-b border-border hover:bg-muted/40">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">{initials}</div>
                        <div className="font-bold">{u.name}</div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground" dir="ltr">{u.phone}</td>
                    <td className="px-3 py-3 text-muted-foreground">{(u as any).city || "—"}</td>
                    <td className="px-3 py-3"><Pill tone={r.t}>{r.l}</Pill></td>
                    <td className="px-3 py-3">
                      <button onClick={() => toggle(u)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${u.active ? "bg-emerald-500" : "bg-muted"}`}>
                        <span className={`absolute inline-block h-5 w-5 rounded-full bg-white shadow transition ${u.active ? knobOn : knobOff}`} />
                      </button>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground" data-ltr-number>{u.joinedAt}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(u)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted text-primary"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => setConfirmDelete(u)} disabled={u.role === "owner"} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-rose-50 text-rose-500 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PanelCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir={dir} className="max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? L("تعديل مستخدم", "Edit User") : L("إضافة مستخدم جديد", "Add New User")}</DialogTitle></DialogHeader>
          {loadingForm ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Lb label={L("الاسم", "Name")}><input className={ic} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Lb>
              <Lb label={L("البريد", "Email")}><input className={ic} type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Lb>
              <Lb label={L("الجوال", "Phone")}><input type="tel" inputMode="tel" className={ic} dir="ltr" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Lb>
              <Lb label={L("المدينة", "City")}><input className={ic} value={f.city} onChange={e => setF({ ...f, city: e.target.value })} /></Lb>
              
              <Lb label={L("الدور", "Role")}>
                <select className={ic} value={f.role} onChange={e => setF({ ...f, role: e.target.value as any })}>
                  <option value="admin">{L("مدير", "Admin")}</option>
                  <option value="manager">{L("مشرف", "Manager")}</option>
                  <option value="support">{L("دعم", "Support")}</option>
                  <option value="owner">{L("مالك", "Owner")}</option>
                  <option value="partner">{L("شريك", "Partner")}</option>
                  <option value="client">{L("عميل", "Client")}</option>
                </select>
              </Lb>
              <Lb label={L("الحالة", "Status")}>
                <select className={ic} value={f.status} onChange={e => setF({ ...f, status: e.target.value as any })}>
                  <option value="active">{L("نشط", "Active")}</option>
                  <option value="suspended">{L("موقوف", "Suspended")}</option>
                  <option value="pending">{L("قيد المراجعة", "Pending")}</option>
                </select>
              </Lb>
              <Lb label={L("اللغة", "Language")}>
                <select className={ic} value={f.language} onChange={e => setF({ ...f, language: e.target.value as any })}>
                  <option value="ar">{L("العربية", "Arabic")}</option>
                  <option value="en">{L("الإنجليزية", "English")}</option>
                </select>
              </Lb>
              <Lb label={editId ? L("كلمة مرور جديدة (اختياري)", "New password (optional)") : L("كلمة المرور", "Password")}>
                <input type="password" className={ic} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
              </Lb>
              <Lb label={L("البريد موثّق", "Email verified")} full>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={f.email_verified} onChange={e => setF({ ...f, email_verified: e.target.checked })} /> {L("نعم", "Yes")}</label>
              </Lb>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <GhostButton onClick={() => setOpen(false)}>{L("إلغاء", "Cancel")}</GhostButton>
            <PrimaryButton onClick={saving || loadingForm ? () => {} : save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editId ? L("حفظ", "Save") : L("إضافة", "Add"))}
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{L("تأكيد الحذف", "Confirm delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {L(`هل تريد حذف المستخدم "${confirmDelete?.name ?? ""}"؟ لا يمكن التراجع عن هذه العملية.`, `Delete user "${confirmDelete?.name ?? ""}"? This cannot be undone.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{L("إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && doRemove(confirmDelete)} className="bg-rose-500 hover:bg-rose-600">{L("حذف", "Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
const ic = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
function Lb({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`text-xs font-bold space-y-1.5 block ${full ? "col-span-2" : ""}`}>{label}{children}</label>;
}
