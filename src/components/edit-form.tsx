"use client";

import { useState } from "react";
import { SubmitButton } from "./submit-button";

export function EditForm({
  initialValues,
  action,
  className,
  saveLabel,
  pending,
  children,
  cancel,
}: {
  initialValues?: Record<string, string>;
  action: (data: FormData) => void | Promise<void>;
  className?: string;
  saveLabel: string;
  pending?: boolean;
  children: React.ReactNode;
  cancel?: React.ReactNode;
}) {
  const [changed, setChanged] = useState(false);
  const showSave = !initialValues || changed;

  function checkChanges(form: HTMLFormElement) {
    if (!initialValues) return;
    const data = new FormData(form);
    setChanged(
      Object.entries(initialValues).some(([name, original]) => {
        const value = data.get(name);
        return typeof value === "string" && value.trim() !== original.trim();
      }),
    );
  }

  return (
    <form
      action={action}
      className={className}
      onChange={(event) => checkChanges(event.currentTarget)}
      onReset={(event) => {
        const form = event.currentTarget;
        requestAnimationFrame(() => {
          if (form.isConnected) checkChanges(form);
        });
      }}
      onSubmit={(event) => {
        if (!showSave) event.preventDefault();
      }}
    >
      {children}
      {(showSave || cancel) && (
        <div className="edit-form-actions">
          {showSave && (
            <SubmitButton disabled={pending}>{saveLabel}</SubmitButton>
          )}
          {cancel}
        </div>
      )}
    </form>
  );
}
