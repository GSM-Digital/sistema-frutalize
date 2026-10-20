import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { catalogOptions } from "@/lib/inventory/queries";
import { businessDate, businessDateTime } from "@/lib/inventory/validation";
import { ReceiptForm } from "@/components/inventory/forms";
import { DataNotice, PageHeading, Panel } from "@/components/inventory/ui";
export const instant = false;
export default async function NewReceiptPage() {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const options = await catalogOptions(access.supabase).catch(() => null);
  if (!options) return <DataNotice />;
  return (
    <div className="receipt-page">
      <PageHeading
        title="Novo recebimento"
        description="Registre a entrada, a conferência e o custo do material recebido."
      >
        <Link
          href="/dashboard/lotes"
          className="btn btn-secondary mobile-back-link"
        >
          ← Voltar ao estoque
        </Link>
      </PageHeading>
      <Panel
        title="Comece pela entrega"
        description="Uma entrega pode incluir frutas, embalagens, uniformes, limpeza e outros itens."
      >
        <div className="receipt-panel-body">
          <ReceiptForm
            options={options}
            requestId={crypto.randomUUID()}
            now={businessDateTime()}
            today={businessDate()}
          />
        </div>
      </Panel>
    </div>
  );
}
