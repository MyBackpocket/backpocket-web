"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  title: string;
  level: number;
  offsetTop: number;
}

interface ScrollNavigatorProps {
  /** Selector to find the scrollable content container */
  contentSelector?: string;
  /** Minimum scroll threshold before showing the navigator */
  showThreshold?: number;
  /** Additional class names */
  className?: string;
}

export function ScrollNavigator({
  contentSelector = "article",
  showThreshold = 300,
  className,
}: ScrollNavigatorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Store references to heading elements
  const headingRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Extract sections from headings
  useEffect(() => {
    const extractSections = () => {
      const content = document.querySelector(contentSelector);
      if (!content) return;

      const headings = content.querySelectorAll("h1, h2, h3");
      const newSections: Section[] = [];
      headingRefs.current.clear();

      headings.forEach((heading, index) => {
        const text = heading.textContent?.trim();
        if (!text) return;

        // Generate a unique ID for this heading
        const id = heading.id || `nav-section-${index}`;

        // Store reference to the actual DOM element
        headingRefs.current.set(id, heading as HTMLElement);

        // Also set the ID on the element for consistency
        if (!heading.id) {
          heading.id = id;
        }

        const level = Number.parseInt(heading.tagName[1], 10);
        const rect = (heading as HTMLElement).getBoundingClientRect();
        const scrollTop = window.scrollY;

        newSections.push({
          id,
          title: text.length > 40 ? `${text.slice(0, 40)}…` : text,
          level,
          offsetTop: rect.top + scrollTop,
        });
      });

      setSections(newSections);
    };

    const timer = setTimeout(extractSections, 500);
    window.addEventListener("resize", extractSections);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", extractSections);
    };
  }, [contentSelector]);

  // Handle scroll updates
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;

      setScrollProgress(progress);
      setIsVisible(scrollTop > showThreshold && docHeight > showThreshold * 2);

      if (sections.length > 0) {
        let active = sections[0]?.id || null;

        // Check each section using stored refs for accurate positioning
        for (const section of sections) {
          const element = headingRefs.current.get(section.id);
          if (element) {
            const rect = element.getBoundingClientRect();
            // If the top of the heading is above the viewport center, it's the active section
            if (rect.top <= 150) {
              active = section.id;
            }
          } else if (scrollTop >= section.offsetTop - 100) {
            active = section.id;
          }
        }
        setActiveSection(active);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [showThreshold, sections]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollToBottom = useCallback(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    // First try to get from our stored refs
    let element = headingRefs.current.get(sectionId);

    // Fallback to getElementById
    if (!element) {
      element = document.getElementById(sectionId) ?? undefined;
    }

    if (element) {
      // Use scrollTo with offset for better positioning
      const rect = element.getBoundingClientRect();
      const scrollTop = window.scrollY;
      const targetPosition = rect.top + scrollTop - 20; // 20px offset from top

      window.scrollTo({
        top: targetPosition,
        behavior: "smooth",
      });
    }
    setIsExpanded(false);
  }, []);

  const [sectionMarkers, setSectionMarkers] = useState<(Section & { position: number })[]>([]);

  // Update section markers when sections change
  useEffect(() => {
    if (sections.length === 0) {
      setSectionMarkers([]);
      return;
    }

    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const markers = sections.map((section) => ({
      ...section,
      position: docHeight > 0 ? Math.min(section.offsetTop / docHeight, 1) : 0,
    }));

    setSectionMarkers(markers);
  }, [sections]);

  const activeIndex = sectionMarkers.findIndex((s) => s.id === activeSection);

  if (!isVisible) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed right-4 bottom-6 z-50",
        "transition-all duration-500 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
    >
      {/* Expanded section list */}
      <div
        className={cn(
          "absolute bottom-full right-0 mb-3",
          "w-64 max-h-80 overflow-y-auto",
          "rounded-xl border border-border/50",
          "bg-background/80 backdrop-blur-xl",
          "shadow-2xl shadow-black/20",
          "transition-all duration-300 ease-out origin-bottom-right",
          isExpanded
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        <div className="p-2 space-y-0.5">
          {/* Top button */}
          <button
            type="button"
            onClick={scrollToTop}
            className={cn(
              "w-full px-3 py-2 rounded-lg text-left",
              "text-xs font-medium text-muted-foreground",
              "hover:bg-muted/50 hover:text-foreground",
              "transition-colors duration-150",
              "flex items-center gap-2"
            )}
          >
            <span className="opacity-50">↑</span>
            <span>Top</span>
          </button>

          {/* Section list */}
          {sectionMarkers.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-left",
                "text-xs transition-all duration-150",
                "flex items-center gap-2",
                activeSection === section.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              style={{
                paddingLeft: `${12 + (section.level - 1) * 8}px`,
              }}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full flex-shrink-0",
                  activeSection === section.id ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
              <span className="truncate">{section.title}</span>
            </button>
          ))}

          {/* Bottom button */}
          <button
            type="button"
            onClick={scrollToBottom}
            className={cn(
              "w-full px-3 py-2 rounded-lg text-left",
              "text-xs font-medium text-muted-foreground",
              "hover:bg-muted/50 hover:text-foreground",
              "transition-colors duration-150",
              "flex items-center gap-2"
            )}
          >
            <span className="opacity-50">↓</span>
            <span>End</span>
          </button>
        </div>
      </div>

      {/* Main pill control */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "relative group",
          "flex items-center gap-2.5",
          "h-10 px-4 rounded-full",
          "bg-background/80 backdrop-blur-xl",
          "border border-border/50",
          "shadow-lg shadow-black/10",
          "hover:shadow-xl hover:shadow-black/20",
          "hover:border-border",
          "transition-all duration-300"
        )}
      >
        {/* Progress ring */}
        <div className="relative w-5 h-5">
          <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20" aria-hidden="true">
            {/* Background circle */}
            <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2" className="stroke-muted/30" />
            {/* Progress circle */}
            <circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              className="stroke-primary transition-all duration-300"
              style={{
                strokeDasharray: `${scrollProgress * 50.27} 50.27`,
              }}
            />
          </svg>
          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          </div>
        </div>

        {/* Current section & progress */}
        <div className="flex flex-col items-start min-w-0">
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            {Math.round(scrollProgress * 100)}%
          </span>
          {activeIndex >= 0 && (
            <span className="text-[10px] text-muted-foreground/60 truncate max-w-24">
              {activeIndex + 1}/{sectionMarkers.length}
            </span>
          )}
        </div>

        {/* Expand indicator */}
        <svg
          className={cn(
            "w-3 h-3 text-muted-foreground/50 transition-transform duration-300",
            isExpanded && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Quick nav buttons (visible when collapsed) */}
      <div
        className={cn(
          "absolute bottom-0 right-full mr-2",
          "flex items-center gap-1",
          "transition-all duration-300",
          isExpanded ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        <button
          type="button"
          onClick={scrollToTop}
          className={cn(
            "w-8 h-8 rounded-full",
            "flex items-center justify-center",
            "bg-background/60 backdrop-blur-lg",
            "border border-border/30",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-background/80 hover:border-border/50",
            "transition-all duration-200"
          )}
          aria-label="Scroll to top"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={scrollToBottom}
          className={cn(
            "w-8 h-8 rounded-full",
            "flex items-center justify-center",
            "bg-background/60 backdrop-blur-lg",
            "border border-border/30",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-background/80 hover:border-border/50",
            "transition-all duration-200"
          )}
          aria-label="Scroll to bottom"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
