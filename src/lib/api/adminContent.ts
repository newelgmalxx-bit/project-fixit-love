// API services for Categories, Cities, Offers, Featured Offers,
// Sponsored Ads, and Upload — wired to the real backend at koswmat.com/api.
//
// Response envelope: { success, data, message }. We unwrap `data` and let
// errors bubble up via ApiError (consumed by toast/alert in the UI).

import { request, BASE, getToken } from "./client";
import type { ApiResponse } from "./types";

// ---------- Types ----------
export type AdminCategory = {
  id: number | string;
  slug: string;
  nameAr: string;
  nameEn: string;
  icon?: string | null;
  color?: string | null;
  cover?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  isActive: boolean;
  sortOrder: number;
  offersCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminCity = {
  id: number | string;
  slug: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  sortOrder: number;
};

export type AdminOfferPartner = {
  id: string;
  vendorName: string;
  vendorNameAr?: string;
  vendorNameEn?: string;
  ownerName?: string;
  owner_name?: string;
  contactName?: string;
  name?: string;
  nameAr?: string;
  nameEn?: string;
  city?: string;
  status?: string;
};

export type AdminOfferCategory = {
  id: number | string;
  slug: string;
  nameAr: string;
  nameEn: string;
};

export type OfferStatus = "draft" | "active" | "paused" | "archived" | "expired";

export type AdminOffer = {
  id: string;
  partnerId: string;
  partner?: AdminOfferPartner;
  branchId?: string | null;
  branch?: { id: string; nameAr?: string; nameEn?: string | null; name_ar?: string; name_en?: string | null; address?: string | null; phone?: string | null } | null;
  branchIds?: string[];
  branches?: Array<{ id: string; nameAr?: string; nameEn?: string | null; name_ar?: string; name_en?: string | null; address?: string | null; phone?: string | null }>;
  branchesCount?: number;
  categoryId: string | number | null;
  category?: AdminOfferCategory | null;
  /** Arabic title (primary, required). */
  title: string;
  /** English title (optional). */
  titleEn?: string | null;
  description?: string | null;
  /** English description (optional). */
  descriptionEn?: string | null;
  image?: string | null;
  gallery?: string[];
  overviewBullets?: string[];
  /** English overview bullets (optional). */
  overviewBulletsEn?: string[];
  terms?: string[];
  /** English terms (optional). */
  termsEn?: string[];
  priceBefore?: number | null;
  priceAfter: number;
  discountPercent?: number | null;
  durationMinutes?: number | null;
  status: OfferStatus;
  featuredRank?: number | null;
  commissionPctOverride?: number | null;
  viewsCount?: number;
  bookingsCount?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isFeatured?: boolean;
};

export type AdminOfferInput = {
  partnerId: string;
  branchId?: string | null;
  branchIds?: string[];
  categoryId: string | number | null;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  image?: string | null;
  gallery?: string[];
  overviewBullets?: string[];
  overviewBulletsEn?: string[];
  terms?: string[];
  termsEn?: string[];
  priceBefore?: number | null;
  priceAfter: number;
  discountPercent?: number | null;
  durationMinutes?: number | null;
  status?: OfferStatus;
  featuredRank?: number | null;
  commissionPctOverride?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type FeaturedOffer = {
  id: number | string;
  offerId: string;
  offer?: AdminOffer;
  sortOrder: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
};

export type SponsoredAd = {
  id: number | string;
  title: string;
  subtitle?: string | null;
  image?: string | null;
  ctaLabel?: string | null;
  linkUrl?: string | null;
  offerId?: string | null;
  partnerId?: string | null;
  slideIndex?: number | null;
  sortOrder: number;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type UploadResult = {
  id: string;
  bucket: string;
  path: string;
  url: string;
  mime: string;
  size: number;
  originalName: string;
  createdAt: string;
};

export type UploadBucket =
  | "avatars"
  | "offers"
  | "agreements"
  | "messages"
  | "quote-files"
  | "partner-logos"
  | "partner-covers"
  | "partner-general"
  | "offer-images"
  | "general";

// ---------- Helpers ----------
function qs(params?: Record<string, any>): string {
  if (!params) return "";
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    clean[k] = String(v);
  }
  const s = new URLSearchParams(clean).toString();
  return s ? "?" + s : "";
}

function normalizeCategory(raw: any): AdminCategory {
  return {
    id: raw?.id,
    slug: raw?.slug ?? "",
    nameAr: raw?.nameAr ?? raw?.name_ar ?? raw?.name ?? "",
    nameEn: raw?.nameEn ?? raw?.name_en ?? "",
    icon: raw?.icon ?? null,
    color: raw?.color ?? null,
    cover: raw?.cover ?? null,
    descriptionAr: raw?.descriptionAr ?? raw?.description_ar ?? null,
    descriptionEn: raw?.descriptionEn ?? raw?.description_en ?? null,
    isActive: typeof raw?.isActive === "boolean" ? raw.isActive : raw?.is_active === 1 || raw?.is_active === true || raw?.is_active === "1",
    sortOrder: Number(raw?.sortOrder ?? raw?.sort_order ?? 0),
    offersCount: raw?.offersCount ?? raw?.offers_count,
    createdAt: raw?.createdAt ?? raw?.created_at,
    updatedAt: raw?.updatedAt ?? raw?.updated_at,
  };
}

// ---------- Categories ----------
export const adminCategoriesApi = {
  list: async (params?: { inactive?: boolean; q?: string }) => {
    const r = await request<ApiResponse<{ items: AdminCategory[]; total: number }>>(
      `/admin/categories${qs(params)}`,
    );
    const items = ((r.data as any)?.items || []).map(normalizeCategory);
    return { ...r.data, items };
  },
  create: (body: Partial<AdminCategory>) =>
    request<ApiResponse<{ category: AdminCategory }>>("/admin/categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: number | string, body: Partial<AdminCategory>) =>
    request<ApiResponse<{ category: AdminCategory }>>(`/admin/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (id: number | string) =>
    request<ApiResponse<unknown>>(`/admin/categories/${id}`, { method: "DELETE" }),
  // Backend: PUT /admin/categories/{id}/status with { status: 1|0 }.
  toggle: (id: number | string, isActive?: boolean) =>
    request<ApiResponse<unknown>>(`/admin/categories/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: isActive === false ? 0 : 1 }),
    }),
  // Backend has no /reorder endpoint — emulate by issuing per-item PUTs.
  reorder: async (items: { id: number; sortOrder: number }[]) => {
    await Promise.all(
      items.map((it) =>
        request<ApiResponse<unknown>>(`/admin/categories/${it.id}`, {
          method: "PUT",
          body: JSON.stringify({ sort_order: it.sortOrder }),
        }),
      ),
    );
    return { success: true, data: null } as ApiResponse<unknown>;
  },
};

