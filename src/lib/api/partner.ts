// Partner API — wired to https://koswmat.com/api
// Partner JWT is a regular Bearer token issued by /auth/partner/login.
// We store it in the same `saba_token` slot used by client.ts so the shared
// request() helper attaches Authorization automatically.
import { request, setToken, removeToken } from "./client";
import type { ApiResponse } from "./types";

export type PartnerUser = { id: string; name: string; email: string; role: "partner" };

export type PartnerProfile = {
  id: string;
  userId?: string;
  name?: string;            // vendor name
  vendorName?: string;
  ownerName?: string;
  email?: string | null;
  phone?: string | null;
  category?: string | null;
  city?: string | null;
  cityId?: string | null;
  commercialNumber?: string | null;
  about?: string | null;
  workingHours?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
  logo?: string | null;
  logoUrl?: string | null;
  status: string;
  commissionPct?: number | null;
  depositPct?: number | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
};

export type PartnerAgreement = {
  id: string;
  partnerId: string;
  templateId?: string | null;
  templateVersion?: string | null;
  commissionPct: number;
  depositPct: number;
  status: string;
  signedName?: string | null;
  signedAt?: string | null;
  signatureImage?: string | null;
  adminNotes?: string | null;
  pdfPath?: string | null;
  customTitle?: string | null;
  customBody?: string | null;
  createdAt?: string;
  source?: string | null;
  [k: string]: any;
};

export type AgreementTemplate = { id: string; title: string; body: string; version: string | number };

export type PartnerOffer = {
  id: string;
  partnerId?: string;
  title?: string;
  titleAr?: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  price?: number;
  priceBefore?: number;
  priceAfter?: number;
  originalPrice?: number | null;
  image?: string | null;
  imageUrl?: string | null;
  images?: string[];
  imageUrls?: string[];
  category?: string | null;
  status: string;
  durationMinutes?: number | null;
  discountPercent?: number | null;
  terms?: string[];
  termsEn?: string[];
  overviewBullets?: string[];
  overviewBulletsEn?: string[];
  featuredRank?: number | null;
  [k: string]: any;
};

export type PartnerBooking = {
  id: string;
  partnerId?: string;
  offerId?: string | null;
  offerTitle?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  bookingDate?: string | null;
  bookingTime?: string | null;
  amount?: number | null;
  status: string;
  notes?: string | null;
  createdAt?: string;
  qty?: number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  [k: string]: any;
};

export type CommissionRequest = {
  id: string;
  partnerId: string;
  currentCommissionPct?: number | null;
  currentDepositPct?: number | null;
  requestedCommissionPct: number;
  requestedDepositPct: number;
  reason: string | null;
  status: string;
  adminNotes?: string | null;
  createdAt: string;
  [k: string]: any;
};

const PARTNER_KEY = "saba_partner";
export function getStoredPartner(): PartnerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const d = localStorage.getItem(PARTNER_KEY);
    return d ? JSON.parse(d) : null;
  } catch {
    return null;
  }
}
export function setStoredPartner(p: PartnerProfile | null) {
  if (typeof window === "undefined") return;
  if (p) localStorage.setItem(PARTNER_KEY, JSON.stringify(p));
  else localStorage.removeItem(PARTNER_KEY);
  try { window.dispatchEvent(new Event("saba:partner")); } catch {}
}

function unwrap<T = any>(p: Promise<any>): Promise<T> {
  return p.then((r) => (r?.data ?? r) as T);
}

