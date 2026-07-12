// Admin Branches API — CRUD for partner branches
import { request } from "./client";
import type { ApiResponse, Branch } from "./types";

export type BranchListParams = {
  partnerId?: string;
  q?: string;
  page?: number;
  limit?: number;
};

export type BranchInput = {
  partnerId?: string | null;
  nameAr: string;
  nameEn?: string | null;
  phone?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
  isDefault?: boolean;
  workingHours?: any | null;
  status?: string;
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

function unwrapList(d: any): { items: Branch[]; total: number } {
  if (Array.isArray(d)) return { items: d, total: d.length };
  const items = d?.items || d?.branches || d?.data || [];
  return { items, total: d?.total ?? items.length };
}

export const adminBranchesApi = {
  list: async (params?: BranchListParams) => {
    const r = await request<ApiResponse<any>>(`/admin/branches${qs(params)}`);
    return unwrapList(r.data);
  },
  listForPartner: async (partnerId: string) => {
    const r = await request<ApiResponse<any>>(`/admin/branches${qs({ partnerId })}`);
    return unwrapList(r.data);
  },
  get: async (id: string): Promise<Branch> => {
    const r = await request<ApiResponse<any>>(`/admin/branches/${id}`);
    return r.data?.branch ?? r.data;
  },
  create: (body: BranchInput) =>
    request<ApiResponse<any>>(`/admin/branches`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<BranchInput>) =>
    request<ApiResponse<any>>(`/admin/branches/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  setDefault: (id: string) =>
    request<ApiResponse<any>>(`/admin/branches/${id}/set-default`, { method: "PUT" }),
  remove: (id: string) =>
    request<ApiResponse<any>>(`/admin/branches/${id}`, { method: "DELETE" }),
};
