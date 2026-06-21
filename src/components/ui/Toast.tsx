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
      <div className="fixed bottom-4 inset-x-0 flex flex-col items-center gap-2 z-50 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="bg-red-600 text-white text-sm rounded-lg px-4 py-2 shadow-lg">{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
