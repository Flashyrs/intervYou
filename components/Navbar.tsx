import Link from "next/link";
import { AuthButton } from "./AuthButton";

export function Navbar() {
  return (
    <nav className="w-full border-b bg-white">
      <div className="mx-auto max-w-6xl px-2 md:px-4 py-2 md:py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-base md:text-lg">IntervYou</Link>
        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/dashboard" className="text-xs md:text-sm text-gray-600 hidden sm:block">Dashboard</Link>
          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