// ---------- Cities ----------
function normalizeCity(raw: any): AdminCity {
  return {
    id: raw?.id,
    slug: raw?.slug ?? "",
    nameAr: raw?.nameAr ?? raw?.name_ar ?? "",
    nameEn: raw?.nameEn ?? raw?.name_en ?? "",
    isActive: typeof raw?.isActive === "boolean" ? raw.isActive : raw?.is_active === 1 || raw?.is_active === true || raw?.is_active === "1",
    sortOrder: Number(raw?.sortOrder ?? raw?.sort_order ?? 0),
  } as AdminCity;
}
function citiesPayload(body: Partial<AdminCity>) {
  const out: Record<string, any> = {};
  if (body.nameAr !== undefined) { out.name_ar = body.nameAr; out.nameAr = body.nameAr; }
  if (body.nameEn !== undefined) { out.name_en = body.nameEn; out.nameEn = body.nameEn; }
  if (body.isActive !== undefined) { out.is_active = body.isActive ? 1 : 0; out.isActive = !!body.isActive; }
  if (body.sortOrder !== undefined) { out.sort_order = Number(body.sortOrder) || 0; out.sortOrder = Number(body.sortOrder) || 0; }
  return out;
}
export const adminCitiesApi = {
  list: async (params?: { inactive?: boolean; q?: string }) => {
    const r = await request<ApiResponse<{ items: any[]; total?: number }>>(
      `/admin/cities${qs(params)}`,
    );
    const items = (r.data?.items || []).map(normalizeCity);
    return { items, total: r.data?.total ?? items.length };
  },
  create: (body: Partial<AdminCity>) =>
    request<ApiResponse<{ city: AdminCity }>>("/admin/cities", {
      method: "POST",
      body: JSON.stringify(citiesPayload(body)),
    }),
  update: (id: number | string, body: Partial<AdminCity>) =>
    request<ApiResponse<{ city: AdminCity }>>(`/admin/cities/${id}`, {
      method: "PUT",
      body: JSON.stringify(citiesPayload(body)),
    }),
  remove: (id: number | string) =>
    request<ApiResponse<unknown>>(`/admin/cities/${id}`, { method: "DELETE" }),
  toggle: (id: number | string, isActive: boolean) =>
    request<ApiResponse<unknown>>(`/admin/cities/${id}`, {
      method: "PUT",
      body: JSON.stringify(citiesPayload({ isActive } as Partial<AdminCity>)),
    }),
};

