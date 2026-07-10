import { request, getToken, getSid } from './client';
import type { Cart, ApiResponse } from './types';

// Backend (OFFERS-ONLY) now returns:
//   { id, items: [{ id, offerId, slug, title, qty, price, originalPrice, lineTotal, offer }],
//     summary: { itemsCount, qty, subtotal, discount, vat, total, currency },
//     coupon: { code, discountType, value, discount } | null }
// The rest of the frontend still reads { subtotal, vat, total, items[].service_slug, ... }.
// Normalize to that legacy shape so existing UI keeps working.
function normalizeCart(raw: any): Cart {
  if (!raw || typeof raw !== 'object') {
    return { items: [], subtotal: 0, vat: 0, total: 0, sessionId: '' } as Cart;
  }
  const items = Array.isArray(raw.items) ? raw.items : [];
  const summary = raw.summary || {};
  // Slug used by FE to identify offer lines: keep `offer:<id>` convention.
  const slugOf = (it: any): string => {
    const offerId = it.offerId ?? it.offer_id ?? it.serviceId ?? it.service_id;
    if (offerId) return `offer:${offerId}`;
    return it.serviceSlug ?? it.service_slug ?? it.slug ?? '';
  };
  return {
    items: items.map((it: any) => ({
      id: String(it.id),
      service_slug: slugOf(it),
      service_title: it.title ?? it.serviceTitle ?? it.service_title ?? it.offer?.titleAr ?? '',
      plan_id: null,
      plan_name: null,
      price: Number(it.price) || 0,
      original_price: it.originalPrice ?? it.original_price ?? null,
      qty: Number(it.qty) || 1,
      branchId: it.branchId ?? it.branch_id ?? it.branch?.id ?? null,
      branchName: it.branch?.nameAr ?? it.branch?.name_ar ?? it.branchName ?? it.branch_name ?? null,
    })),
    subtotal: Number(summary.subtotal ?? raw.subtotal) || 0,
    vat: Number(summary.vat ?? raw.vat) || 0,
    total: Number(summary.total ?? raw.total) || 0,
    sessionId: raw.sessionId ?? raw.session_id ?? '',
    discount: summary.discount ?? raw.couponDiscount ?? raw.discount ?? undefined,
    code: raw.coupon?.code ?? raw.code ?? undefined,
  };

}

async function unwrap(p: Promise<ApiResponse<any>>): Promise<ApiResponse<Cart>> {
  const res = await p;
  return { ...res, data: normalizeCart(res?.data) };
}

export type AddCartBody = {
  offerId?: string;
  offerSlug?: string;
  branchId?: string | null;
  // Legacy alias inputs we still accept from existing UI code:
  serviceId?: string;
  serviceSlug?: string;
  serviceTitle?: string;
  servicePlanId?: string;
  planId?: string;
  planName?: string;
  qty?: number;
  price?: number;
  originalPrice?: number;
};

// Extract the offer id from any legacy slug format the UI might pass.
// Accepts:  "offer:abcd-1234" | "<uuid>" | undefined
function extractOfferId(input?: string): string | undefined {
  if (!input) return undefined;
  if (input.startsWith('offer:')) return input.slice(6);
  if (input.startsWith('plan:') || input.startsWith('product:')) return undefined;
  return input;
}

export const cart = {
  get: () => unwrap(request<ApiResponse<any>>('/cart')),

  add: (body: AddCartBody) => {
    const h: Record<string, string> = {};
    if (!getToken()) h['X-Session-Id'] = getSid();

    const offerId =
      body.offerId ??
      body.serviceId ??
      extractOfferId(body.offerSlug ?? body.serviceSlug);

    if (!offerId) {
      // Backend is offers-only — refuse non-offer lines gracefully instead of
      // posting a payload it will reject with 422.
      return Promise.reject(new Error('Cart backend accepts offers only'));
    }

    const payload: Record<string, unknown> = {
      offerId,
      qty: body.qty ?? 1,
    };
    return unwrap(request<ApiResponse<any>>('/cart/items', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: h,
    }));
  },

  updateQty: (lineId: string, qty: number) =>
    unwrap(request<ApiResponse<any>>(`/cart/items/${lineId}`, { method: 'PUT', body: JSON.stringify({ qty }) })),

  remove: (lineId: string) =>
    unwrap(request<ApiResponse<any>>(`/cart/items/${lineId}`, { method: 'DELETE' })),

  clear: () => unwrap(request<ApiResponse<any>>('/cart', { method: 'DELETE' })),

  applyCoupon: (code: string) =>
    unwrap(request<ApiResponse<any>>('/cart/coupon', { method: 'POST', body: JSON.stringify({ code }) })),

  removeCoupon: () =>
    unwrap(request<ApiResponse<any>>('/cart/coupon', { method: 'DELETE' })),
};
