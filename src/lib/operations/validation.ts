import type { Json } from "@/lib/inventory/types";
import { isUuid, ValidationError } from "@/lib/inventory/validation";
import { operationForms, type Field } from "./forms";
import { operationsModules, type OperationsModule } from "./types";

export function parseOperation(form: FormData) {
  const module = form.get("module") as OperationsModule;
  if (!operationsModules.includes(module)) throw new ValidationError("Módulo inválido.");
  const action = String(form.get("action"));
  const definition = operationForms[module].find((item) => item.action === action);
  if (!definition) throw new ValidationError("Operação inválida.");
  const commandId = form.get("command_id");
  if (!isUuid(commandId)) throw new ValidationError("Identificação da operação inválida. Atualize a página.");
  function parse(fields: Field[], prefix = ""): Record<string, Json> {
    const result: Record<string, Json> = {};
    for (const item of fields) {
      const name = `${prefix}${item.name}`;
      if (item.fields) {
        const count = Number(form.get(`${name}.__count`));
        if (!Number.isInteger(count) || count < 1 || count > 100) throw new ValidationError("Informe de 1 a 100 itens.");
        result[item.name] = Array.from({ length: count }, (_, index) => parse(item.fields!, `${name}.${index}.`));
        continue;
      }
      if (item.type === "checkbox") { result[item.name] = form.get(name) === "on"; continue; }
      const raw = form.get(name);
      if (raw !== null && typeof raw !== "string") throw new ValidationError("Campo inválido.");
      const value = String(raw ?? "").trim();
      if (!value && item.optional) continue;
      if (!value || value.length > 2000) throw new ValidationError(`Confira o campo ${item.label}.`);
      if (item.options && !item.options.some(([key]) => key === value)) throw new ValidationError(`Selecione ${item.label}.`);
      if ((item.source || item.name === "source_id" || item.name === "user_id") && !isUuid(value)) throw new ValidationError(`Selecione ${item.label}.`);
      if (item.type === "number") {
        const decimal = value.replace(",", ".");
        if (!/^-?\d+(\.\d{1,6})?$/.test(decimal) || !Number.isFinite(Number(decimal)) || Math.abs(Number(decimal)) > 999999999) throw new ValidationError(`Valor inválido: ${item.label}.`);
        result[item.name] = decimal;
      } else if (item.type === "datetime-local") {
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}:00-03:00`))) throw new ValidationError("Data e hora inválidas.");
        result[item.name] = `${value}:00-03:00`;
      } else result[item.name] = value;
    }
    return result;
  }
  const payload = parse(definition.fields);
  if (definition.critical && form.get("confirm") !== "on") throw new ValidationError("Confirme a operação após conferir os dados.");
  if (JSON.stringify(payload).length > 60000) throw new ValidationError("Operação acima do limite permitido.");
  return { module, action, commandId, payload };
}
