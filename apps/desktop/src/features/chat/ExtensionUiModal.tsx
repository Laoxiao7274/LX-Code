import { useEffect, useId, useRef } from "react";
import { useAppStore } from "../../lib/stores/app-store";
import { ExtensionUiRequestContent } from "./ExtensionUiRequestContent";
import { useExtensionUiResponse } from "./use-extension-ui-response";

const FOCUSABLE_SELECTOR =
  "button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function ExtensionUiModal() {
  const activeRequest = useAppStore((state) => state.extensionUiRequest);
  const request = activeRequest?.presentation === "inline" ? null : activeRequest;
  const controller = useExtensionUiResponse(request);
  const dialogRef = useRef<HTMLDivElement>(null);
  const wasSubmittingRef = useRef(false);
  const titleId = useId();
  const requestId = request?.requestId ?? null;

  useEffect(() => {
    if (!requestId) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      previousFocus?.focus();
    };
  }, [requestId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (controller.submitting) {
      dialog.focus();
    } else if (wasSubmittingRef.current && document.activeElement === dialog) {
      dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    }
    wasSubmittingRef.current = controller.submitting;
  }, [controller.submitting]);

  if (!request) return null;

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      void controller.respond("cancelled");
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const isConfirm = request.kind === "confirm";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: isConfirm
          ? "radial-gradient(circle at 50% 40%, rgba(47,122,214,0.10), rgba(0,0,0,0.45) 70%)"
          : "rgba(0,0,0,0.50)",
        backdropFilter: isConfirm ? "blur(6px)" : undefined,
        WebkitBackdropFilter: isConfirm ? "blur(6px)" : undefined,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={controller.submitting}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className={isConfirm
          ? "w-full max-w-sm overflow-hidden rounded-2xl border border-accent/20 bg-surface-raised/80 shadow-2xl shadow-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          : "max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface-raised p-5 shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        }
        style={isConfirm ? { backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } : undefined}
        data-extension-ui-surface="modal"
      >
        <ExtensionUiRequestContent
          request={request}
          controller={controller}
          titleId={titleId}
          variant="modal"
        />
      </div>
    </div>
  );
}
