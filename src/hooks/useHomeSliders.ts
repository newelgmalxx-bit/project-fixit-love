// Fetches the two home-page offer sliders (slider_1, slider_2) from
// GET /home-offer-sliders. This endpoint is the source of truth for
// slider rows and returns every field the shared OfferCard needs
// (vendorName, displayAddress, rating, reviewsCount, branch,
// hasMultipleBranches, branchesCount) — no per-card GET /offers/:id
// or GET /partners/:id is ever needed.
import { useQuery } from "@tanstack/react-query";
import { request, ApiError } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";

type SlidersResponse = {
  slider_1: any[];
  slider_2: any[];
};

async function fetchSliders(): Promise<SlidersResponse | null> {
  try {
    const r = await request<ApiResponse<any>>("/home-offer-sliders");
    const d: any = (r as any)?.data ?? r;
    const sliders = d?.sliders ?? d ?? {};
    return {
      slider_1: Array.isArray(sliders.slider_1) ? sliders.slider_1 : [],
      slider_2: Array.isArray(sliders.slider_2) ? sliders.slider_2 : [],
    };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 401 || e.status === 403)) {
      return null;
    }
    throw e;
  }
}

function sortEntries(items: any[]): any[] {
  return [...items]
    .filter((x) => x?.isActive !== false && x?.is_active !== 0 && x?.is_active !== "0")
    .sort((a, b) => Number(a?.sliderSortOrder ?? a?.sortOrder ?? a?.sort_order ?? 0) - Number(b?.sliderSortOrder ?? b?.sortOrder ?? b?.sort_order ?? 0));
}

export function useHomeSliders() {
  return useQuery({
    queryKey: ["home-offer-sliders"],
    queryFn: async () => {
      const raw = await fetchSliders();
      if (!raw) return { slider_1: [], slider_2: [] };
      return {
        slider_1: sortEntries(raw.slider_1),
        slider_2: sortEntries(raw.slider_2),
      };
    },
    staleTime: 30_000,
  });
}
