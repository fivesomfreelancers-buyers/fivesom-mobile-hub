import logo from "@/assets/fivesom-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="FIVESOM logo"
      className={cn("h-8 w-8 object-contain", className)}
      loading="eager"
    />
  );
}
