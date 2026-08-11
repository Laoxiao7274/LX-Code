import logoUrl from "../assets/lx-logo.png";

export function LxMark({ className = "" }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="LXCode"
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
      draggable={false}
    />
  );
}
