"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

interface ScheduleModalProps {
    onClose: () => void;
    onSuccess: (sessionId: string, link: string) => void;
}

export function ScheduleModal({ onClose, onSuccess }: ScheduleModalProps) {
    const [email, setEmail] = useState("");
    const [inviteeName, setInviteeName] = useState("");
    const [scheduleType, setScheduleType] = useState<"instant" | "scheduled">("instant");
    const [scheduledDateTime, setScheduledDateTime] = useState("");
    const [loading, setLoading] = useState(false);
    const { push } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload: any = { email, inviteeName };

            if (scheduleType === "scheduled") {
                if (!scheduledDateTime) {
                    push({ message: "Please select a date and time", type: "error" });
                    setLoading(false);
                    return;
                }
                payload.scheduledFor = new Date(scheduledDateTime).toISOString();
                payload.isScheduled = true;
            }

            const res = await fetch("/api/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                push({ message: data?.error || "Failed to send invite", type: "error" });
            } else {
                push({
                    message: scheduleType === "scheduled"
                        ? "Interview scheduled and invitation sent"
                        : "Invitation sent",
                    type: "success"
                });
                onSuccess(data.id, data.link);
            }
        } catch (error) {
            push({ message: "Failed to send invite", type: "error" });
        } finally {
            setLoading(false);
        }
    };


    const getMinDateTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 15);
        return now.toISOString().slice(0, 16);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg max-w-md w-full p-6 shadow-xl text-gray-900 dark:text-gray-150">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Schedule Interview</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                            Invitee Name <span className="text-gray-400 dark:text-gray-500 text-xs">(Optional)</span>
                        </label>
                        <input
                            type="text"
                            value={inviteeName}
                            onChange={(e) => setInviteeName(e.target.value)}
                            placeholder="John Doe"
                            className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                            Invitee Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="email@example.com"
                            required
                            className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Interview Type</label>
                        <div className="flex gap-4">
                            <label className="flex items-center cursor-pointer text-sm text-gray-750 dark:text-gray-300">
                                <input
                                    type="radio"
                                    name="scheduleType"
                                    value="instant"
                                    checked={scheduleType === "instant"}
                                    onChange={() => setScheduleType("instant")}
                                    className="mr-2 accent-black dark:accent-white"
                                />
                                <span>Instant</span>
                            </label>
                            <label className="flex items-center cursor-pointer text-sm text-gray-750 dark:text-gray-300">
                                <input
                                    type="radio"
                                    name="scheduleType"
                                    value="scheduled"
                                    checked={scheduleType === "scheduled"}
                                    onChange={() => setScheduleType("scheduled")}
                                    className="mr-2 accent-black dark:accent-white"
                                />
                                <span>Scheduled</span>
                            </label>
                        </div>
                    </div>

                    {scheduleType === "scheduled" && (
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Schedule Date & Time (Your local timezone) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                value={scheduledDateTime}
                                onChange={(e) => setScheduledDateTime(e.target.value)}
                                min={getMinDateTime()}
                                required
                                className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Minimum 15 minutes from now.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-750 rounded-lg bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition disabled:opacity-50 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition disabled:opacity-50 font-medium"
                        >
                            {loading ? "Sending..." : scheduleType === "instant" ? "Start Instant" : "Schedule"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
