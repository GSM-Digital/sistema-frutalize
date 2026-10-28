import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth";
import { isUuid } from "@/lib/inventory/validation";
import type { Json } from "@/lib/inventory/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getAccess();
  if (!isUuid(id) || access.status !== "ready") return new NextResponse("Acesso negado.", { status: 403 });
  const { data, error } = await access.supabase.rpc("operations_snapshot", { p_module: "receiving" });
  const snapshot = data as { attachments?: Record<string, Json>[] };
  const attachment = snapshot?.attachments?.find((row) => row.id === id);
  if (error || !attachment || typeof attachment.object_name !== "string") return new NextResponse("Documento indisponível.", { status: 404 });
  // Stream after fresh authorization instead of exposing a reusable public URL.
  const { data: file, error: downloadError } = await access.supabase.storage.from("frutalize-receipts").download(attachment.object_name);
  if (downloadError || !file) return new NextResponse("Documento indisponível.", { status: 404 });
  return new NextResponse(file, { headers: { "Content-Type": String(attachment.mime_type), "Content-Disposition": 'attachment; filename="documento-frutalize"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