// =========================================
// Partner Auth
// =========================================
export const partnerAuth = {
  register: async (body: {
    vendorName: string;
    ownerName: string;
    email: string;
    phone: string;
    password: string;
    category?: string;
    city?: string;
    commercialNumber?: string;
    notes?: string;
    packageId?: string;
  }) => {
    const r = await request<ApiResponse<{ token: string; user: PartnerUser; partner: PartnerProfile }>>(
      "/auth/partner/register",
      {
        method: "POST",
        body: JSON.stringify({
          vendor_name: body.vendorName,
          owner_name: body.ownerName,
          email: body.email,
          phone: body.phone,
          password: body.password,
          category: body.category,
          city: body.city,
          commercial_number: body.commercialNumber,
          notes: body.notes,
          package_id: body.packageId,
          packageId: body.packageId,
        }),
      },
    );
    const d = r.data;
    if (d?.token) setToken(d.token);
    if (d?.partner) setStoredPartner(d.partner);
    return d;
  },

  login: async (body: { emailOrPhone: string; password: string }) => {
    const r = await request<ApiResponse<any>>(
      "/auth/partner/login",
      { method: "POST", body: JSON.stringify({ emailOrPhone: body.emailOrPhone, password: body.password }) },
    );
    const d = r.data;
    if (d?.requiresOtp) return d;
    if (d?.token) setToken(d.token);
    if (d?.partner) setStoredPartner(d.partner);
    return d;
  },

  verifyLoginOtp: async (body: { email: string; otp: string }) => {
    const r = await request<ApiResponse<{ token: string; user: PartnerUser; partner: PartnerProfile }>>(
      "/auth/partner/login/verify-otp",
      { method: "POST", body: JSON.stringify({ email: body.email, otp: body.otp }) },
    );
    const d = r.data;
    if (d?.token) setToken(d.token);
    if (d?.partner) setStoredPartner(d.partner);
    return d;
  },

  resendLoginOtp: async (body: { email: string }) =>
    request<ApiResponse<any>>("/auth/partner/login/resend-otp", {
      method: "POST",
      body: JSON.stringify({ email: body.email }),
    }),

  logout: async () => {
    try { await request("/auth/partner/logout", { method: "POST" }); } catch {}
    removeToken();
    setStoredPartner(null);
  },

  me: async () => {
    const r = await request<ApiResponse<{ user: PartnerUser; partner: PartnerProfile }>>("/auth/partner/me");
    const d = r.data;
    if (d?.partner) setStoredPartner(d.partner);
    return d;
  },
};

// =========================================
// Partner API (requires partner JWT in Bearer)
// =========================================
// =========================================
// Helpers — normalize backend ↔ frontend shapes
// =========================================
function toLines(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return [];
}
function joinLines(v: any): string | null {
  const arr = toLines(v);
  return arr.length ? arr.join("\n") : null;
}

// Backend offer (camelCased by offerTransformer) → frontend Offer shape
function normalizeOffer(o: any): any {
  if (!o) return o;
  const gallery: any[] = Array.isArray(o.gallery) ? o.gallery : [];
  const urls = gallery.map((g) => g?.url).filter(Boolean);
  const image = o.image || urls[0] || null;
  return {
    id: o.id,
    partner_id: o.partnerId ?? o.partner_id ?? null,
    title: o.titleAr ?? o.title_ar ?? o.title ?? "",
    title_en: o.titleEn ?? o.title_en ?? null,
    description: o.descriptionAr ?? o.description_ar ?? o.description ?? null,
    description_en: o.descriptionEn ?? o.description_en ?? null,
    price: Number(o.priceAfter ?? o.price_after ?? o.price ?? 0),
    original_price:
      o.priceBefore != null ? Number(o.priceBefore) :
      o.price_before != null ? Number(o.price_before) : null,
    image_url: image,
    image_urls: urls.length ? urls : (image ? [image] : []),
    category: o.categoryId ?? o.category_id ?? o.category ?? null,
    status: o.status ?? "draft",
    duration_minutes: o.durationMinutes ?? o.duration_minutes ?? null,
    discount_percent: o.discountPercent ?? o.discount_percent ?? null,
    terms: toLines(o.termsAr ?? o.terms_ar ?? o.terms),
    terms_en: toLines(o.termsEn ?? o.terms_en),
    overview_bullets: toLines(o.overviewAr ?? o.overview_ar ?? o.overviewBullets),
    overview_bullets_en: toLines(o.overviewEn ?? o.overview_en ?? o.overviewBulletsEn),
    is_featured: !!(o.isFeatured ?? o.is_featured),
    featured_sort: o.featuredSort ?? o.featured_sort ?? null,
    commission_pct_override: o.commissionPctOverride ?? o.commission_pct_override ?? null,
    valid_from: o.validFrom ?? o.valid_from ?? null,
    valid_to: o.validTo ?? o.valid_to ?? null,
  };
}

