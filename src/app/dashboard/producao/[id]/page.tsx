import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/inventory/validation";

export const instant = false;

export default async function ProductionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  redirect(`/dashboard/producao?ordem=${id}`);
}
