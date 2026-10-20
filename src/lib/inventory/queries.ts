import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogOptions, Database } from "./types";

// PostgREST caps response sizes. Paginate selectors too, avoiding silent loss
// of catalog options after the first thousand records.
async function readAll<Row>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: unknown }>,
) {
  const rows: Row[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetchPage(from, from + 499);
    if (error || !data) throw error ?? new Error("Consulta indisponível.");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function catalogOptions(
  client: SupabaseClient<Database>,
): Promise<CatalogOptions> {
  const [categories, products, variants, suppliers, locations] =
    await Promise.all([
      readAll((from, to) =>
        client
          .from("categories")
          .select("*")
          .order("name")
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        client
          .from("products")
          .select("*")
          .order("name")
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        client
          .from("inventory_variants")
          .select("*")
          .order("name")
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        client
          .from("suppliers")
          .select("*")
          .order("name")
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        client
          .from("storage_locations")
          .select("*")
          .order("name")
          .order("id")
          .range(from, to),
      ),
    ]);
  return { categories, products, variants, suppliers, locations };
}
