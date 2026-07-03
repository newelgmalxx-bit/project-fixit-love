import { request, getToken, getSid, BASE } from './client';
import type { ApiResponse } from './types';

export type SponsoredAd = {
  id: string;
  partnerId?: string | null;
  offerId?: string | null;
  title?: string | null;            // legacy
  titleAr?: string | null;
  titleEn?: string | null;
  subtitle?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  ctaLabel?: string | null;
  placement?: string;
  priority?: number;
  slideIndex?: number | null;
  isActive?: boolean;
  startAt?: string | null;
  endAt?: string | null;
  createdAt?: string | null;
};

export type FeaturedOffer = {
  id: string;
  title?: string | null;
  titleAr?: string | null;
  titleEn?: string | null;
  description?: string | null;
  price?: number;
  priceBefore?: number;
  priceAfter?: number;
  originalPrice?: number | null;
  image?: string | null;
  imageUrl?: string | null;
  featuredRank?: number | null;
  [k: string]: any;
};

export type PublicAgreement = {
  id: string;
  partnerId: string;
  version: string | null;
  contentHtml: string | null;
  signedAt: string | null;
  signerName: string | null;
  status: string;
  createdAt: string | null;
  commissionPct?: number;
  depositPct?: number;
  signatureImage?: string | null;
};

function unwrapItems<T>(r: any): T[] {
  const d: any = r?.data ?? r;
  if (Array.isArray(d)) return d as T[];
  return (d?.items || d?.data || []) as T[];
}

function qs(params?: Record<string, any>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? "?" + s : "";
}

