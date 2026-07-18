"use client";

import Link from "next/link";
import Image from "next/image";
import { AuthButton } from "./AuthButton";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function Navbar() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="w-full border-b bg-white">
      <div className="w-full px-2 md:px-4 py-2 md:py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-base md:text-lg">
          <Image src="/logo.svg" alt="IntervYou Logo" width={24} height={24} className="w-5 h-5 md:w-6 md:h-6" />
          <span>IntervYou</span>
        </Link>
        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/dashboard" className="text-xs md:text-sm text-gray-600 hover:text-gray-900 hidden sm:block">Dashboard</Link>
          
          {mounted ? (
            <button
              onClick={toggleTheme}
              className="p-1.5 md:p-2 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-neutral-900 transition-colors focus:outline-none"
              aria-label="Toggle theme"
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 md:w-5 md:h-5 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 md:w-5 md:h-5 transition-transform hover:-rotate-12" />
              )}
            </button>
          ) : (
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg" />
          )}

          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
