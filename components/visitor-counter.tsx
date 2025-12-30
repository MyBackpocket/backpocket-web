"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { formatNumber } from "@/lib/utils";
import { VisitTracker } from "./visit-tracker";

interface VisitorCounterProps {
  spaceId: string;
  initialCount: number;
}

/**
 * Client-side visitor counter that updates live when a visit is registered.
 * Displays the count and includes the invisible VisitTracker component.
 */
export function VisitorCounter({ spaceId, initialCount }: VisitorCounterProps) {
  const [count, setCount] = useState(initialCount);

  return (
    <>
      <VisitTracker spaceId={spaceId} onVisitRegistered={setCount} />
      <div className="visitor-counter">
        <Eye className="h-4 w-4" />
        <span>{formatNumber(count)} visits</span>
      </div>
    </>
  );
}
