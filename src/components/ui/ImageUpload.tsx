import { useRef, useState } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { uploadFile, type UploadBucket } from "@/lib/api/adminContent";
import { useLang } from "@/i18n/LanguageProvider";

type Props = {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  /** Backend bucket name (avatars, offers, partner-logos, general, ...). */
  folder?: UploadBucket | string;
  className?: string;
  aspect?: string; // tailwind aspect-* class, e.g. "aspect-video"
};

function isPartnerSession(): boolean {
  try {
    if (typeof window !== "undefined") return !!localStorage.getItem("saba_partner");
  } catch { /* ignore */ }
  return false;
}

function resolveBucket(folder?: string): UploadBucket {
  const allowed: UploadBucket[] = [
    "avatars",
    "offers",
    "agreements",
    "messages",
    "quote-files",
    "partner-logos",
    "partner-covers",
    "partner-general",
    "offer-images",
    "general",
  ];
  if (folder && (allowed as string[]).includes(folder)) return folder as UploadBucket;

  // Heuristic mapping for legacy folder strings → backend-allowed buckets
  const f = (folder || "").toLowerCase();
  if (isPartnerSession()) {
    if (f.includes("logo")) return "partner-logos";
    if (f.includes("cover")) return "partner-covers";
    if (f.includes("offer")) return "offer-images";
    return "partner-general";
  }
  return "general";
}

export function ImageUpload({
  value,
  onChange,
  label,
  folder = "general",
  className = "",
  aspect = "aspect-video",
}: Props) {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error(L("الحد الأقصى 8 ميجا", "Max size is 8 MB"));
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error(L("الملف يجب أن يكون صورة", "File must be an image"));
      return;
    }
    setBusy(true);
    try {
      const res = await uploadFile(file, resolveBucket(folder));
      onChange(res.url);
      toast.success(L("تم رفع الصورة", "Image uploaded"));
    } catch (e: any) {
      toast.error(e?.message || L("فشل رفع الصورة", "Image upload failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <div className="text-sm font-bold text-foreground/80">{label}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className={`relative ${aspect} w-full overflow-hidden rounded-xl border border-border bg-muted`}>
          <img src={value} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-foreground hover:bg-white"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {L("تغيير", "Change")}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 rounded-full bg-rose-500/90 px-3 py-1 text-xs font-bold text-white hover:bg-rose-600"
            >
              <X className="h-3.5 w-3.5" /> {L("حذف", "Remove")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={`flex ${aspect} w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground hover:border-primary hover:bg-muted/50 transition-colors`}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <>
              <ImageIcon className="h-6 w-6" />
              <div className="text-xs font-bold">{L("اضغط لرفع صورة", "Click to upload an image")}</div>
              <div className="text-[10px]">{L("JPG / PNG / WEBP — حتى 8 ميجا", "JPG / PNG / WEBP — up to 8 MB")}</div>
            </>
          )}
        </button>
      )}
    </div>
  );
}

type MultiProps = {
  values: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  folder?: UploadBucket | string;
  label?: string;
};

export function ImageUploadMulti({ values, onChange, max = 6, folder = "general", label }: MultiProps) {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList) {
    const remaining = Math.max(0, max - values.length);
    const list = Array.from(files).slice(0, remaining);
    if (!list.length) {
      toast.error(L(`الحد الأقصى ${max} صور`, `Max ${max} images`));
      return;
    }
    setBusy(true);
    const next: string[] = [];
    try {
      for (const file of list) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 8 * 1024 * 1024) {
          toast.error(L(`${file.name} أكبر من 8MB`, `${file.name} is larger than 8MB`));
          continue;
        }
        try {
          const res = await uploadFile(file, resolveBucket(folder));
          next.push(res.url);
        } catch (e: any) {
          toast.error(e?.message || L(`فشل رفع ${file.name}`, `Failed to upload ${file.name}`));
        }
      }
      if (next.length) {
        onChange([...values, ...next]);
        toast.success(L(`تم رفع ${next.length} صورة`, `Uploaded ${next.length} image(s)`));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {label && <div className="text-sm font-bold text-foreground/80">{label}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {values.map((url, i) => (
          <div key={url + i} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="absolute top-1 end-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {values.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/30 text-muted-foreground hover:border-primary"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span className="text-[10px] font-bold">{L("إضافة", "Add")}</span>
          </button>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">{values.length} / {max} — {L("JPG / PNG / WEBP حتى 8 ميجا", "JPG / PNG / WEBP up to 8 MB")}</div>
    </div>
  );
}
