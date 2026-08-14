"use client";

import Link from "next/link";
import { Sparkles, Users, Code2, ArrowRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toast";

export default function HomePage() {
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSupportForm, setShowSupportForm] = useState(false);
  const { push } = useToast();

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: supportName,
          email: supportEmail,
          message: supportMessage,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        push({ message: data.message || "Thank you! Support ticket submitted.", type: "success" });
        setSupportName("");
        setSupportEmail("");
        setSupportMessage("");
      } else {
        push({ message: data.error || "Failed to submit issue report.", type: "error" });
      }
    } catch (err: any) {
      push({ message: err?.message || "An unexpected error occurred.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Simple Hero */}
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

      {/* P2P Focus & Support Section */}
      <section className="py-24 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 md:p-12 shadow-xl">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl mb-4">
                P2P Network Support & Feedback
              </h2>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base mb-6">
                IntervYou utilizes secure, direct <strong>Peer-to-Peer (P2P) WebRTC connection routing</strong> to deliver zero-latency typing sync and direct face-to-face video calling.
              </p>
              <button
                type="button"
                onClick={() => setShowSupportForm((prev) => !prev)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white hover:bg-gray-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
              >
                {showSupportForm ? "Hide Contact Form" : "Report Connection Issue"}
              </button>
            </div>

            {showSupportForm && (
              <div className="mt-10 border-t border-gray-100 pt-10 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="max-w-2xl mx-auto mb-8">
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-left text-xs md:text-sm text-amber-800 leading-relaxed">
                    <strong>Symmetric NAT / Firewall Warning (Scenario 1):</strong> Direct peer connections can sometimes fail to traverse strict VPNs, corporate firewalls, or school/university networks. If enough users report traversal issues, we will enable server-side LiveKit media relays. Please report your network setup details using the form below.
                  </div>
                </div>

                <form onSubmit={handleSupportSubmit} className="space-y-6 max-w-xl mx-auto">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={supportName}
                      onChange={(e) => setSupportName(e.target.value)}
                      placeholder="Your Name"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 focus:border-black focus:bg-white focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 focus:border-black focus:bg-white focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                      Issue Description & Network Setup
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Describe your issue. (e.g. video connection stuck on connecting behind university VPN)"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 focus:border-black focus:bg-white focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-400 font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-md"
                  >
                    {submitting ? "Submitting..." : "Submit Issue Report"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </section>
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
