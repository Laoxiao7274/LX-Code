import { useEffect, useState, type ReactNode } from "react";

// 极简 history 路由(不引 react-router,够用)
// 路径:/ 首页,/admin/* 管理后台
export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

export function navigate(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// 管理后台子路由:/admin, /admin/versions, /admin/settings ...
export function useAdminPath(base = "/admin") {
  const path = useRoute();
  if (!path.startsWith(base)) return null;
  const rest = path.slice(base.length).replace(/^\/+/, "");
  return rest; // "" | "versions" | "settings"
}

export function Link({
  to,
  children,
  className,
  onClick,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={to}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
        onClick?.();
      }}
      className={className}
    >
      {children}
    </a>
  );
}
