"use client";

import { useActionState, useState } from "react";
import { reportCategories, supportImageLimit } from "@/lib/support/types";
import { SubmitButton } from "@/components/submit-button";
import { sendReport } from "./actions";

export function ReportForm() {
  const [state, action, pending] = useActionState(sendReport, {});
  const [fileError, setFileError] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("problem");

  if (state.success)
    return (
      <p role="status" className="form-success">
        Relato enviado para o Suporte.
      </p>
    );
  return (
    <form action={action} className="inventory-form space-y-4">
      <fieldset disabled={pending} className="space-y-4">
        <label className="field">
          Tipo de relato
          <select
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {Object.entries(reportCategories).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Descrição
          <textarea
            name="description"
            required
            rows={5}
            maxLength={4000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="field">
          Imagens (opcional)
          <input
            name="images"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            aria-describedby="support-image-limit"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setFileError(
                files.length > 5 ||
                  files.reduce((sum, file) => sum + file.size, 0) >
                    supportImageLimit
                  ? "A seleção passou do limite de imagens."
                  : "",
              );
            }}
          />
        </label>
        <p id="support-image-limit" className="muted text-sm">
          Até 5 imagens PNG, JPG ou WebP, com 3,5 MB no total.
        </p>
      </fieldset>
      {(fileError || state.error) && (
        <p role="alert" className="form-error">
          {fileError || state.error}
        </p>
      )}
      <fieldset disabled={Boolean(fileError) || pending}>
        <SubmitButton>Enviar relato</SubmitButton>
      </fieldset>
    </form>
  );
}
