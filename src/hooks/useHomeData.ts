// Single-request home-page data loader.
//
// Hits GET /home-data once (cached 30s via react-query) and seeds the
// existing per-resource caches (`['categories']`, `['partner', id]`,
// `['offer', id]`, `['offers','featured', limit]`, `['sponsored-ads']`,
// `['offer-reviews', offerId]`) so all child components on the home page
// read from cache instead of firing their own requests.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { publicApi } from "@/lib/api/public";

export type HomeData = Awaited<ReturnType<typeof publicApi.getHomeData>>;

export function useHomeData(limit: number = 20) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["home-data", limit],
    queryFn: () => publicApi.getHomeData(limit),
    staleTime: 30_000,
  });

  // Seed sibling caches whenever fresh data arrives.
  useEffect(() => {
    const data = query.data;
    if (!data) return;

    if (data.categories?.length) {
      qc.setQueryData(["categories"], data.categories);
    }

    if (data.partners) {
      for (const [id, p] of Object.entries(data.partners)) {
        if (id && p) qc.setQueryData(["partner", id], p);
      }
    }

    if (data.featuredOffers?.length) {
      // Seed individual offer caches so OfferCard / SlideVisual lookups hit cache.
      for (const o of data.featuredOffers) {
        if (o?.id) qc.setQueryData(["offer", String(o.id)], o);
      }
      // Seed the featured-offers list cache for useFeaturedOffers(limit).
      qc.setQueryData(["offers", "featured", limit], data.featuredOffers);
    }

    if (data.sponsoredAds) {
      qc.setQueryData(["sponsored-ads"], data.sponsoredAds);
    }

    if (data.reviews) {
      for (const [offerId, items] of Object.entries(data.reviews)) {
        if (!offerId || !Array.isArray(items)) continue;
        const total = items.length;
        const average =
          total > 0
            ? Math.round((items.reduce((s, r: any) => s + Number(r?.rating || 0), 0) / total) * 10) /
              10
            : 0;
        qc.setQueryData(["offer-reviews", offerId], { items, total, average });
      }
    }
  }, [query.data, qc, limit]);

  return query;
}
