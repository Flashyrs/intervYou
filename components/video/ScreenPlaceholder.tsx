import { Monitor } from "lucide-react";

export function ScreenPlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-white/60">
      <Monitor className="mb-3 h-8 w-8" />
      <p className="text-sm">No screen share is active right now.</p>
    </div>
  );
}
