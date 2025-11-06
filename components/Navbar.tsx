import Link from "next/link";
import { AuthButton } from "./AuthButton";

export function Navbar() {
  return (
    <nav className="w-full border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold">IntervYou</Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-600">Dashboard</Link>
          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
