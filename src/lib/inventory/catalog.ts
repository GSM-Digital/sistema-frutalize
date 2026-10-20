import type { CatalogEntity } from "./types";
export const catalogs = {
  produtos: {
    entity: "products",
    table: "products",
    title: "Itens de estoque",
    singular: "item",
    description:
      "Cadastre tudo o que entra na fábrica: frutas, embalagens, limpeza, uniformes e produtos prontos.",
  },
  apresentacoes: {
    entity: "variants",
    table: "item_variants",
    title: "Tamanhos e embalagens",
    singular: "variação",
    description:
      "Use somente quando tamanhos ou embalagens precisam ter saldos separados, como polpa de 500 g e 1 kg.",
  },
  fornecedores: {
    entity: "suppliers",
    table: "suppliers",
    title: "Fornecedores",
    singular: "fornecedor",
    description: "Contatos e identificação dos parceiros de fornecimento.",
  },
  locais: {
    entity: "locations",
    table: "storage_locations",
    title: "Locais de estoque",
    singular: "local",
    description: "Saiba em qual área ou freezer cada lote está armazenado.",
  },
  categorias: {
    entity: "categories",
    table: "categories",
    title: "Categorias",
    singular: "categoria",
    description: "Organize frutas, polpas, embalagens e os demais materiais.",
  },
} as const satisfies Record<
  string,
  {
    entity: CatalogEntity;
    table: string;
    title: string;
    singular: string;
    description: string;
  }
>;
export type CatalogSlug = keyof typeof catalogs;
export function isCatalogSlug(value: string): value is CatalogSlug {
  return Object.hasOwn(catalogs, value);
}
