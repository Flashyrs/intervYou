import Link from "next/link";

export function Footer() {
    return (
        <footer className="bg-white border-t py-4">
            <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-2 text-gray-500 text-sm">
                <p>&copy; {new Date().getFullYear()} IntervYou. All rights reserved.</p>
                <div className="flex gap-6">
                    <Link href="#" className="hover:text-gray-900">Privacy</Link>
                    <Link href="#" className="hover:text-gray-900">Terms</Link>
                    <Link href="https://github.com/Flashyrs/intervYou" className="hover:text-gray-900">GitHub</Link>
                </div>
            </div>
        </footer>
    );
}
