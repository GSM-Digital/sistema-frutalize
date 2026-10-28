import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// React cache deduplicates only within this request, never between users.
export const getProductionAccess = cache(async () => {
  if (!isSupabaseConfigured()) return { status: "configuration" as const };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?retorno=/terminal");
  const { data: member, error: membershipError } = await supabase
    .from("staff_members")
    .select("active, role, display_name")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (membershipError) return { status: "database" as const };
  if (!member?.active) return { status: "forbidden" as const };
  return { status: "ready" as const, supabase, user: data.user, member };
});

export const getAccess = cache(async () => {
  const access = await getProductionAccess();
  if (access.status !== "ready") return access;
  if (access.member.role !== "admin") return { status: "forbidden" as const };
  return access;
});

export async function requireProductionStaff() {
  const access = await getProductionAccess();
  if (access.status !== "ready") throw new Error("Acesso não autorizado.");
  return access;
}

export async function requireStaff() {
  const access = await getAccess();
  if (access.status !== "ready")
    throw new Error(
      "Seu acesso ao estoque ainda não foi liberado. Contate o administrador.",
    );
  return access;
}
