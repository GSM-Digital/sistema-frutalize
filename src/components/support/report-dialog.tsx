"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { sendReport } from "@/app/suporte/relatar/actions";
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
  const confirmation = useRef<HTMLHeadingElement>(null);
  const [state, action, pending] = useActionState(sendReport, {});

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  useEffect(() => {
    if (!state.success) return;
    const element = dialog.current;
    confirmation.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => element?.close(), 9000);
    return () => window.clearTimeout(timer);
  }, [state.success]);

  return (
    <dialog
      ref={dialog}
      className="report-dialog panel"
      aria-labelledby="report-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (!state.success || event.target !== event.currentTarget) return;

        // The native backdrop also targets the dialog, as does its padding.
        const dialog = event.currentTarget;
        const { top, right, bottom, left } = dialog.getBoundingClientRect();
        if (
          event.clientX < left ||
          event.clientX > right ||
          event.clientY < top ||
          event.clientY > bottom
        ) {
          dialog.close();
        }
      }}
    >
      {state.success ? (
        <div className="report-confirmation">
          <h2 id="report-dialog-title" ref={confirmation} tabIndex={-1}>
            Obrigado pelo feedback!
          </h2>
          <p role="status">
            Em breve, alguém da equipe entrará em contato para dar retorno e, se
            for o caso, pedir que você teste novamente.
          </p>
        </div>
      ) : (
        <>
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
          <ReportForm
            sourcePath={sourcePath}
            action={action}
            pending={pending}
            error={state.error}
          />
        </>
      )}
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
