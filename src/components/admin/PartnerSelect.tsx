import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { adminPartnersApi, partnerLabel, type AdminPartner } from "@/lib/api/adminPartners";
import { useLang } from "@/i18n/LanguageProvider";

type Props = {
  value: string;
  onChange: (id: string, partner?: AdminPartner) => void;
  placeholder?: string;
  disabled?: boolean;
};

/**
 * Searchable async dropdown for admin partner selection.
 * Hits GET /admin/partners?q= and shows a typeahead list.
 */
export function PartnerSelect({ value, onChange, placeholder, disabled }: Props) {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const ph = placeholder ?? L("ابحث بالاسم...", "Search by name...");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<AdminPartner[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminPartner | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fetch a selected partner's label when we only know its id
  useEffect(() => {
    let alive = true;
    if (value && (!selected || selected.id !== value)) {
      adminPartnersApi.get(value)
        .then((p) => { if (alive) setSelected(p); })
        .catch(() => {/* silent */});
    }
    if (!value) setSelected(null);
    return () => { alive = false; };
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await adminPartnersApi.list({ q: q || undefined, limit: 20 });
        setItems(data.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-right text-sm"
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected ? partnerLabel(selected) : L("— اختر شريكًا —", "— Select a partner —")}
        </span>
        {selected && (
          <X
            className="h-4 w-4 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setSelected(null); onChange(""); }}
          />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ph}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">{L("لا توجد نتائج", "No results")}</div>
            ) : (
              items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelected(p);
                    onChange(p.id, p);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-right text-sm hover:bg-accent"
                >
                  <span className="font-medium">{partnerLabel(p)}</span>
                  <span className="text-xs text-muted-foreground">
                    {[p.city, p.email, p.phone].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
