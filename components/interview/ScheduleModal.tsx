"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

interface ScheduleModalProps {
    onClose: () => void;
    onSuccess: (sessionId: string, link: string) => void;
}

export function ScheduleModal({ onClose, onSuccess }: ScheduleModalProps) {
    const [email, setEmail] = useState("");
    const [scheduleType, setScheduleType] = useState<"instant" | "scheduled">("instant");
    const [scheduledDateTime, setScheduledDateTime] = useState("");
    const [loading, setLoading] = useState(false);
    const { push } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload: any = { email };

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

    // Get minimum datetime (now)
    const getMinDateTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 15); // Minimum 15 minutes from now
        return now.toISOString().slice(0, 16);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
                <h2 className="text-2xl font-semibold mb-4">Schedule Interview</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email Input */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Invitee Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="email@example.com"
                            required
                            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-black outline-none"
                        />
                    </div>

                    {/* Schedule Type */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Interview Type</label>
                        <div className="flex gap-4">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="scheduleType"
                                    value="instant"
                                    checked={scheduleType === "instant"}
                                    onChange={() => setScheduleType("instant")}
                                    className="mr-2"
                                />
                                <span>Instant</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="scheduleType"
                                    value="scheduled"
                                    checked={scheduleType === "scheduled"}
                                    onChange={() => setScheduleType("scheduled")}
                                    className="mr-2"
                                />
                                <span>Scheduled</span>
                            </label>
                        </div>
                    </div>

                    {/* Date/Time Picker (only for scheduled) */}
                    {scheduleType === "scheduled" && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Schedule Date & Time (Your local timezone) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                value={scheduledDateTime}
                                onChange={(e) => setScheduledDateTime(e.target.value)}
                                min={getMinDateTime()}
                                required
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-black outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Minimum 15 minutes from now. Reminder will be sent 15 minutes before.
                            </p>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                        >
                            {loading ? "Sending..." : scheduleType === "instant" ? "Send Invite" : "Schedule"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
