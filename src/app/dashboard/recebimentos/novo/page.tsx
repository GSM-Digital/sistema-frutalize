import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { catalogOptions } from "@/lib/inventory/queries";
import { businessDate, businessDateTime } from "@/lib/inventory/validation";
import { ReceiptForm, ReceiptSetup } from "@/components/inventory/forms";
import { DataNotice, PageHeading, Panel } from "@/components/inventory/ui";
export const instant = false;
export default async function NewReceiptPage() {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const options = await catalogOptions(access.supabase).catch(() => null);
  if (!options) return <DataNotice />;
  const hasItems = options.variants.some(
    (x) =>
      x.active &&
      x.product_active &&
      x.category_active &&
      ((x.has_variants && !x.is_default) || (!x.has_variants && x.is_default)),
  );
  const hasSuppliers = options.suppliers.some((x) => x.active);
  const hasLocations = options.locations.some((x) => x.active);
  const missing = [
    !hasItems && "um item",
    !hasSuppliers && "um fornecedor",
    !hasLocations && "um local físico",
  ].filter(Boolean) as string[];
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
          <ReceiptSetup options={options} />
          {missing.length > 0 && (
            <div className="notice receipt-prerequisite" role="status">
              <h2>Cadastre {missing.join(" e ")} para continuar</h2>
              <p>
                Use os atalhos acima. Depois de salvar, os campos da entrega
                serão liberados automaticamente.
              </p>
            </div>
          )}
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
