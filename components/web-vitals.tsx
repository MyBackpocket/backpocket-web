"use client";

import { useEffect } from "react";

/**
 * Web Vitals reporting component
 * Reports Core Web Vitals (LCP, INP, CLS, FCP, TTFB) to console in development
 * and can be extended to send to analytics in production.
 */
export function WebVitals() {
  useEffect(() => {
    // Only report in browser
    if (typeof window === "undefined") return;

    // Use web-vitals library if available, otherwise use Performance API
    const reportVital = (metric: { name: string; value: number; rating?: string }) => {
      // In development, log to console
      if (process.env.NODE_ENV === "development") {
        const rating =
          metric.rating ||
          (metric.value < 100 ? "good" : metric.value < 300 ? "needs-improvement" : "poor");
        console.log(`[WebVitals] ${metric.name}: ${metric.value.toFixed(2)}ms (${rating})`);
      }
      // In production, you could send to analytics here
      // e.g., sendToAnalytics(metric)
    };

    // Use PerformanceObserver for Core Web Vitals
    try {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
        if (lastEntry) {
          reportVital({
            name: "LCP",
            value: lastEntry.startTime,
            rating:
              lastEntry.startTime < 2500
                ? "good"
                : lastEntry.startTime < 4000
                  ? "needs-improvement"
                  : "poor",
          });
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

      // First Contentful Paint
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find((e) => e.name === "first-contentful-paint");
        if (fcpEntry) {
          reportVital({
            name: "FCP",
            value: fcpEntry.startTime,
            rating:
              fcpEntry.startTime < 1800
                ? "good"
                : fcpEntry.startTime < 3000
                  ? "needs-improvement"
                  : "poor",
          });
        }
      });
      fcpObserver.observe({ type: "paint", buffered: true });

      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          hadRecentInput: boolean;
          value: number;
        })[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });

      // Report CLS on page hide
      const reportCLS = () => {
        reportVital({
          name: "CLS",
          value: clsValue * 1000,
          rating: clsValue < 0.1 ? "good" : clsValue < 0.25 ? "needs-improvement" : "poor",
        });
      };
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") reportCLS();
      });

      // Time to First Byte (from navigation timing)
      const navEntry = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (navEntry) {
        const ttfb = navEntry.responseStart - navEntry.requestStart;
        reportVital({
          name: "TTFB",
          value: ttfb,
          rating: ttfb < 800 ? "good" : ttfb < 1800 ? "needs-improvement" : "poor",
        });
      }

      // Cleanup
      return () => {
        lcpObserver.disconnect();
        fcpObserver.disconnect();
        clsObserver.disconnect();
      };
    } catch {
      // PerformanceObserver not supported
      console.log("[WebVitals] Performance observation not supported");
    }
  }, []);

  return null;
}
