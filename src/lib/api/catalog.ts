// Normalizers and decoration maps for catalog data (offers, categories, partners).
// The backend returns canonical fields; the UI components were built against an
// older mock shape with `Vendor`, `category` slug, gradient `color`, emoji `icon`.
// We adapt API rows into that legacy UI shape so existing components keep working.

import type { Category, CategorySlug, Offer, Vendor } from "@/data/offers";

/* ──────────────── API types (server side) ──────────────── */

export type ApiCategory = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn?: string | null;
  icon?: string | null;
  color?: string | null;
  cover?: string | null;
  sortOrder?: number;
  offersCount?: number | null;
};

export type ApiOffer = {
  id: string;
  partnerId?: string | null;
  categoryId?: string | null;
  titleAr?: string;
  titleEn?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  overviewAr?: any;
  overviewEn?: any;
  image?: string | null;
  gallery?: Array<{ id?: string; url?: string; sortOrder?: number }>;
  priceBefore?: number | string;
  priceAfter?: number | string;
  discountPercent?: number;
  durationMinutes?: number | null;
  termsAr?: any;
  termsEn?: any;
  isFeatured?: boolean | number;
  featuredSort?: number;
  status?: string;
  validFrom?: string | null;
  validTo?: string | null;
};

export type ApiPartner = {
  id: string;
  vendorNameAr?: string;
  vendorNameEn?: string | null;
  city?: string | null;
  categoryId?: string | null;
  categoryNameAr?: string | null;
  logo?: string | null;
  cover?: string | null;
  aboutAr?: string | null;
  aboutEn?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  mapsUrl?: string | null;
  addressAr?: string | null;
  workingHoursAr?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  offers?: ApiOffer[];
};

/* ──────────────── Decoration fallback ──────────────── */
// Gradient + emoji fallbacks when the backend doesn't provide them.
const DECOR: Record<string, { color: string; icon: string }> = {
  "medical-centers": { color: "from-sky-500 to-indigo-600", icon: "🏥" },
  "women-salons":    { color: "from-pink-500 to-rose-600", icon: "💇‍♀️" },
  "cupping":         { color: "from-red-500 to-orange-600", icon: "🩸" },
  "fitness":         { color: "from-emerald-500 to-teal-600", icon: "💪" },
  "labs":            { color: "from-cyan-500 to-blue-600", icon: "🧪" },
  "spa":             { color: "from-purple-500 to-fuchsia-600", icon: "🌸" },
  "car-wash":        { color: "from-slate-600 to-blue-700", icon: "🚗" },
};
const DEFAULT_DECOR = { color: "from-slate-600 to-slate-800", icon: "✨" };

const DEFAULT_COVER = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80";

/* ──────────────── Category normalizer ──────────────── */
// Accept api.icon only if it's a URL or a short emoji/symbol (≤4 code points).
// Backends sometimes store the Arabic name in the icon field, which then
// overflows the small icon badge — fall back to the slug-based emoji.
function pickIcon(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  const v = raw.trim();
  if (!v) return fallback;
  if (/^https?:\/\//i.test(v)) return v;
  const len = [...v].length;
  if (len <= 4) return v;
  return fallback;
}

export function normalizeCategory(api: ApiCategory): Category {
  const decor = DECOR[api.slug] ?? DEFAULT_DECOR;
  return {
    slug: api.slug as CategorySlug,
    nameAr: api.nameAr,
    nameEn: api.nameEn || api.nameAr,
    icon: pickIcon(api.icon, decor.icon),
    color: api.color || decor.color,
    cover: api.cover || DEFAULT_COVER,
  };
}

/* ──────────────── Offer normalizer ──────────────── */
function pickImage(api: ApiOffer): string {
  if (api.image) return api.image;
  const first = api.gallery?.[0]?.url;
  return first || DEFAULT_COVER;
}

function toNum(v: number | string | undefined | null): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

function toPct(v: number | string | undefined | null): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(v);
  return isFinite(n) && n > 0 ? n : undefined;
}

function defaultVendor(api: ApiOffer): Vendor {
  const o: any = api;
  const commission = toPct(
    o.commissionPctOverride ?? o.commission_pct_override ??
    o.commissionPct ?? o.commission_pct,
  );
  const deposit = toPct(o.depositPct ?? o.deposit_pct ?? commission);
  return {
    id: api.partnerId || "—",
    name: "",
    city: "",
    address: "",
    rating: 0,
    reviewsCount: 0,
    verified: true,
    commissionPct: commission,
    depositPct: deposit,
  };
}

/**
 * Map an API offer into the legacy UI Offer shape.
 * `categoryIdToSlug` lets us turn the offer's category_id into the slug
 * the UI uses for routing. Pass it after the categories list is loaded.
 */
export function normalizeOffer(
  api: ApiOffer,
  categoryIdToSlug: Map<string, string> = new Map(),
  partner?: ApiPartner | null,
): Offer {
  const priceBefore = toNum(api.priceBefore);
  const priceAfter = toNum(api.priceAfter);
  const slug =
    (api.categoryId && categoryIdToSlug.get(api.categoryId)) || ("women-salons" as CategorySlug);

  const vendor: Vendor = partner
    ? (() => {
        const p: any = partner;
        const o: any = api;
        // Per-offer override wins, then partner value, then fallback.
        const commission = toPct(
          o.commissionPctOverride ?? o.commission_pct_override ??
          o.commissionPct ?? o.commission_pct ??
          p.commissionPct ?? p.commission_pct,
        );
        const deposit = toPct(
          o.depositPct ?? o.deposit_pct ??
          p.depositPct ?? p.deposit_pct ?? commission,
        );
        return {
          // optional partner fields used by some pages
          ...p,
          id: partner.id,
          name: partner.vendorNameAr || partner.vendorNameEn || "",
          city: partner.city || "",
          address: partner.addressAr || "",
          rating: Number(partner.rating || 0),
          reviewsCount: Number(partner.reviewsCount || 0),
          verified: true,
          commissionPct: commission,
          depositPct: deposit,
        };
      })()
    : defaultVendor(api);

  // overview / terms can be JSON arrays or strings from the backend
  const toArr = (v: any): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof v === "string") {
      const s = v.trim();
      if (!s) return [];
      if (s.startsWith("[")) {
        try {
          const j = JSON.parse(s);
          if (Array.isArray(j)) return j.map(String).map((x) => x.trim()).filter(Boolean);
        } catch { /* fall through */ }
      }
      return s.split(/\r?\n+/).map((x) => x.trim()).filter(Boolean);
    }
    return [];
  };

  const galleryUrls = Array.isArray(api.gallery)
    ? api.gallery
        .slice()
        .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0))
        .map((g) => g?.url)
        .filter((u): u is string => Boolean(u))
    : [];

  return {
    id: String(api.id),
    title: api.titleAr || api.titleEn || "عرض",
    description: api.descriptionAr || api.descriptionEn || "",
    image: pickImage(api),
    gallery: galleryUrls,
    priceBefore,
    priceAfter,
    discountPercent: Number(api.discountPercent || 0),
    durationMinutes: Number(api.durationMinutes || 0),
    category: slug as CategorySlug,
    vendor,
    overview: toArr(api.overviewAr),
    overviewEn: toArr(api.overviewEn),
    terms: toArr(api.termsAr),
    termsEn: toArr(api.termsEn),
    featured: Boolean(api.isFeatured),
    featuredRank: api.featuredSort ?? null,
  } as Offer;
}

export const __decorFallback = DECOR;
