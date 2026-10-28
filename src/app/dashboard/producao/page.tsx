import { redirect } from "next/navigation";

export const instant = false;

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ ordem?: string }>;
}) {
  const { ordem } = await searchParams;
  redirect(ordem ? `/terminal?${new URLSearchParams({ ordem })}` : "/terminal");
}
