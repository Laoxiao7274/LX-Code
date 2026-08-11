import { createContext, useContext, useState, type ReactNode } from "react";

type ToastState = { msg: string; type: "ok" | "err" } | null;
const Ctx = createContext<{
  show: (msg: string, type?: "ok" | "err") => void;
}>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const show = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg border px-4 py-2.5 text-sm shadow-lg transition ${
            toast.type === "ok"
              ? "border-emerald-200 bg-white text-emerald-700"
              : "border-red-200 bg-white text-red-700"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
