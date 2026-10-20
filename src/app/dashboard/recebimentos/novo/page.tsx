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
  const ready =
    options.variants.some(
      (x) => x.active && x.product_active && x.category_active,
    ) &&
    options.suppliers.some((x) => x.active) &&
    options.locations.some((x) => x.active);
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
        description="Campos com * são obrigatórios. Quantidades aceitam até três casas decimais."
      >
        <div className="p-5 sm:p-7">
          {ready ? (
            <ReceiptForm
              options={options}
              requestId={crypto.randomUUID()}
              now={businessDateTime()}
              today={businessDate()}
            />
          ) : (
            <div className="notice">
              <h2 className="font-semibold">
                Prepare os cadastros antes de receber
              </h2>
              <p className="muted mt-2 text-sm leading-6">
                É preciso ter produto, tamanho/embalagem, fornecedor e local
                ativos.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  className="btn btn-secondary"
                  href="/dashboard/cadastros/produtos?novo=1"
                >
                  Cadastrar produto
                </Link>
                <Link
                  className="btn btn-secondary"
                  href="/dashboard/cadastros/apresentacoes?novo=1"
                >
                  Cadastrar tamanho/embalagem
                </Link>
                <Link
                  className="btn btn-secondary"
                  href="/dashboard/cadastros/fornecedores?novo=1"
                >
                  Cadastrar fornecedor
                </Link>
                <Link
                  className="btn btn-secondary"
                  href="/dashboard/cadastros/locais"
                >
                  Consultar locais
                </Link>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
