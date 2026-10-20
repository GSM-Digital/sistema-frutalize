import Link from "next/link";
import { Icon, type IconName } from "@/components/inventory/icon";
import { PageHeading } from "@/components/inventory/ui";

const catalogs: {
  title: string;
  description: string;
  href: string;
  icon: IconName;
  order: string;
}[] = [
  {
    title: "Produtos",
    description:
      "Cadastre frutas, polpas, embalagens, materiais e demais itens.",
    href: "/dashboard/cadastros/produtos",
    icon: "product",
    order: "1",
  },
  {
    title: "Tamanhos e embalagens",
    description: "Defina variações como polpa de 100 g, 500 g ou 1 kg.",
    href: "/dashboard/cadastros/apresentacoes",
    icon: "variant",
    order: "2",
  },
  {
    title: "Fornecedores",
    description: "Organize a identificação e os contatos de cada fornecedor.",
    href: "/dashboard/cadastros/fornecedores",
    icon: "supplier",
    order: "3",
  },
  {
    title: "Locais de estoque",
    description: "Configure áreas, estoques físicos e freezers da fábrica.",
    href: "/dashboard/cadastros/locais",
    icon: "location",
    order: "4",
  },
  {
    title: "Categorias",
    description: "Agrupe os itens para facilitar consultas e recebimentos.",
    href: "/dashboard/cadastros/categorias",
    icon: "category",
    order: "5",
  },
];

export default function CatalogsPage() {
  return (
    <>
      <PageHeading
        eyebrow="Controle"
        title="Cadastros da operação"
        description="Prepare as informações usadas no recebimento, no estoque e nos próximos módulos."
      />
      <section className="catalog-hub" aria-label="Tipos de cadastro">
        {catalogs.map((catalog) => (
          <Link
            className="catalog-hub-card"
            href={catalog.href}
            key={catalog.href}
          >
            <div className="catalog-hub-order" aria-hidden="true">
              {catalog.order.padStart(2, "0")}
            </div>
            <span className="module-card-icon" aria-hidden="true">
              <Icon name={catalog.icon} size={24} />
            </span>
            <div>
              <h2>{catalog.title}</h2>
              <p>{catalog.description}</p>
            </div>
            <span className="catalog-hub-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </section>
      <aside className="catalog-flow-note">
        <span className="badge badge-green">Ordem recomendada</span>
        <p>
          Para o primeiro recebimento, comece por produto e tamanho/embalagem.
          Depois, confirme o fornecedor e o local onde o lote ficará armazenado.
        </p>
        <Link className="text-link" href="/dashboard/recebimentos/novo">
          Ir para recebimento →
        </Link>
      </aside>
    </>
  );
}
