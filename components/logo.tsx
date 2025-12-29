import Image from "next/image";
// Static imports for logo images - Next.js handles optimization
import logo64 from "@/assets/img/Backpocket-Logo-64.webp";
import logo128 from "@/assets/img/Backpocket-Logo-128.webp";
import logo256 from "@/assets/img/Backpocket-Logo-256.webp";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
}

const sizeConfig = {
  xs: { dimension: 16, src: logo64, text: "text-sm" },
  sm: { dimension: 24, src: logo64, text: "text-base" },
  md: { dimension: 32, src: logo64, text: "text-lg" },
  lg: { dimension: 48, src: logo128, text: "text-xl" },
  xl: { dimension: 64, src: logo128, text: "text-2xl" },
};

export function Logo({ size = "md", className, showText = true }: LogoProps) {
  const { dimension, src, text } = sizeConfig[size];

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src={src}
        alt="backpocket"
        width={dimension}
        height={dimension}
        className="rounded-lg"
        priority
      />
      {showText && <span className={cn("font-semibold", text)}>backpocket</span>}
    </span>
  );
}

export function LogoIcon({ size = "md", className }: Omit<LogoProps, "showText">) {
  const { dimension, src } = sizeConfig[size];

  return (
    <Image
      src={src}
      alt="backpocket"
      width={dimension}
      height={dimension}
      className={cn("rounded-lg", className)}
      priority
    />
  );
}

// Export larger logo for hero sections
export function LogoHero({ className }: { className?: string }) {
  return (
    <Image
      src={logo256}
      alt="backpocket"
      width={120}
      height={120}
      className={cn("rounded-2xl shadow-denim-lg", className)}
      priority
    />
  );
}
