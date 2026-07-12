import { useLang } from "@/i18n/LanguageProvider";

export type WorkingHour = { day: string; open: string; close: string; closed: boolean };

export const WEEK_DAYS: { key: string; ar: string; en: string }[] = [
  { key: "saturday", ar: "السبت", en: "Sat" },
  { key: "sunday", ar: "الأحد", en: "Sun" },
  { key: "monday", ar: "الاثنين", en: "Mon" },
  { key: "tuesday", ar: "الثلاثاء", en: "Tue" },
  { key: "wednesday", ar: "الأربعاء", en: "Wed" },
  { key: "thursday", ar: "الخميس", en: "Thu" },
  { key: "friday", ar: "الجمعة", en: "Fri" },
];

export function defaultWorkingHours(): WorkingHour[] {
  return WEEK_DAYS.map((d) => ({
    day: d.key,
    open: d.key === "friday" ? "00:00" : "09:00",
    close: d.key === "friday" ? "00:00" : "22:00",
    closed: d.key === "friday",
  }));
}

export function parseWorkingHours(raw: any): WorkingHour[] {
  if (!raw) return defaultWorkingHours();
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length) {
      return WEEK_DAYS.map((d) => {
        const found = arr.find((x: any) => String(x?.day || "").toLowerCase() === d.key);
        if (!found) return { day: d.key, open: "09:00", close: "22:00", closed: false };
        const open = String(found.open || found.from || "09:00");
        const close = String(found.close || found.to || "22:00");
        const closed = !!found.closed || (open === "00:00" && close === "00:00");
        return { day: d.key, open, close, closed };
      });
    }
  } catch {}
  return defaultWorkingHours();
}

export function BranchHoursEditor({
  value,
  onChange,
}: {
  value: WorkingHour[];
  onChange: (next: WorkingHour[]) => void;
}) {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const hours = value?.length ? value : defaultWorkingHours();

  const update = (idx: number, patch: Partial<WorkingHour>) => {
    const next = [...hours];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold">{L("ساعات العمل", "Working hours")}</span>
        <button
          type="button"
          onClick={() => onChange(defaultWorkingHours())}
          className="text-[11px] font-bold text-primary hover:underline"
        >
          {L("استعادة الافتراضي", "Reset default")}
        </button>
      </div>
      <div className="space-y-1.5">
        {WEEK_DAYS.map((d, idx) => {
          const wh = hours[idx] || { day: d.key, open: "09:00", close: "22:00", closed: false };
          return (
            <div key={d.key} className="flex items-center gap-2 rounded-lg bg-background px-2 py-1.5">
              <span className="w-16 shrink-0 text-xs font-bold">{L(d.ar, d.en)}</span>
              <label className="flex items-center gap-1.5 text-[11px] font-bold">
                <input
                  type="checkbox"
                  checked={!wh.closed}
                  onChange={(e) => update(idx, { closed: !e.target.checked })}
                />
                {L("مفتوح", "Open")}
              </label>
              <input
                type="time"
                value={wh.open}
                disabled={wh.closed}
                onChange={(e) => update(idx, { open: e.target.value })}
                className="rounded-md border border-border bg-background px-1.5 py-1 text-xs disabled:opacity-40"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <input
                type="time"
                value={wh.close}
                disabled={wh.closed}
                onChange={(e) => update(idx, { close: e.target.value })}
                className="rounded-md border border-border bg-background px-1.5 py-1 text-xs disabled:opacity-40"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
