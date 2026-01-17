import Link from "next/link";
import { Sparkles, Users, Code2, Zap, ArrowRight, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Simple Hero (Preserved as requested) */}
      <section className="py-24 md:py-32 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 mb-6">
          IntervYou
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          Mock technical interviews made simple.
        </p>
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to ace the interview
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Powerful tools designed to mimic real-world technical assessment environments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Sparkles className="w-6 h-6 text-purple-600" />}
              title="AI Enhancements"
              description="Generate comprehensive test cases, edge scenarios, and optimize your code with one-click AI assistance."
            />
            <FeatureCard
              icon={<Users className="w-6 h-6 text-blue-600" />}
              title="Real-time Sync"
              description="Collaborate seamlessly with peers. Code typings, cursor movements, and execution results sync instantly."
            />
            <FeatureCard
              icon={<Code2 className="w-6 h-6 text-green-600" />}
              title="Multi-Language Support"
              description="Write and execute code in JavaScript, Java, and C++ with our robust, sandboxed execution environment."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Start practicing in seconds. No complex setup required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Connector Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gray-100 -z-10" />

            <Step
              number="1"
              title="Create Session"
              description="Start a new interview session from your dashboard. It takes less than a second."
            />
            <Step
              number="2"
              title="Invite Peer"
              description="Share the unique session link or invite via email to start collaborating in real-time."
            />
            <Step
              number="3"
              title="Code & Execute"
              description="Solve problems, run test cases, and get instant feedback on your solution."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t py-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} IntervYou. All rights reserved.</p>
          <div className="mt-4 flex justify-center gap-6">
            <Link href="#" className="hover:text-gray-900">Privacy</Link>
            <Link href="#" className="hover:text-gray-900">Terms</Link>
            <Link href="https://github.com/Flashyrs/intervYou" className="hover:text-gray-900">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function Step({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center text-center bg-white">
      <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center font-bold text-lg mb-6 ring-4 ring-white">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600">
        {description}
      </p>
    </div>
  );
}