// Frontend Offer payload → backend payload (camelCase keys per normalizePartnerOfferPayload)
function denormalizeOfferPayload(b: any): any {
  const imgs: string[] = Array.isArray(b.image_urls) ? b.image_urls.filter(Boolean) : [];
  const out: any = {};
  if (b.title != null) out.titleAr = b.title;
  if (b.title_en !== undefined) out.titleEn = b.title_en || null;
  if (b.description !== undefined) out.descriptionAr = b.description || null;
  if (b.description_en !== undefined) out.descriptionEn = b.description_en || null;
  if (b.overview_bullets !== undefined) out.overviewAr = joinLines(b.overview_bullets);
  if (b.overview_bullets_en !== undefined) out.overviewEn = joinLines(b.overview_bullets_en);
  if (b.terms !== undefined) out.termsAr = joinLines(b.terms);
  if (b.terms_en !== undefined) out.termsEn = joinLines(b.terms_en);
  if (b.price != null) out.priceAfter = Number(b.price);
  if (b.original_price !== undefined) {
    out.priceBefore = b.original_price != null ? Number(b.original_price) : Number(b.price ?? 0);
  } else if (b.price != null) {
    out.priceBefore = Number(b.price);
  }
  if (b.image_url !== undefined || imgs.length) out.image = imgs[0] || b.image_url || null;
  if (b.category !== undefined) out.categoryId = b.category || null;
  if (b.status !== undefined) out.status = b.status;
  if (b.duration_minutes !== undefined) out.durationMinutes = b.duration_minutes;
  if (b.is_featured !== undefined) out.isFeatured = b.is_featured ? 1 : 0;
  if (b.featured_sort !== undefined) out.featuredSort = b.featured_sort;
  if (b.commission_pct_override !== undefined) out.commissionPctOverride = b.commission_pct_override;
  if (b.valid_from !== undefined) out.validFrom = b.valid_from;
  if (b.valid_to !== undefined) out.validTo = b.valid_to;
  if (imgs.length || b.image_url !== undefined) {
    out.gallery = imgs.length
      ? imgs.map((url, i) => ({ url, sortOrder: i }))
      : (b.image_url ? [{ url: b.image_url, sortOrder: 0 }] : []);
  }
  return out;
}

// Backend booking → frontend Booking shape
function normalizeBooking(b: any): any {
  if (!b) return b;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rawTitle = b.offerTitleAr ?? b.offerTitle ?? b.offer?.title ?? b.offer?.titleAr ?? b.offer_title ?? null;
  const offer_title = rawTitle && !uuidRe.test(String(rawTitle).trim()) ? rawTitle : null;
  const booking_number = b.qrCode ?? b.qr_code ?? b.bookingNumber ?? b.booking_number ?? b.reference ?? b.referenceCode ?? b.reference_code ?? null;
  const verify_code = b.verifyCode ?? b.verify_code ?? b.confirmCode ?? b.confirm_code ?? b.pin ?? b.otp ?? null;
  return {
    id: b.id,
    partner_id: b.partnerId ?? null,
    offer_id: b.offerId ?? null,
    service_id: b.serviceId ?? b.service_id ?? null,
    order_id: b.orderId ?? b.order_id ?? null,
    user_id: b.userId ?? b.user_id ?? null,
    invoice_id: b.invoiceId ?? b.invoice_id ?? null,
    offer_title,
    offer_title_en: b.offerTitleEn ?? b.offer_title_en ?? null,
    offer_image: b.offerImage ?? b.offer_image ?? b.offer?.image ?? null,
    booking_number,
    qr_code: booking_number,
    scheduled_at: b.scheduledAt ?? b.scheduled_at ?? null,
    customer_name: b.customerName ?? "",
    customer_phone: b.customerPhone ?? "",
    customer_email: b.customerEmail ?? null,
    booking_date: b.date ?? null,
    booking_time: b.time ?? null,
    amount: b.totalAmount != null ? Number(b.totalAmount) : null,
    deposit_amount: b.depositAmount != null ? Number(b.depositAmount) : null,
    deposit_pct: b.depositPct != null ? Number(b.depositPct) : null,
    commission: b.commissionAmount != null ? Number(b.commissionAmount) : null,
    commission_pct: b.commissionPct != null ? Number(b.commissionPct) : null,
    partner_amount: b.partnerAmount != null ? Number(b.partnerAmount) : null,
    status: b.status ?? "pending",
    notes: b.notes ?? null,
    verify_code,
    qty: b.qty ?? 1,
    payment_method: b.paymentMethod ?? null,
    payment_status: b.paymentStatus ?? null,
    paid_at: b.paidAt ?? b.paid_at ?? null,
    source: b.source ?? null,
    confirmed_at: b.confirmedAt ?? b.confirmed_at ?? null,
    redeemed_at: b.redeemedAt ?? b.redeemed_at ?? null,
    created_at: b.createdAt ?? null,
    updated_at: b.updatedAt ?? null,
  };
}

