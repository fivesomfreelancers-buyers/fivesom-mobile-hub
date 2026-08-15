import siteLogo from "@/assets/fivesom-site-logo.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Avatar used by the official FIVESOM Support / News channels — the same
 * logo mark the website uses, on a white disc.
 */
export function ChannelLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-border",
        className,
      )}
    >
      <img
        src={siteLogo.url}
        alt="FIVESOM"
        className="h-[78%] w-[78%] object-contain"
        loading="eager"
      />
    </span>
  );
}
