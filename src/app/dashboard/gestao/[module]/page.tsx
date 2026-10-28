import { ManagementPage } from "@/components/operations/management-page";

export const instant = false;

export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  return <ManagementPage requested={module} surface="dashboard" />;
}