function normalizeCommissionRequest(r: any): any {
  if (!r) return r;
  const requestedCom = r.requestedPct ?? r.requested_pct ?? r.requestedCommissionPct ?? null;
  const currentCom = r.currentPct ?? r.current_pct ?? r.currentCommissionPct ?? null;
  const requestedDep = r.requestedDepositPct ?? r.requested_deposit_pct ?? null;
  const currentDep = r.currentDepositPct ?? r.current_deposit_pct ?? null;
  const reqCom = requestedCom != null ? Number(requestedCom) : 0;
  const curCom = currentCom != null ? Number(currentCom) : null;
  const reqDep = requestedDep != null ? Number(requestedDep) : 0;
  const curDep = currentDep != null ? Number(currentDep) : null;
  const adminNote = r.adminNote ?? r.admin_note ?? r.adminNotes ?? null;
  const createdAt = r.createdAt ?? r.created_at ?? null;
  return {
    id: r.id,
    partnerId: r.partnerId ?? r.partner_id,
    requestedCommissionPct: reqCom,
    requestedDepositPct: reqDep,
    currentCommissionPct: curCom,
    currentDepositPct: curDep,
    requested_commission_pct: reqCom,
    requested_deposit_pct: reqDep,
    current_commission_pct: curCom,
    current_deposit_pct: curDep,
    reason: r.reason ?? null,
    status: r.status ?? "pending",
    adminNotes: adminNote,
    admin_notes: adminNote,
    createdAt,
    created_at: createdAt,
    decidedAt: r.decidedAt ?? r.decided_at ?? null,
  };
}

