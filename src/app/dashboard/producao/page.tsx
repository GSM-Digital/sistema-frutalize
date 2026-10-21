import { getAccess } from "@/lib/auth";
import { connection } from "next/server";
import { DataNotice } from "@/components/inventory/ui";
import { ProductionTerminal } from "@/components/production/terminal";
import { businessDateTime } from "@/lib/inventory/validation";

export const instant = false;

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ ordem?: string }>;
}) {
  await connection();
  const access = await getAccess();
  if (access.status !== "ready") return null;

  const [
    runsResult,
    inputsResult,
    variantsResult,
    locationsResult,
    membersResult,
  ] = await Promise.all([
    access.supabase
      .from("inventory_production_runs")
      .select("*")
      .eq("status", "in_progress")
      .order("workflow_phase", { ascending: false })
      .order("workflow_updated_at", { ascending: false })
      .order("id"),
    access.supabase
      .from("inventory_production_inputs")
      .select("*")
      .order("created_at")
      .order("id"),
    access.supabase
      .from("inventory_variants")
      .select("*")
      .eq("category_name", "Polpas prontas")
      .eq("active", true)
      .eq("product_active", true)
      .eq("category_active", true)
      .order("product_name")
      .order("name"),
    access.supabase
      .from("storage_locations")
      .select("*")
      .eq("active", true)
      .ilike("name", "Freezer %")
      .order("name"),
    access.supabase
      .from("staff_members")
      .select("user_id, display_name")
      .eq("active", true)
      .order("display_name"),
  ]);

  if (
    runsResult.error ||
    inputsResult.error ||
    variantsResult.error ||
    locationsResult.error ||
    membersResult.error
  )
    return <DataNotice />;

  const runs = runsResult.data.map((run) => ({
    ...run,
    inputs: inputsResult.data.filter(
      (input) => input.production_run_id === run.id,
    ),
  }));
  const { ordem } = await searchParams;

  return (
    <ProductionTerminal
      runs={runs}
      variants={variantsResult.data}
      locations={locationsResult.data}
      members={membersResult.data}
      currentMemberId={access.user.id}
      initialRunId={ordem}
      now={businessDateTime()}
      completionRequestId={crypto.randomUUID()}
    />
  );
}
