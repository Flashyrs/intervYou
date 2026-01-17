import Link from "next/link";
import Image from "next/image";
import { AuthButton } from "./AuthButton";

export function Navbar() {
  return (
    <nav className="w-full border-b bg-white">
      <div className="w-full px-2 md:px-4 py-2 md:py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-base md:text-lg">
          <Image src="/logo.svg" alt="IntervYou Logo" width={24} height={24} className="w-5 h-5 md:w-6 md:h-6" />
          <span>IntervYou</span>
        </Link>
        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/dashboard" className="text-xs md:text-sm text-gray-600 hover:text-gray-900 hidden sm:block">Dashboard</Link>
          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