// ---------- Offers ----------
export type OfferListParams = {
  page?: number;
  limit?: number;
  status?: OfferStatus | "";
  category?: string | number;
  partnerId?: string;
  q?: string;
};

function splitLines(s: unknown): string[] {
  if (Array.isArray(s)) return s.filter(Boolean).map(String);
  if (typeof s === "string") return s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return [];
}

function normalizeOffer(raw: any): AdminOffer {
  const galleryRaw = raw?.gallery;
  const gallery: string[] = Array.isArray(galleryRaw)
    ? galleryRaw
        .map((g: any) => (typeof g === "string" ? g : g?.url))
        .filter(Boolean)
    : [];
  const num = (v: any) => (v == null || v === "" ? null : Number(v));
  return {
    id: raw?.id,
    partnerId: raw?.partnerId ?? raw?.partner_id ?? "",
    partner: raw?.partner ? {
      ...raw.partner,
      vendorName: raw.partner.vendorName ?? raw.partner.vendor_name ?? raw.partner.vendorNameAr ?? raw.partner.nameAr ?? raw.partner.name ?? "",
      ownerName: raw.partner.ownerName ?? raw.partner.owner_name ?? raw.partner.contactName,
      city: raw.partner.city ?? raw.partner.cityName ?? raw.partner.city_name,
    } : undefined,
    branchId: raw?.branchId ?? raw?.branch_id ?? raw?.branch?.id ?? null,
    branch: raw?.branch ?? null,
    branches: Array.isArray(raw?.branches) ? raw.branches : [],
    branchIds: Array.isArray(raw?.branchIds)
      ? raw.branchIds
      : Array.isArray(raw?.branches)
      ? raw.branches.map((b: any) => b?.id).filter(Boolean)
      : [],
    branchesCount: raw?.branchesCount ?? (Array.isArray(raw?.branches) ? raw.branches.length : 0),
    categoryId: raw?.categoryId ?? raw?.category_id ?? null,
    category: raw?.category ? normalizeCategory(raw.category) : null,
    title: raw?.title ?? raw?.titleAr ?? raw?.title_ar ?? "",
    titleEn: raw?.titleEn ?? raw?.title_en ?? null,
    description: raw?.description ?? raw?.descriptionAr ?? raw?.description_ar ?? null,
    descriptionEn: raw?.descriptionEn ?? raw?.description_en ?? null,
    image: raw?.image ?? gallery[0] ?? null,
    gallery,
    overviewBullets: splitLines(raw?.overviewBullets ?? raw?.overviewAr ?? raw?.overview_ar),
    overviewBulletsEn: splitLines(raw?.overviewBulletsEn ?? raw?.overviewEn ?? raw?.overview_en),
    terms: splitLines(raw?.terms ?? raw?.termsAr ?? raw?.terms_ar),
    termsEn: splitLines(raw?.termsEn ?? raw?.terms_en),
    priceBefore: num(raw?.priceBefore ?? raw?.price_before),
    priceAfter: Number(raw?.priceAfter ?? raw?.price_after ?? 0),
    discountPercent: num(raw?.discountPercent ?? raw?.discount_percent),
    durationMinutes: num(raw?.durationMinutes ?? raw?.duration_minutes),
    status: (raw?.status ?? "draft") as OfferStatus,
    featuredRank: num(raw?.featuredRank ?? raw?.featuredSort ?? raw?.featured_sort),
    commissionPctOverride: num(raw?.commissionPctOverride ?? raw?.commission_pct_override),
    startsAt: raw?.startsAt ?? raw?.validFrom ?? raw?.valid_from ?? null,
    endsAt: raw?.endsAt ?? raw?.validTo ?? raw?.valid_to ?? null,
    createdAt: raw?.createdAt ?? raw?.created_at,
    updatedAt: raw?.updatedAt ?? raw?.updated_at,
    isFeatured: !!(raw?.isFeatured ?? raw?.is_featured),
  } as AdminOffer;
}