export const publicApi = {
  /* ───── Offers ───── */
  getOffers: async (params?: { page?: number; pageSize?: number }) => {
    const r = await request<ApiResponse<any>>(`/offers${qs(params)}`);
    return r.data;
  },
  getOffer: async (id: string) => {
    const r = await request<ApiResponse<{ offer: any }>>(`/offers/${encodeURIComponent(id)}`);
    return r.data?.offer ?? null;
  },

  /* ───── Categories ───── */
  getCategories: () => request<ApiResponse<{ items: any[] }>>(`/categories`),
  getCategory: async (slug: string) => {
    const r = await request<ApiResponse<{ category: any }>>(`/categories/${encodeURIComponent(slug)}`);
    return r.data?.category ?? null;
  },

  /* ───── Partner ───── */
  getPartner: async (id: string) => {
    const r = await request<ApiResponse<{ partner: any }>>(`/partners/${encodeURIComponent(id)}`);
    return r.data?.partner ?? null;
  },

  /* ───── Availability ───── */
  getOfferAvailability: async (offerId: string, date: string) => {
    const r = await request<ApiResponse<any>>(`/offers/${encodeURIComponent(offerId)}/availability?date=${encodeURIComponent(date)}`);
    return r.data ?? null;
  },
  getPartnerAvailability: async (partnerId: string, date: string) => {
    const r = await request<ApiResponse<any>>(`/partners/${encodeURIComponent(partnerId)}/availability?date=${encodeURIComponent(date)}`);
    return r.data ?? null;
  },
  getOfferAvailabilityRange: async (offerId: string, from: string, to: string) => {
    const r = await request<ApiResponse<any>>(`/offers/${encodeURIComponent(offerId)}/availability/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const d: any = r.data ?? [];
    // Support new shape `{items:[{date,dayOff,fullyBooked}]}`, old shape
    // `{days:[{date,dayOff,availableSlots}]}`, or a bare array.
    const raw: any[] = Array.isArray(d) ? d : (d.items ?? d.days ?? []);
    return raw.map((it: any) => {
      const slots = it.availableSlots ?? it.slots;
      let fullyBooked = Boolean(it.fullyBooked);
      if (!fullyBooked && Array.isArray(slots)) {
        // availableSlots = array of remaining free times. Empty array => fully booked.
        const free = slots.some((s: any) =>
          typeof s === "string" ? true : s?.available !== false,
        );
        fullyBooked = slots.length === 0 ? false : !free;
      }
      return {
        date: String(it.date ?? ""),
        dayOff: Boolean(it.dayOff),
        fullyBooked,
      };
    });
  },



  /* ───── Misc public ───── */
  /**
   * Look up a booking by its QR code (booking number, e.g. BK-DXECMR) and
   * the short verify code printed on the ticket.
   *
   * Backend (GET /lookup-booking) is expected to validate using
   *   bookings.qr_code      = qr_code
   *   bookings.verify_code  = verify_code
   * and to return a unified 404 on any mismatch (no enumeration).
   */
  lookupOrder: (params: { qrCode: string; verifyCode: string }) => {
    const sp = new URLSearchParams();
    sp.set('qr_code', params.qrCode);
    sp.set('verify_code', params.verifyCode);
    sp.set('qrCode', params.qrCode);
    sp.set('orderNumber', params.qrCode);
    sp.set('verifyCode', params.verifyCode);
    return request<ApiResponse<{ order: any; items?: any[]; timeline?: any[]; partner?: any }>>(
      `/lookup-booking?${sp.toString()}`
    );
  },
  submitQuote: (body: Record<string, any>) =>
    request<ApiResponse<any>>(`/quote`, { method: "POST", body: JSON.stringify(body) }),

  getSiteSettings: () => request<ApiResponse<{
    logo: string | null; nameAr: string; nameEn: string;
    taglineAr: string; taglineEn: string;
    social: Record<string, string>; maintenanceMode: boolean;
    currency?: string; vatRate?: number;
  }>>('/settings'),
  sendContact: (body: { name: string; email: string; phone?: string; service?: string; budget?: string; message: string }) =>
    request<ApiResponse<{ ok: boolean }>>('/contact', { method: 'POST', body: JSON.stringify(body) }),

  // Public reviews list. Backend route: GET /reviews?serviceSlug=...
  getReviews: (serviceSlug?: string) => {
    const qs = serviceSlug ? `?serviceSlug=${encodeURIComponent(serviceSlug)}` : '';
    return request<ApiResponse<{ items: any[]; average: number; total: number }>>(`/reviews${qs}`);
  },

  // Public bookings endpoint.
  createBooking: (body: { name: string; email: string; phone?: string; date?: string; time?: string; notes?: string; serviceId?: string }) =>
    request<ApiResponse<any>>('/bookings', { method: 'POST', body: JSON.stringify(body) }),

  /* ───── Abandoned carts (guest-friendly) ───── */
  // Upsert a partial cart attempt so the admin can later send a reminder.
  // Backed by external endpoint; session-scoped via X-Session-Id when the
  // visitor is not logged in (so we don't require auth).
  saveAbandonedCart: (body: {
    cartId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    items: Array<{
      offerId: string;
      offerTitle?: string;
      vendorName?: string;
      vendorCity?: string;
      bookingDate?: string;
      bookingTime?: string;
      qty?: number;
      price?: number;
      lineTotal?: number;
      depositAmount?: number;
      remainingAmount?: number;
      depositPct?: number;
    }>;
    subtotal?: number;
  }) => {
    const headers: Record<string, string> = {};
    if (!getToken()) headers['X-Session-Id'] = getSid();
    return request<ApiResponse<any>>('/abandoned-carts', {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  },

  clearAbandonedCart: (cartId: string) => {
    const headers: Record<string, string> = {};
    if (!getToken()) headers['X-Session-Id'] = getSid();
    return request<ApiResponse<any>>(`/abandoned-carts/${encodeURIComponent(cartId)}`, {
      method: 'DELETE',
      headers,
    });
  },

  // Tracking codes for the storefront.
  getTracking: () => request<ApiResponse<{ pixels?: string; head?: string; body?: string }>>('/tracking'),

  // Sponsored ads (optionally by placement).
  getSponsoredAds: async (params?: { placement?: string }): Promise<SponsoredAd[]> => {
    const q = params?.placement ? `?placement=${encodeURIComponent(params.placement)}` : '';
    const r = await request<ApiResponse<any>>(`/sponsored-ads${q}`);
    return unwrapItems<SponsoredAd>(r);
  },

  // Featured offers — backend has no /offers/featured route; use /offers?featured=1
  getFeaturedOffers: async (params?: { limit?: number; page?: number; category?: string }): Promise<FeaturedOffer[]> => {
    const sp = new URLSearchParams();
    sp.set('featured', '1');
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.page) sp.set('page', String(params.page));
    if (params?.category) sp.set('category', params.category);
    const r = await request<ApiResponse<any>>(`/offers?${sp.toString()}`);
    return unwrapItems<FeaturedOffer>(r);
  },

  // Home daily featured offers — prefer the admin filtered endpoint when the
  // current session is authenticated, then gracefully fall back to the public endpoint.
  getDailyFeaturedOffers: async (params?: { limit?: number }): Promise<FeaturedOffer[]> => {
    try {
      const limit = params?.limit ?? 100;
      const r = await request<ApiResponse<any>>(`/admin/offers?featured=1&limit=${limit}`);
      return unwrapItems<FeaturedOffer>(r);
    } catch {
      return publicApi.getFeaturedOffers({ limit: params?.limit ?? 100 });
    }
  },

  // Public agreement view (read-only signed/sent agreements).
  getAgreement: async (id: string): Promise<PublicAgreement | null> => {
    try {
      const r = await request<ApiResponse<{ agreement: any }>>(`/agreements/${encodeURIComponent(id)}`);
      const a: any = r.data?.agreement;
      if (!a) return null;
      return {
        id: a.id,
        partnerId: a.partnerId ?? a.partner_id ?? '',
        version: a.version ?? a.template_version ?? null,
        contentHtml: a.contentHtml ?? a.content_html ?? null,
        signedAt: a.signedAt ?? a.signed_at ?? null,
        signerName: a.signerName ?? a.signed_name ?? a.signer_name ?? null,
        status: a.status ?? '',
        createdAt: a.createdAt ?? a.created_at ?? null,
        commissionPct: Number(a.commissionPct ?? a.commission_pct ?? 0),
        depositPct: Number(a.depositPct ?? a.deposit_pct ?? 0),
        signatureImage: a.signatureImage ?? a.signature_image ?? null,
      };
    } catch {
      return null;
    }
  },

  // Single batch endpoint for the home page: returns sponsored ads,
  // featured offers (with partner fields merged), reviews keyed by offerId,
  // partners keyed by id, categories, and a subset of site settings — in
  // one request instead of 20+.
  getHomeData: async (limit: number = 20): Promise<{
    sponsoredAds: any[];
    featuredOffers: any[];
    homeSlider1: any[];
    homeSlider2: any[];
    reviews: Record<string, any[]>;
    partners: Record<string, any>;
    categories: any[];
    settings: Record<string, any>;
  }> => {
    const r = await request<ApiResponse<any>>(`/home-data?limit=${limit}`);
    const d: any = r?.data ?? r ?? {};
    return {
      sponsoredAds:   Array.isArray(d.sponsoredAds)   ? d.sponsoredAds   : [],
      featuredOffers: Array.isArray(d.featuredOffers) ? d.featuredOffers : [],
      homeSlider1:    Array.isArray(d.homeSlider1)    ? d.homeSlider1    : [],
      homeSlider2:    Array.isArray(d.homeSlider2)    ? d.homeSlider2    : [],
      reviews:        (d.reviews && typeof d.reviews === 'object')   ? d.reviews   : {},
      partners:       (d.partners && typeof d.partners === 'object') ? d.partners  : {},
      categories:     Array.isArray(d.categories)     ? d.categories     : [],
      settings:       (d.settings && typeof d.settings === 'object') ? d.settings : {},
    };
  },

  // Generic upload (auth required by backend).
  upload: async (file: File, bucket: string = 'general') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('bucket', bucket);
    return fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      body: fd,
    }).then((r) => r.json());
  },
};
