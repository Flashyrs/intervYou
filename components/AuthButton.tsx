"use client";
import { signIn, signOut, useSession } from "next-auth/react";

export function AuthButton() {
  const { data: session } = useSession();
  if (session) {
    return (
      <button className="px-3 py-2 bg-gray-200 rounded" onClick={() => signOut()}>Sign out</button>
    );
  }
  return (
    <button className="px-3 py-2 bg-black text-white rounded" onClick={() => signIn("google")}>Sign in with Google</button>
  );
}
