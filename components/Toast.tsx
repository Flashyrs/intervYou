"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: string; message: string; type?: "info" | "error" | "success" };

type ToastCtx = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = useCallback((id: string) => setToasts((a) => a.filter((t) => t.id !== id)), []);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((a) => [...a, { id, ...t }]);
    setTimeout(() => remove(id), 3000);
  }, [remove]);
  const value = useMemo(() => ({ toasts, push, remove }), [toasts, push, remove]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div key={t.id} className={`px-3 py-2 rounded shadow text-white ${
            t.type === "error" ? "bg-black" : t.type === "success" ? "bg-black" : "bg-black"
          }`}>{t.message}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx;
}
