// Admin API for the two home-page offer sliders (slider_1, slider_2).
// Backend spec: see docs/BACKEND_PROMPT_SEO_AND_PACKAGES + INTEGRATION_GUIDE.md
// Endpoints:
//   GET    /admin/home-offer-sliders[?sliderKey=slider_1]
//   POST   /admin/home-offer-sliders    { sliderKey, offerId, sortOrder?, isActive? }
//   PUT    /admin/home-offer-sliders/:id
//   PUT    /admin/home-offer-sliders/reorder  { items: [{id, sortOrder}] }
//   DELETE /admin/home-offer-sliders/:id

import { request, ApiError } from "./client";
import type { ApiResponse } from "./types";

export type HomeSliderKey = "slider_1" | "slider_2";

export type HomeSliderEntry = {
  id: string;
  sliderKey: HomeSliderKey;
  offerId: string;
  sortOrder: number;
  isActive: boolean;
  offer?: {
    id?: string;
    titleAr?: string;
    titleEn?: string;
    image?: string | null;
    priceBefore?: number | string;
    priceAfter?: number | string;
    discountPercent?: number;
    status?: string;
    partnerNameAr?: string;
    partnerNameEn?: string;
  };
};

function normalize(raw: any, key?: HomeSliderKey): HomeSliderEntry {
  return {
    id: String(raw?.id ?? ""),
    sliderKey: (raw?.sliderKey ?? raw?.slider_key ?? key ?? "slider_1") as HomeSliderKey,
    offerId: String(raw?.offerId ?? raw?.offer_id ?? ""),
    sortOrder: Number(raw?.sortOrder ?? raw?.sort_order ?? 0) || 0,
    isActive:
      typeof raw?.isActive === "boolean"
        ? raw.isActive
        : raw?.is_active === 1 || raw?.is_active === "1" || raw?.is_active === true,
    offer: raw?.offer ?? undefined,
  };
}

export const adminHomeSlidersApi = {
  /** Returns entries for both sliders. Silently returns empty on 404/405. */
  list: async (): Promise<Record<HomeSliderKey, HomeSliderEntry[]>> => {
    try {
      const r = await request<ApiResponse<any>>("/admin/home-offer-sliders");
      const d: any = (r as any)?.data ?? r;
      const sliders = d?.sliders ?? d ?? {};
      const s1: any[] = Array.isArray(sliders.slider_1) ? sliders.slider_1 : [];
      const s2: any[] = Array.isArray(sliders.slider_2) ? sliders.slider_2 : [];
      return {
        slider_1: s1.map((x) => normalize(x, "slider_1")).sort((a, b) => a.sortOrder - b.sortOrder),
        slider_2: s2.map((x) => normalize(x, "slider_2")).sort((a, b) => a.sortOrder - b.sortOrder),
      };
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        return { slider_1: [], slider_2: [] };
      }
      throw e;
    }
  },

  create: (body: {
    sliderKey: HomeSliderKey;
    offerId: string;
    sortOrder?: number;
    isActive?: boolean;
  }) =>
    request<ApiResponse<any>>("/admin/home-offer-sliders", {
      method: "POST",
      body: JSON.stringify({
        sliderKey: body.sliderKey,
        slider_key: body.sliderKey,
        offerId: body.offerId,
        offer_id: body.offerId,
        sortOrder: body.sortOrder ?? 0,
        sort_order: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
        is_active: body.isActive ?? true,
      }),
    }),

  update: (
    id: string,
    body: { sortOrder?: number; isActive?: boolean; sliderKey?: HomeSliderKey },
  ) => {
    const payload: Record<string, any> = {};
    if (body.sortOrder != null) {
      payload.sortOrder = body.sortOrder;
      payload.sort_order = body.sortOrder;
    }
    if (body.isActive != null) {
      payload.isActive = body.isActive;
      payload.is_active = body.isActive;
    }
    if (body.sliderKey) {
      payload.sliderKey = body.sliderKey;
      payload.slider_key = body.sliderKey;
    }
    return request<ApiResponse<any>>(`/admin/home-offer-sliders/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  reorder: (items: Array<{ id: string; sortOrder: number }>) =>
    request<ApiResponse<any>>(`/admin/home-offer-sliders/reorder`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),

  remove: (id: string) =>
    request<ApiResponse<any>>(`/admin/home-offer-sliders/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};
