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
    !hasItems && "ao menos um item ativo",
    !hasSuppliers && "ao menos um fornecedor ativo",
    !hasLocations && "ao menos um local físico ativo",
  ].filter(Boolean) as string[];
  return (
    <>
      <PageHeading
        title="Novo recebimento"
        description="Registre a entrada, a conferência e o custo do material recebido."
      >
        <Link href="/dashboard/lotes" className="btn btn-secondary">
          Voltar ao estoque
        </Link>
      </PageHeading>
      <Panel
        title="Dados da entrada"
        description="Uma entrega pode incluir frutas, embalagens, uniformes, limpeza e outros itens."
      >
        <div className="p-5 sm:p-7">
          <ReceiptSetup options={options} />
          {missing.length > 0 && (
            <div className="notice">
              <h2 className="font-semibold">
                Falta preparar {missing.join(" e ")}
              </h2>
              <p className="muted mt-2 text-sm leading-6">
                Cadastre o item ou fornecedor acima. Os locais físicos da
                fábrica ficam configurados no sistema e indicam onde cada lote
                será guardado.
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
    </>
  );
}
