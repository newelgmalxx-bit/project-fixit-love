// Admin Bookings API
import { request } from "./client";
import type { ApiResponse } from "./types";

export type AdminBooking = {
  id: string;
  status: string;
  partnerId?: string;
  partnerName?: string;
  offerId?: string;
  offerTitle?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  city?: string;
  category?: string;
  total?: number;
  deposit?: number;
  remaining?: number;
  scheduledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
};

export type BookingListParams = {
  status?: string;
  city?: string;
  category?: string;
  partnerId?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
};

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

function unwrapList<T>(d: any) {
  if (Array.isArray(d)) return { items: d as T[], total: d.length, page: 1, totalPages: 1 };
  return {
    items: (d?.items || d?.data || []) as T[],
    total: d?.total ?? 0,
    page: d?.page ?? 1,
    pageSize: d?.pageSize,
    totalPages: d?.totalPages ?? 1,
  };
}

export const adminBookingsApi = {
  list: async (params?: BookingListParams) => {
    const r = await request<ApiResponse<any>>(`/admin/bookings${qs(params)}`);
    return unwrapList<AdminBooking>(r.data);
  },
  get: async (id: string): Promise<AdminBooking> => {
    const r = await request<ApiResponse<any>>(`/admin/bookings/${id}`);
    return r.data?.booking ?? r.data;
  },
  update: (id: string, body: Partial<AdminBooking>) =>
    request<ApiResponse<any>>(`/admin/bookings/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  setStatus: (id: string, status: string) =>
    request<ApiResponse<any>>(`/admin/bookings/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  // Backend has no dedicated refund endpoint — model it as a status update to 'refunded'.
  refund: (id: string, _body: { amount?: number; reason?: string } = {}) =>
    request<ApiResponse<any>>(`/admin/bookings/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: "refunded" }),
    }),
  redeem: (id: string, code: string) =>
    request<ApiResponse<any>>(`/admin/bookings/${id}/redeem`, {
      method: "POST",
      body: JSON.stringify({ verify_code: code, code }),
    }),
};
