import { ToastProvider } from "./components/Toast";
import { useRoute } from "./router";
import { HomePage } from "./pages/Home";
import { AdminApp } from "./pages/admin/AdminApp";

export function App() {
  const path = useRoute();
  return (
    <ToastProvider>
      {path.startsWith("/admin") ? <AdminApp /> : <HomePage />}
    </ToastProvider>
  );
}
