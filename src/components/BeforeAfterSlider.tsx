import { useCallback, useRef, useState } from "react";
import { useLang } from "@/i18n/LanguageProvider";

type Props = {
  before: string;
  after: string;
  alt?: string;
  className?: string;
  beforeLabel?: string;
  afterLabel?: string;
};

export function BeforeAfterSlider({
  before,
  after,
  alt = "",
  className = "",
  beforeLabel,
  afterLabel,
}: Props) {
  const { lang } = useLang();
  const L = (a: string, e: string) => (lang === "en" ? e : a);
  beforeLabel = beforeLabel ?? L("قبل", "Before");
  afterLabel = afterLabel ?? L("بعد", "After");
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromEvent = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateFromEvent(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateFromEvent(e.clientX);
  };
  const onUp = () => { dragging.current = false; };

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden select-none touch-none ${className}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* before image (full) */}
      <img src={before} alt={alt} className="absolute inset-0 h-full w-full object-cover pointer-events-none" loading="lazy" />

      {/* after image clipped */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      >
        <img src={after} alt={alt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      </div>

      {/* labels — before on left, after on right */}
      <span className="absolute left-3 bottom-3 z-10 rounded-full bg-white/95 px-3 py-1 text-[10px] font-extrabold text-primary shadow">
        {beforeLabel}
      </span>
      <span className="absolute right-3 bottom-3 z-10 rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold text-primary-foreground shadow">
        {afterLabel}
      </span>

      {/* divider + handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.1)] pointer-events-none"
        style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
      />
      <div
        className="absolute top-1/2 z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-primary shadow-lg ring-2 ring-primary/30"
        style={{ left: `${pos}%` }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 7l-5 5 5 5" />
          <path d="M16 7l5 5-5 5" />
        </svg>
      </div>
    </div>
  );
}
