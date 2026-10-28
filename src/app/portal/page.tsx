import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  SnapshotTables,
  type Snapshot,
} from "@/components/operations/workspace";
import { logout } from "@/app/dashboard/actions";

export const instant = false;
export default async function CustomerPortal() {
  await connection();
  if (!isSupabaseConfigured()) redirect("/login?retorno=/portal");
  const client = await createClient();
  const { data: user } = await client.auth.getUser();
  if (!user.user) redirect("/login?retorno=/portal");
  const { data, error } = await client.rpc("operations_snapshot", {
    p_module: "commercial",
  });
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Frutalize</p>
          <h1 className="text-3xl font-semibold">Meus pedidos</h1>
        </div>
        <form action={logout}>
          <button className="btn btn-secondary">Sair</button>
        </form>
      </header>
      {error || !data ? (
        <p role="alert" className="notice">
          Seu acesso ao portal ainda não foi vinculado a um cliente ativo.
          Contate a Frutalize.
        </p>
      ) : (
        <SnapshotTables
          snapshot={data as Snapshot}
          only={["orders", "lines", "shipments", "shipment_lines", "returns"]}
        />
      )}
    </main>
  );
}
