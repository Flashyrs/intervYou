import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">IntervYou</h1>
        <p className="mt-2 text-gray-600">Mock technical interviews made simple.</p>
        <div className="mt-6">
          <Link href="/dashboard" className="px-4 py-2 bg-black text-white rounded">Go to Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