function offerPayload(body: Partial<AdminOfferInput> & { isFeatured?: boolean }): Record<string, any> {
  const out: Record<string, any> = {};
  const set = (k: string, v: any) => { out[k] = v; };
  if (body.partnerId !== undefined) { set("partnerId", body.partnerId); set("partner_id", body.partnerId); }
  if (body.branchId !== undefined) { set("branchId", body.branchId); set("branch_id", body.branchId); }
  if (body.branchIds !== undefined) { set("branchIds", body.branchIds || []); set("branch_ids", body.branchIds || []); }
  if (body.categoryId !== undefined) { set("categoryId", body.categoryId); set("category_id", body.categoryId); }
  if (body.title !== undefined) { set("titleAr", body.title); set("title_ar", body.title); set("title", body.title); }
  if (body.titleEn !== undefined) { set("titleEn", body.titleEn); set("title_en", body.titleEn); }
  if (body.description !== undefined) { set("descriptionAr", body.description); set("description_ar", body.description); set("description", body.description); }
  if (body.descriptionEn !== undefined) { set("descriptionEn", body.descriptionEn); set("description_en", body.descriptionEn); }
  if (body.image !== undefined) set("image", body.image);
  if (body.gallery !== undefined) {
    set("gallery", body.gallery);
    set("galleryUrls", body.gallery);
  }
  if (body.overviewBullets !== undefined) {
    const s = (body.overviewBullets || []).join("\n");
    set("overviewAr", s); set("overview_ar", s); set("overviewBullets", body.overviewBullets);
  }
  if (body.overviewBulletsEn !== undefined) {
    const s = (body.overviewBulletsEn || []).join("\n");
    set("overviewEn", s); set("overview_en", s); set("overviewBulletsEn", body.overviewBulletsEn);
  }
  if (body.terms !== undefined) {
    const s = (body.terms || []).join("\n");
    set("termsAr", s); set("terms_ar", s); set("terms", body.terms);
  }
  if (body.termsEn !== undefined) {
    const s = (body.termsEn || []).join("\n");
    set("termsEn", s); set("terms_en", s);
  }
  if (body.priceBefore !== undefined) { set("priceBefore", body.priceBefore); set("price_before", body.priceBefore); }
  if (body.priceAfter !== undefined) { set("priceAfter", body.priceAfter); set("price_after", body.priceAfter); }
  if (body.discountPercent !== undefined) { set("discountPercent", body.discountPercent); set("discount_percent", body.discountPercent); }
  if (body.durationMinutes !== undefined) { set("durationMinutes", body.durationMinutes); set("duration_minutes", body.durationMinutes); }
  if (body.status !== undefined) set("status", body.status);
  if (body.featuredRank !== undefined) {
    set("featuredSort", body.featuredRank); set("featured_sort", body.featuredRank); set("featuredRank", body.featuredRank);
    set("isFeatured", body.featuredRank != null ? 1 : 0); set("is_featured", body.featuredRank != null ? 1 : 0);
  }
  if (body.isFeatured !== undefined) { set("isFeatured", body.isFeatured ? 1 : 0); set("is_featured", body.isFeatured ? 1 : 0); }
  if (body.commissionPctOverride !== undefined) { set("commissionPctOverride", body.commissionPctOverride); set("commission_pct_override", body.commissionPctOverride); }
  if (body.startsAt !== undefined) { set("validFrom", body.startsAt); set("valid_from", body.startsAt); set("startsAt", body.startsAt); }
  if (body.endsAt !== undefined) { set("validTo", body.endsAt); set("valid_to", body.endsAt); set("endsAt", body.endsAt); }
  return out;
}

