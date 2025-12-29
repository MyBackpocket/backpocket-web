"use client";

import { useEffect, useRef } from "react";
import { getVisitedSessionKey } from "@/lib/constants/storage";
import { trpc } from "@/lib/trpc/client";

interface VisitTrackerProps {
  spaceId: string;
}

/**
 * Invisible component that registers a visit to a public space.
 * Fires once on mount and deduplicates within the same session.
 */
export function VisitTracker({ spaceId }: VisitTrackerProps) {
  const hasTracked = useRef(false);
  const registerVisit = trpc.public.registerVisit.useMutation();

  useEffect(() => {
    // Only track once per component lifecycle
    if (hasTracked.current) return;
    hasTracked.current = true;

    // Check sessionStorage to avoid counting page refreshes
    const sessionKey = getVisitedSessionKey(spaceId);
    if (typeof window !== "undefined" && sessionStorage.getItem(sessionKey)) {
      return;
    }

    // Register the visit
    registerVisit.mutate(
      { spaceId, path: window.location.pathname },
      {
        onSuccess: () => {
          // Mark as visited in this session
          if (typeof window !== "undefined") {
            sessionStorage.setItem(sessionKey, "1");
          }
        },
      }
    );
  }, [spaceId, registerVisit]);

  return null;
}
