"use client";

import { useState } from "react";
import { reportCategories, supportImageLimit } from "@/lib/support/types";
import { SubmitButton } from "@/components/submit-button";

export function ReportForm({
  sourcePath,
  action,
  pending,
  error,
}: {
  sourcePath: string;
  action: (data: FormData) => void;
  pending: boolean;
  error?: string;
}) {
  const [fileError, setFileError] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("problem");

  return (
    <form action={action} className="inventory-form report-form">
      <input type="hidden" name="source_path" value={sourcePath} />
      <fieldset disabled={pending} className="report-fields">
        <label className="field">
          <span className="field-label">Tipo de relato</span>
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
          <span className="field-label">Descrição</span>
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
          <span className="field-label">Imagens (opcional)</span>
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
          <span id="support-image-limit" className="report-field-help muted">
            Até 5 imagens PNG, JPG ou WebP, com 3,5 MB no total.
          </span>
        </label>
      </fieldset>
      {(fileError || error) && (
        <p role="alert" className="form-error">
          {fileError || error}
        </p>
      )}
      <fieldset disabled={!description.trim() || Boolean(fileError) || pending}>
        <SubmitButton>Enviar relato</SubmitButton>
      </fieldset>
    </form>
  );
}
