// Fetches the two home-page offer sliders (slider_1, slider_2) as a
// standalone request, because the batched /home-data endpoint on the
// backend does not (yet) include them. Tries the public route first,
// then falls back to the admin route (works when an admin session is
// active — useful for previewing while the public route is deployed).
import { useQuery } from "@tanstack/react-query";
import { request, ApiError } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";

type SlidersResponse = {
  slider_1: any[];
  slider_2: any[];
};

async function fetchSliders(path: string): Promise<SlidersResponse | null> {
  try {
    const r = await request<ApiResponse<any>>(path);
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
    .sort((a, b) => Number(a?.sortOrder ?? a?.sort_order ?? 0) - Number(b?.sortOrder ?? b?.sort_order ?? 0));
}

/** Flatten backend row → shape our HomeOfferSlider component understands. */
function flatten(items: any[]): any[] {
  return items.map((row) => {
    const offer = row?.offer ?? {};
    return {
      id: row?.offerId ?? row?.offer_id ?? offer?.id ?? row?.id,
      ...offer,
      partnerNameAr: offer?.partnerNameAr ?? row?.partnerNameAr,
      partnerNameEn: offer?.partnerNameEn ?? row?.partnerNameEn,
      partnerCity: offer?.partnerCity ?? row?.partnerCity,
      partnerLogo: offer?.partnerLogo ?? row?.partnerLogo,
      partnerId: offer?.partnerId ?? row?.partnerId ?? row?.partner_id,
    };
  });
}

export function useHomeSliders() {
  return useQuery({
    queryKey: ["home-offer-sliders"],
    queryFn: async () => {
      // Try public first (route name kept generic so backend can expose it later).
      let raw = await fetchSliders("/home-offer-sliders");
      if (!raw) raw = await fetchSliders("/admin/home-offer-sliders");
      if (!raw) return { slider_1: [], slider_2: [] };
      return {
        slider_1: flatten(sortEntries(raw.slider_1)),
        slider_2: flatten(sortEntries(raw.slider_2)),
      };
    },
    staleTime: 30_000,
  });
}
