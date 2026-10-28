import { connection } from "next/server";
import { requireStaff } from "@/lib/auth";
import { PageHeading, DataNotice } from "@/components/inventory/ui";
import { ProductionConfigurationPanel } from "@/components/production/configuration";
import type { ProductionConfiguration } from "@/lib/production/ui-types";

export const instant = false;

export default async function ProductionConfigurationPage() {
  await connection();
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc("production_admin_snapshot");
  if (error || !data || typeof data !== "object" || Array.isArray(data))
    return <DataNotice />;
  return (
    <>
      <PageHeading
        eyebrow="Produção e qualidade"
        title="Procedimentos e equipamentos"
        description="Versões aprovadas, parâmetros de máquina, regras de medição e calibração preservados por ordem."
      />
      <ProductionConfigurationPanel
        data={data as unknown as ProductionConfiguration}
      />
    </>
  );
}
