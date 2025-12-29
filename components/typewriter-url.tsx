"use client";

import { Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_ROOT_DOMAIN } from "@/lib/config/public";

const domains = [
  `mario.${DEFAULT_ROOT_DOMAIN}`,
  `jackie.${DEFAULT_ROOT_DOMAIN}`,
  `your-name.${DEFAULT_ROOT_DOMAIN}`,
  "your-custom-backpocket-domain.com",
  "backpocket.mariolopez.org",
];
const TYPING_SPEED = 85;
const DELETING_SPEED = 75;
const PAUSE_DURATION = 1750;

export function TypewriterUrl() {
  const [displayText, setDisplayText] = useState("");
  const [domainIndex, setDomainIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentDomain = domains[domainIndex];

    if (!isDeleting && displayText === currentDomain) {
      const pauseTimeout = setTimeout(() => setIsDeleting(true), PAUSE_DURATION);
      return () => clearTimeout(pauseTimeout);
    }

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setDisplayText(currentDomain.slice(0, displayText.length + 1));
        return;
      }

      if (displayText.length > 0) {
        setDisplayText(currentDomain.slice(0, displayText.length - 1));
        return;
      }

      setIsDeleting(false);
      setDomainIndex((prev) => (prev + 1) % domains.length);
    }, isDeleting ? DELETING_SPEED : TYPING_SPEED);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, domainIndex]);

  return (
    <div className="mt-12 inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-denim/30 bg-card px-5 py-3 shadow-denim">
      <Globe className="h-4 w-4 text-denim" />
      <code className="text-sm">
        <span className="text-rust font-semibold">
          {displayText}
          <span className="animate-pulse">|</span>
        </span>
      </code>
    </div>
  );
}
