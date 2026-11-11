"use server";

import { createClient } from "@/lib/supabase/server";
import {
  reportCategories,
  supportBucket,
  supportImageLimit,
  type SupportReport,
} from "@/lib/support/types";

const formats = {
  "image/png": {
    extension: "png",
    valid: (b: Uint8Array) =>
      [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => b[i] === byte),
  },
  "image/jpeg": {
    extension: "jpg",
    valid: (b: Uint8Array) => b[0] === 255 && b[1] === 216 && b[2] === 255,
  },
  "image/webp": {
    extension: "webp",
    valid: (b: Uint8Array) =>
      Buffer.from(b.subarray(0, 4)).toString() === "RIFF" &&
      Buffer.from(b.subarray(8, 12)).toString() === "WEBP",
  },
};

export async function sendReport(
  _: { error?: string; success?: boolean },
  form: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Entre novamente para enviar o relato." };
  const category = String(form.get("category")) as SupportReport["category"];
  const description = String(form.get("description") ?? "").trim();
  if (
    !Object.hasOwn(reportCategories, category) ||
    !description ||
    description.length > 4000
  )
    return { error: "Escolha um tipo de relato e escreva a descrição." };
  const path = form.get("source_path");
  const sourcePath =
    typeof path === "string" &&
    path.length <= 500 &&
    /^\/(dashboard|terminal|gestao|portal)(\/[a-zA-Z0-9_-]+)*\/?$/.test(path)
      ? path
      : null;
  const files = form
    .getAll("images")
    .filter((file): file is File => file instanceof File && file.size > 0);
  if (
    files.length > 5 ||
    files.reduce((total, file) => total + file.size, 0) > supportImageLimit
  )
    return { error: "Anexe até 5 imagens, somando no máximo 3,5 MB." };

  const images = [];
  for (const file of files) {
    const format = Object.hasOwn(formats, file.type)
      ? formats[file.type as keyof typeof formats]
      : undefined;
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!format || !format.valid(header))
      return { error: "Use imagens PNG, JPG ou WebP." };
    images.push({ file, extension: format.extension });
  }

  const id = crypto.randomUUID();
  const folder = `${user.id}/${id}`;
  const bucket = supabase.storage.from(supportBucket);
  const attachments: string[] = [];
  for (const { file, extension } of images) {
    const name = `${attachments.length + 1}.${extension}`;
    const { error } = await bucket.upload(`${folder}/${name}`, file, {
      contentType: file.type,
      cacheControl: "0",
    });
    if (error) {
      await bucket.remove(
        [...attachments, name].map((item) => `${folder}/${item}`),
      );
      return { error: "Não foi possível anexar as imagens. Tente novamente." };
    }
    attachments.push(name);
  }
  const { error } = await supabase.from("support_reports").insert({
    id,
    category,
    description,
    attachments,
    source_path: sourcePath,
  });
  if (error) {
    if (attachments.length)
      await bucket.remove(attachments.map((name) => `${folder}/${name}`));
    return { error: "Não foi possível confirmar o envio do relato." };
  }
  return { success: true };
}
