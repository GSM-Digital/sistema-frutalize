"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ReportForm } from "@/app/suporte/relatar/report-form";

const ReportDialogContext = createContext<
  ((trigger: HTMLButtonElement) => void) | null
>(null);

export function ReportDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  function openReport(button: HTMLButtonElement) {
    trigger.current = button;
    setSourcePath(window.location.pathname);
  }

  function closeReport() {
    setSourcePath(null);
    const previous = trigger.current;
    requestAnimationFrame(() => {
      if (
        previous?.isConnected &&
        previous.getClientRects().length &&
        !previous.closest("[inert]")
      ) {
        previous.focus();
      } else {
        document
          .querySelector<HTMLElement>(".mobile-nav-more:not([hidden])")
          ?.focus();
        if (document.activeElement === document.body)
          document.querySelector<HTMLElement>(".sidebar-toggle")?.focus();
      }
    });
  }

  return (
    <ReportDialogContext.Provider value={openReport}>
      {children}
      {sourcePath !== null && (
        <ReportDialog sourcePath={sourcePath} onClose={closeReport} />
      )}
    </ReportDialogContext.Provider>
  );
}

function ReportDialog({
  sourcePath,
  onClose,
}: {
  sourcePath: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="report-dialog panel"
      aria-labelledby="report-dialog-title"
      onClose={onClose}
    >
      <header className="report-dialog-header">
        <h2 id="report-dialog-title">Reportar problema</h2>
        <button
          type="button"
          className="receipt-picker-close"
          aria-label="Fechar relato"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
      </header>
      <ReportForm sourcePath={sourcePath} />
    </dialog>
  );
}

export function ReportTrigger({
  children,
  className,
  onOpen,
}: {
  children: React.ReactNode;
  className?: string;
  onOpen?: () => void;
}) {
  const openReport = useContext(ReportDialogContext);
  return (
    <button
      type="button"
      className={className}
      aria-label="Reportar problema"
      aria-haspopup="dialog"
      onClick={(event) => {
        openReport?.(event.currentTarget);
        onOpen?.();
      }}
    >
      {children}
    </button>
  );
}
