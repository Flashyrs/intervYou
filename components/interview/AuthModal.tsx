import { signIn } from "next-auth/react";

export function AuthModal({ onClose }: { onClose: () => void }) {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
                <h2 className="text-lg font-semibold">Sign in to join interview</h2>
                <p className="text-sm text-gray-600">You need to sign in with Google to access this interview session.</p>
                <div className="flex gap-2 justify-end">
                    <button className="px-3 py-2 rounded border" onClick={onClose}>Close</button>
                    <button className="px-3 py-2 rounded bg-black text-white" onClick={() => signIn("google")}>Sign in with Google</button>
                </div>
            </div>
        </div>
    );
}
