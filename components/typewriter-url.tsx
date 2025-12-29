"use client";

import { Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_ROOT_DOMAIN } from "@/lib/config/public";

const names = ["mario", "jackie", "your-name"];
const TYPING_SPEED = 120;
const DELETING_SPEED = 80;
const PAUSE_DURATION = 2000;

export function TypewriterUrl() {
  const [displayText, setDisplayText] = useState("");
  const [nameIndex, setNameIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentName = names[nameIndex];

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          // Typing
          if (displayText.length < currentName.length) {
            setDisplayText(currentName.slice(0, displayText.length + 1));
          } else {
            // Finished typing, pause then start deleting
            setTimeout(() => setIsDeleting(true), PAUSE_DURATION);
          }
        } else {
          // Deleting
          if (displayText.length > 0) {
            setDisplayText(currentName.slice(0, displayText.length - 1));
          } else {
            // Finished deleting, move to next name
            setIsDeleting(false);
            setNameIndex((prev) => (prev + 1) % names.length);
          }
        }
      },
      isDeleting ? DELETING_SPEED : TYPING_SPEED
    );

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, nameIndex]);

  return (
    <div className="mt-12 inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-denim/30 bg-card px-5 py-3 shadow-denim">
      <Globe className="h-4 w-4 text-denim" />
      <code className="text-sm">
        <span className="text-rust font-semibold">
          {displayText}
          <span className="animate-pulse">|</span>
        </span>
        <span className="text-muted-foreground">.{DEFAULT_ROOT_DOMAIN}</span>
      </code>
    </div>
  );
}