export const adminOffersApi = {
  list: async (params?: OfferListParams) => {
    const query = params ? {
      ...params,
      categoryId: params.category,
      category_id: params.category,
      partner_id: params.partnerId,
    } : undefined;
    const r = await request<
      ApiResponse<{
        items: any[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>
    >(`/admin/offers${qs(query)}`);
    const items = (r.data?.items || []).map(normalizeOffer);
    return { ...r.data, items };
  },
  get: async (id: string) => {
    const r = await request<ApiResponse<{ offer: any }>>(`/admin/offers/${id}`);
    return normalizeOffer(r.data.offer);
  },
  create: (body: AdminOfferInput) =>
    request<ApiResponse<{ offer: AdminOffer }>>("/admin/offers", {
      method: "POST",
      body: JSON.stringify(offerPayload(body)),
    }),
  update: (id: string, body: AdminOfferInput) =>
    request<ApiResponse<{ offer: AdminOffer }>>(`/admin/offers/${id}`, {
      method: "PUT",
      body: JSON.stringify(offerPayload(body)),
    }),
  remove: (id: string, force = false) =>
    request<ApiResponse<unknown>>(`/admin/offers/${id}${force ? "?force=1" : ""}`, { method: "DELETE" }),
  setStatus: (id: string, status: OfferStatus) =>

    request<ApiResponse<unknown>>(`/admin/offers/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  // Backend has no /feature endpoint on offers — featuring is done via the offer update payload
  // (`is_featured`, `featured_sort`, `featured_starts_at`, `featured_ends_at`).
  feature: (
    id: string,
    body: { sortOrder: number; startsAt?: string | null; endsAt?: string | null },
  ) =>
    request<ApiResponse<unknown>>(`/admin/offers/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        is_featured: 1,
        featured_sort: body.sortOrder,
        featured_starts_at: body.startsAt ?? null,
        featured_ends_at: body.endsAt ?? null,
      }),
    }),
  unfeature: (id: string) =>
    request<ApiResponse<unknown>>(`/admin/offers/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_featured: 0, featured_sort: null }),
    }),
};

// ---------- Featured Offers ----------
// Backend has no dedicated /admin/featured-offers resource. "Featured" is a
// pair of flags on the offer itself (is_featured, featured_sort). We expose
// the same surface area by listing /admin/offers?featured=1 and writing
// via PUT /admin/offers/{id}.
export const adminFeaturedOffersApi = {
  list: async () => {
    const r = await request<ApiResponse<{ items: any[] } | any[]>>(
      "/admin/offers?featured=1&limit=100",
    );
    const d: any = r.data;
    const items: any[] = Array.isArray(d) ? d : d?.items || [];
    return items.map((raw) => {
      const offer = normalizeOffer(raw);
      return {
        id: raw?.id,
        offerId: raw?.id,
        offer,
        sortOrder: Number(raw?.featuredSort ?? raw?.featured_sort ?? 0),
        startsAt: raw?.validFrom ?? raw?.valid_from ?? null,
        endsAt: raw?.validTo ?? raw?.valid_to ?? null,
        isActive: !!(raw?.isFeatured ?? raw?.is_featured),
      } as FeaturedOffer;
    });
  },
  create: (body: {
    offerId: string;
    sortOrder?: number;
    startsAt?: string | null;
    endsAt?: string | null;
    isActive?: boolean;
  }) =>
    request<ApiResponse<unknown>>(`/admin/offers/${body.offerId}`, {
      method: "PUT",
      body: JSON.stringify({
        is_featured: 1,
        featured_sort: body.sortOrder ?? 0,
      }),
    }),
  update: (id: number | string, body: Partial<FeaturedOffer> & { offerId?: string; sortOrder?: number }) => {
    const offerId = (body as any).offerId ?? id;
    const payload: Record<string, any> = {};
    if (body.sortOrder != null) payload.featured_sort = body.sortOrder;
    if ((body as any).isActive != null) payload.is_featured = (body as any).isActive ? 1 : 0;
    return request<ApiResponse<unknown>>(`/admin/offers/${offerId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  remove: (id: number | string) =>
    request<ApiResponse<unknown>>(`/admin/offers/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_featured: 0, featured_sort: 0 }),
    }),
};

// ---------- Sponsored Ads ----------
function normalizeSponsoredAd(raw: any): SponsoredAd {
  const placement: string | null = raw?.placement ?? null;
  let slideIndex: number | null =
    raw?.slideIndex ?? raw?.slide_index ?? null;
  if (slideIndex == null && typeof placement === "string") {
    const m = placement.match(/(\d+)/);
    if (m) slideIndex = Number(m[1]);
  }
  return {
    id: raw?.id,
    title: raw?.title ?? raw?.title_ar ?? raw?.title_en ?? "",
    subtitle: raw?.subtitle ?? raw?.subtitle_ar ?? null,
    image: raw?.image ?? raw?.image_url ?? null,
    ctaLabel: raw?.ctaLabel ?? raw?.cta_label ?? null,
    linkUrl: raw?.linkUrl ?? raw?.link_url ?? null,
    offerId: raw?.offerId ?? raw?.offer_id ?? null,
    partnerId: raw?.partnerId ?? raw?.partner_id ?? null,
    slideIndex,
    sortOrder: Number(raw?.sortOrder ?? raw?.sort_order ?? raw?.priority ?? 0),
    isActive:
      typeof raw?.isActive === "boolean"
        ? raw.isActive
        : raw?.is_active === 1 || raw?.is_active === true || raw?.is_active === "1",
    startsAt: raw?.startsAt ?? raw?.start_at ?? null,
    endsAt: raw?.endsAt ?? raw?.end_at ?? null,
  } as SponsoredAd;
}
function sponsoredAdPayload(body: Partial<SponsoredAd>): Record<string, any> {
  const out: Record<string, any> = {};
  // Title — send to both camelCase and backend snake_case (title_ar/title_en)
  if (body.title !== undefined) {
    out.title = body.title;
    out.title_ar = body.title;
    out.title_en = body.title;
  }
  if (body.subtitle !== undefined) {
    out.subtitle = body.subtitle;
    out.subtitle_ar = body.subtitle;
  }
  if (body.image !== undefined) {
    out.image = body.image;
    out.image_url = body.image;
  }
  if (body.ctaLabel !== undefined) {
    out.ctaLabel = body.ctaLabel;
    out.cta_label = body.ctaLabel;
  }
  if (body.linkUrl !== undefined) {
    out.linkUrl = body.linkUrl;
    out.link_url = body.linkUrl;
  }
  if (body.offerId !== undefined) {
    out.offerId = body.offerId;
    out.offer_id = body.offerId;
  }
  if (body.partnerId !== undefined) {
    out.partnerId = body.partnerId;
    out.partner_id = body.partnerId;
  }
  if (body.slideIndex !== undefined) {
    out.slideIndex = body.slideIndex;
    out.slide_index = body.slideIndex;
    // Backend currently stores this in `placement` column
    out.placement = body.slideIndex ? `slide_${body.slideIndex}` : "home_banner";
  }
  if (body.sortOrder !== undefined) {
    out.sortOrder = body.sortOrder;
    out.sort_order = body.sortOrder;
    out.priority = body.sortOrder;
  }
  if (body.startsAt !== undefined) {
    out.startsAt = body.startsAt;
    out.start_at = body.startsAt;
  }
  if (body.endsAt !== undefined) {
    out.endsAt = body.endsAt;
    out.end_at = body.endsAt;
  }
  if (body.isActive !== undefined) {
    out.isActive = !!body.isActive;
    out.is_active = body.isActive ? 1 : 0;
  }
  return out;
}
export const adminSponsoredAdsApi = {
  list: async () => {
    const r = await request<ApiResponse<{ items: SponsoredAd[] } | SponsoredAd[]>>(
      "/admin/sponsored-ads",
    );
    const d: any = r.data;
    const items: any[] = Array.isArray(d) ? d : d?.items || [];
    return items.map(normalizeSponsoredAd);
  },
  create: (body: Partial<SponsoredAd>) =>
    request<ApiResponse<{ ad: SponsoredAd }>>("/admin/sponsored-ads", {
      method: "POST",
      body: JSON.stringify(sponsoredAdPayload(body)),
    }),
  update: (id: number | string, body: Partial<SponsoredAd>) =>
    request<ApiResponse<unknown>>(`/admin/sponsored-ads/${id}`, {
      method: "PUT",
      body: JSON.stringify(sponsoredAdPayload(body)),
    }),
  remove: (id: number | string) =>
    request<ApiResponse<unknown>>(`/admin/sponsored-ads/${id}`, { method: "DELETE" }),
};

// ---------- Upload ----------
export async function uploadFile(file: File, bucket: UploadBucket = "general"): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("bucket", bucket);
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const doUpload = async (url: string) => {
    const fd2 = new FormData();
    fd2.append("file", file);
    fd2.append("bucket", bucket);
    return fetch(url, { method: "POST", headers, body: fd2 });
  };
  // Prefer partner upload when a partner session is active, otherwise admin.
  let isPartner = false;
  try {
    if (typeof window !== "undefined") {
      isPartner = !!localStorage.getItem("saba_partner");
    }
  } catch { /* ignore */ }
  const order = isPartner
    ? [`${BASE}/partner/upload`, `${BASE}/admin/upload`, `${BASE}/upload`]
    : [`${BASE}/admin/upload`, `${BASE}/partner/upload`, `${BASE}/upload`];
  let res = await doUpload(order[0]);
  for (let i = 1; i < order.length && (res.status === 401 || res.status === 403 || res.status === 404); i++) {
    res = await doUpload(order[i]);
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok || (json && json.success === false)) {
    throw new Error(json?.message || `Upload failed (${res.status})`);
  }
  const data = json?.data ?? json;
  if (!data?.url) throw new Error("Upload response missing url");
  return data as UploadResult;
}
