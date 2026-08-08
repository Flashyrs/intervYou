import { signIn } from "next-auth/react";

export function AuthModal({ onClose }: { onClose: () => void }) {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4 text-gray-900 dark:text-gray-150">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sign in to join interview</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">You need to sign in with Google to access this interview session.</p>
                <div className="flex gap-2 justify-end">
                    <button className="px-3 py-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition" onClick={onClose}>Close</button>
                    <button className="px-3 py-2 rounded bg-black text-white dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-zinc-200 transition font-medium" onClick={() => signIn("google")}>Sign in with Google</button>
                </div>
            </div>
        </div>
    );
}
