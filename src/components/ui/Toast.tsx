import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

type Toast = { id: number; message: string };
const ToastCtx = createContext<{ show: (m: string) => void }>({ show: () => {} });
export const useToast = () => useContext(ToastCtx);

let nextId = 1;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className="pointer-events-auto flex animate-fade-up items-center gap-3 rounded-xl border border-line-strong bg-ink px-4 py-3 text-sm font-medium text-paper shadow-card-lg"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-danger" aria-hidden />
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
