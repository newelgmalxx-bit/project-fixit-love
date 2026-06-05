import { type ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { getToken } from "@/lib/api/client";
import { partnerAuth, getStoredPartner } from "@/lib/api/partner";

export function PartnerGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!getToken()) {
        if (alive) setState("denied");
        return;
      }
      // Optimistic: if we already have a stored partner, allow immediately.
      if (getStoredPartner()) {
        if (alive) setState("ok");
      }
      try {
        await partnerAuth.me();
        if (alive) setState("ok");
      } catch {
        if (alive) setState("denied");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "denied") {
    // Use pathname only (not href) to avoid stacking encoded redirect params,
    // and skip the redirect entirely if we're already on the partner-login page.
    const path = location.pathname;
    if (path === "/partner-login") {
      return <Navigate to="/partner-login" replace />;
    }
    return <Navigate to="/partner-login" search={{ redirect: path } as any} replace />;
  }

  return <>{children}</>;
}
