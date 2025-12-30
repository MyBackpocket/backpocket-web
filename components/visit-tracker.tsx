"use client";

import { useEffect, useRef } from "react";
import { getVisitedSessionKey } from "@/lib/constants/storage";
import { trpc } from "@/lib/trpc/client";

interface VisitTrackerProps {
  spaceId: string;
  /** Optional callback fired when visit is successfully registered, receives new total */
  onVisitRegistered?: (newTotal: number) => void;
}

/**
 * Invisible component that registers a visit to a public space.
 * Fires once on mount and deduplicates within the same session.
 */
export function VisitTracker({ spaceId, onVisitRegistered }: VisitTrackerProps) {
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

    const path = window.location.pathname;

    // Register the visit
    registerVisit.mutate(
      { spaceId, path },
      {
        onSuccess: (data) => {
          // Mark as visited in this session
          if (typeof window !== "undefined") {
            sessionStorage.setItem(sessionKey, "1");
          }
          // Notify parent of new visit count for live UI updates
          if (onVisitRegistered && data.visitCount !== undefined) {
            onVisitRegistered(data.visitCount);
          }
        },
        onError: (error) => {
          // Surface failures so they're visible in DevTools console
          console.error("[VisitTracker] Failed to register visit:", {
            spaceId,
            path,
            error: error.message,
          });
        },
      }
    );
  }, [spaceId, registerVisit, onVisitRegistered]);

  return null;
}