// =========================================
// Partner API (requires partner JWT in Bearer)
// =========================================
export const partnerApi = {
  // Profile
  getProfile: () =>
    unwrap<{ partner: PartnerProfile; agreement?: PartnerAgreement | null }>(
      request(`/partner/profile`),
    ),

  // Upload (shortcut — uploadFile from adminContent.ts already targets this URL)
  uploadFile: async (file: File, bucket?: "offer-images" | "partner-logos" | "partner-covers" | "partner-general") => {
    const fd = new FormData();
    fd.append("file", file);
    if (bucket) fd.append("bucket", bucket);
    return unwrap<{ url: string }>(
      request(`/partner/upload`, { method: "POST", body: fd as any }),
    );
  },

  updateProfile: (body: Partial<PartnerProfile>) => {
    const b: any = body;
    const payload: any = {};
    if (b.vendorName !== undefined || b.name !== undefined) payload.name = b.vendorName ?? b.name;
    if (b.ownerName !== undefined) payload.ownerName = b.ownerName;
    if (b.email !== undefined) payload.email = b.email;
    if (b.phone !== undefined) payload.phone = b.phone;
    if (b.commercialNumber !== undefined) payload.commercialNumber = b.commercialNumber;
    if (b.cityId !== undefined) payload.cityId = b.cityId;
    if (b.city !== undefined) payload.city = b.city;
    if (b.category !== undefined) payload.category = b.category;
    if (b.address !== undefined) payload.address = b.address;
    if (b.mapsUrl !== undefined) payload.mapsUrl = b.mapsUrl;
    if (b.logoUrl !== undefined || b.logo !== undefined) {
      const v = b.logoUrl ?? b.logo;
      payload.logo = v;
      payload.logoUrl = v;
    }
    if (b.coverUrl !== undefined) payload.coverUrl = b.coverUrl;
    if (b.about !== undefined) payload.about = b.about;
    if (b.workingHours !== undefined) payload.workingHours = b.workingHours;
    // Mirror admin AddCenterDialog fields
    if (b.nameEn !== undefined || b.vendorNameEn !== undefined) {
      payload.nameEn = b.nameEn ?? b.vendorNameEn;
      payload.vendorNameEn = b.nameEn ?? b.vendorNameEn;
    }
    if (b.description !== undefined) payload.description = b.description;
    if (b.descriptionEn !== undefined) payload.descriptionEn = b.descriptionEn;
    if (b.terms !== undefined) payload.terms = b.terms;
    if (b.termsEn !== undefined) payload.termsEn = b.termsEn;
    if (b.aboutEn !== undefined) payload.aboutEn = b.aboutEn;
    if (b.highlights !== undefined) payload.highlights = b.highlights;
    if (b.categoryIds !== undefined) {
      payload.categoryIds = b.categoryIds;
      payload.category_ids = b.categoryIds;
    }
    return unwrap<{ partner: PartnerProfile }>(
      request(`/partner/profile`, { method: "PUT", body: JSON.stringify(payload) }),
    );
  },

  // Change password — dedicated endpoint that verifies the current password
  // against partners.password_hash and users.password, then updates both.
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    unwrap<any>(
      request(`/partner/change-password`, {
        method: "POST",
        body: JSON.stringify({
          currentPassword: body.currentPassword,
          current_password: body.currentPassword,
          newPassword: body.newPassword,
          new_password: body.newPassword,
          password: body.newPassword,
        }),
      }),
    ),

  // Stats — backend supports ?range=7d|30d|90d (returns daily breakdown)
  stats: (range?: "7d" | "30d" | "90d") =>
    unwrap<any>(request(`/partner/stats${range ? `?range=${range}` : ""}`)),

  // Payouts
  listPayouts: async (params?: { page?: number; pageSize?: number; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
    if (params?.status && params.status !== "all") sp.set("status", params.status);
    const qs = sp.toString();
    return unwrap<{ items: any[]; total?: number; page?: number; pageSize?: number }>(
      request(`/partner/payouts${qs ? "?" + qs : ""}`),
    );
  },
  payoutsSummary: () => unwrap<any>(request(`/partner/payouts/summary`)),

  // Reviews
  listReviews: async (params?: { page?: number; pageSize?: number; status?: "pending" | "published" | "rejected"; offerId?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
    if (params?.status) sp.set("status", params.status);
    if (params?.offerId) sp.set("offerId", params.offerId);
    if (params?.search) sp.set("search", params.search);
    const qs = sp.toString();
    return unwrap<{
      items: any[];
      total?: number;
      page?: number;
      pageSize?: number;
      totalPages?: number;
      counts?: { pending: number; published: number; rejected: number };
      avgRating?: number;
      breakdown?: Record<string, number>;
    }>(
      request(`/partner/reviews${qs ? "?" + qs : ""}`),
    );
  },
  getReview: (id: string) =>
    unwrap<{ review: any }>(request(`/partner/reviews/${id}`)),
  approveReview: (id: string) =>
    unwrap<any>(request(`/partner/reviews/${id}/approve`, { method: "PUT" })),
  rejectReview: (id: string) =>
    unwrap<any>(request(`/partner/reviews/${id}/reject`, { method: "PUT" })),
  deleteReview: (id: string) =>
    request<ApiResponse<any>>(`/partner/reviews/${id}`, { method: "DELETE" }),
  replyReview: (id: string, reply: string) =>
    unwrap<{ review: any }>(
      request(`/partner/reviews/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ reply }),
      }),
    ),

  // Commission requests
  listCommissionRequests: async () => {
    const r: any = await unwrap<{ items: any[] }>(request(`/partner/commission-requests`));
    return { items: (r?.items || []).map(normalizeCommissionRequest) as CommissionRequest[] };
  },

  createCommissionRequest: async (body: {
    requestedCommissionPct: number;
    requestedDepositPct?: number;
    reason?: string;
  }) => {
    const payload: any = {
      requestedPct: body.requestedCommissionPct,
      requestedCommissionPct: body.requestedCommissionPct,
      reason: body.reason ?? null,
    };
    if (body.requestedDepositPct != null) payload.requestedDepositPct = body.requestedDepositPct;
    const r: any = await unwrap<{ request: any; item?: any }>(
      request(`/partner/commission-requests`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
    const raw = r?.request || r?.item || r;
    return { item: normalizeCommissionRequest(raw) as CommissionRequest };
  },

  // Agreement
  getAgreement: () =>
    unwrap<{ agreement: PartnerAgreement | null; template?: AgreementTemplate | null }>(
      request(`/partner/agreement`),
    ),

  getAgreementById: (id: string) =>
    unwrap<{ agreement: PartnerAgreement; template: AgreementTemplate | null }>(
      request(`/partner/agreements/${id}`),
    ),

  signAgreement: (id: string, body: { signedName: string; signatureImage: string }) =>
    unwrap<{ agreement: PartnerAgreement; partner?: PartnerProfile }>(
      request(`/partner/agreements/${id}/sign`, {
        method: "POST",
        body: JSON.stringify({
          signedName: body.signedName,
          signatureImage: body.signatureImage,
          signed_name: body.signedName,
          signature_image: body.signatureImage,
        }),
      }),
    ),

  getAgreementQr: async (): Promise<{ agreementId: string; signedAt: string | null; qrUrl: string; qrPngBase64: string | null }> => {
    const d = await unwrap<any>(request(`/partner/agreement/qr`));
    return {
      agreementId: d?.agreementId ?? d?.agreement_id ?? "",
      signedAt: d?.signedAt ?? d?.signed_at ?? null,
      qrUrl: d?.qrUrl ?? d?.qr_url ?? "",
      qrPngBase64: d?.qrPngBase64 ?? d?.qr_png_base64 ?? null,
    };
  },

  // Offers
  listOffers: async (params?: { status?: string; q?: string; categoryId?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.status && params.status !== "all") sp.set("status", params.status);
    if (params?.q) sp.set("search", params.q);
    if (params?.categoryId) sp.set("categoryId", params.categoryId);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("pageSize", String(params.limit));
    const qs = sp.toString();
    const r: any = await unwrap<{ items: any[]; total?: number; page?: number; pageSize?: number; totalPages?: number }>(
      request(`/partner/offers${qs ? "?" + qs : ""}`),
    );
    return {
      items: ((r?.items || []) as any[]).map(normalizeOffer) as PartnerOffer[],
      total: r?.total,
      page: r?.page,
      pages: r?.totalPages,
    };
  },
  getOffer: async (id: string) => {
    const r: any = await unwrap<{ offer: any }>(request(`/partner/offers/${id}`));
    return { offer: normalizeOffer(r?.offer) as PartnerOffer };
  },
  createOffer: async (body: Partial<PartnerOffer>) => {
    const r: any = await unwrap<{ offer: any }>(
      request(`/partner/offers`, { method: "POST", body: JSON.stringify(denormalizeOfferPayload(body)) }),
    );
    return { offer: normalizeOffer(r?.offer) as PartnerOffer };
  },
  updateOffer: async (id: string, body: Partial<PartnerOffer>) => {
    const r: any = await unwrap<{ offer: any }>(
      request(`/partner/offers/${id}`, { method: "PUT", body: JSON.stringify(denormalizeOfferPayload(body)) }),
    );
    return { offer: normalizeOffer(r?.offer) as PartnerOffer };
  },
  deleteOffer: (id: string) =>
    request<ApiResponse<any>>(`/partner/offers/${id}`, { method: "DELETE" }),

  // Bookings
  listBookings: async (params?: { status?: string; page?: number; limit?: number; offerId?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status && params.status !== "all") sp.set("status", params.status);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("pageSize", String(params.limit));
    if (params?.offerId) sp.set("offerId", params.offerId);
    if (params?.search) sp.set("search", params.search);
    const qs = sp.toString();
    const r: any = await unwrap<{ items: any[]; total?: number }>(
      request(`/partner/bookings${qs ? "?" + qs : ""}`),
    );
    return {
      items: ((r?.items || []) as any[]).map(normalizeBooking) as PartnerBooking[],
      total: r?.total,
    };
  },
  getBooking: async (id: string) => {
    const r: any = await unwrap<{ booking: any }>(request(`/partner/bookings/${id}`));
    return { booking: normalizeBooking(r?.booking) as PartnerBooking };
  },
  updateBooking: async (id: string, body: Partial<PartnerBooking> & { status?: string }) => {
    const b: any = body;
    const payload: any = {};
    if (b.status !== undefined) payload.status = b.status;
    if (b.notes !== undefined) payload.notes = b.notes;
    if (b.booking_date !== undefined) payload.date = b.booking_date;
    if (b.booking_time !== undefined) payload.time = b.booking_time;
    if (b.verify_code !== undefined) payload.verify_code = b.verify_code;
    const r: any = await unwrap<{ booking: any }>(
      request(`/partner/bookings/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    );
    return { booking: normalizeBooking(r?.booking) as PartnerBooking };
  },
  redeemBooking: async (id: string, code: string) => {
    const r: any = await unwrap<{ booking: any }>(
      request(`/partner/bookings/${id}/redeem`, {
        method: "POST",
        body: JSON.stringify({ verify_code: code, code }),
      }),
    );
    return { booking: normalizeBooking(r?.booking) as PartnerBooking };
  },

  // =========================================
  // Messages
  // =========================================
  listMessageThreads: () =>
    unwrap<{ items: any[]; total?: number }>(request(`/partner/messages`)),
  getMessageThread: (threadId: string) =>
    unwrap<{ thread: any; messages: any[]; total?: number }>(
      request(`/partner/messages/${threadId}`),
    ),
  sendMessage: (threadId: string, text: string) =>
    unwrap<{ message: any }>(
      request(`/partner/messages/${threadId}`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    ),
  markThreadRead: (threadId: string) =>
    unwrap<any>(request(`/partner/messages/${threadId}/read`, { method: "POST" })),

  // =========================================
  // Notifications
  // =========================================
  listNotifications: (params?: { pageSize?: number }) => {
    const sp = new URLSearchParams();
    if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
    const qs = sp.toString();
    return unwrap<{ items: any[]; total?: number; unreadCount?: number }>(
      request(`/partner/notifications${qs ? "?" + qs : ""}`),
    );
  },
  markNotificationRead: (id: string) =>
    unwrap<any>(request(`/partner/notifications/${id}/read`, { method: "POST" })),
  markAllNotificationsRead: () =>
    unwrap<any>(request(`/partner/notifications/read-all`, { method: "POST" })),

  // =========================================
  // Support Tickets
  // =========================================
  listSupportTickets: () =>
    unwrap<{ items: any[]; total?: number }>(request(`/partner/support/tickets`)),
  createSupportTicket: (body: { subject: string; body: string }) =>
    unwrap<{ ticket: any }>(
      request(`/partner/support/tickets`, {
        method: "POST",
        body: JSON.stringify({ subject: body.subject, body: body.body }),
      }),
    ),
  getSupportTicket: (id: string) =>
    unwrap<{ ticket: any; messages: any[] }>(
      request(`/partner/support/tickets/${id}`),
    ),
  replySupportTicket: (id: string, text: string) =>
    unwrap<{ message: any }>(
      request(`/partner/support/tickets/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ text, body: text }),
      }),
    ),

  // =========================================
  // Schedule (per-date blocking + weekly)
  // =========================================
  getBlockedDate: (date: string) =>
    unwrap<{ date: string; dayOff: boolean; slots: string[] }>(
      request(`/partner/schedule/blocked?date=${encodeURIComponent(date)}`),
    ),
  toggleBlockedSlot: (date: string, slot: string) =>
    unwrap<{ date: string; dayOff: boolean; slots: string[] }>(
      request(`/partner/schedule/blocked`, {
        method: "POST",
        body: JSON.stringify({ date, slot }),
      }),
    ),
  setBlockedDayOff: (date: string, dayOff: boolean) =>
    unwrap<{ date: string; dayOff: boolean; slots: string[] }>(
      request(`/partner/schedule/blocked`, {
        method: "POST",
        body: JSON.stringify({ date, dayOff }),
      }),
    ),
  getWeeklySchedule: () =>
    unwrap<{ workingHours: any }>(request(`/partner/schedule/weekly`)),
  setWeeklySchedule: (workingHours: any) =>
    unwrap<{ workingHours: any }>(
      request(`/partner/schedule/weekly`, {
        method: "PUT",
        body: JSON.stringify({ workingHours }),
      }),
    ),

  // =========================================
  // Branches (partner-scoped CRUD)
  // =========================================
  listBranches: () =>
    unwrap<{ items: any[] }>(request(`/partner/branches`)).then((d: any) => ({
      items: (d?.items || d?.branches || d || []) as any[],
    })),
  createBranch: (body: {
    nameAr: string;
    nameEn?: string | null;
    phone?: string | null;
    address?: string | null;
    mapsUrl?: string | null;
    isDefault?: boolean;
    status?: string;
  }) =>
    unwrap<{ branch: any }>(
      request(`/partner/branches`, { method: "POST", body: JSON.stringify(body) }),
    ),
  updateBranch: (id: string, body: any) =>
    unwrap<{ branch: any }>(
      request(`/partner/branches/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    ),
  setDefaultBranch: (id: string) =>
    unwrap<any>(request(`/partner/branches/${id}/default`, { method: "PUT" })),
  deleteBranch: (id: string) =>
    request<ApiResponse<any>>(`/partner/branches/${id}`, { method: "DELETE" }),
};

