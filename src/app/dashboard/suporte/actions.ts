"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { isUuid } from "@/lib/inventory/validation";
import { reportStatuses, type SupportReport } from "@/lib/support/types";

export async function changeReportStatus(form: FormData) {
  const { supabase } = await requireStaff();
  const id = form.get("id");
  const status = String(form.get("status")) as SupportReport["status"];
  const filters = new URLSearchParams();
  const filterStatus = String(form.get("filterStatus"));
  if (Object.hasOwn(reportStatuses, filterStatus))
    filters.set("status", filterStatus);
  if (form.get("order") === "asc") filters.set("ordem", "asc");
  if (/^\d{1,6}$/.test(String(form.get("page"))))
    filters.set("pagina", String(form.get("page")));
  let updated = false;
  if (isUuid(id) && Object.hasOwn(reportStatuses, status)) {
    const { data, error } = await supabase
      .from("support_reports")
      .update({ status })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    updated = Boolean(data && !error);
  }
  filters.set(updated ? "salvo" : "erro", "1");
  revalidatePath("/dashboard/suporte");
  redirect(`/dashboard/suporte?${filters}`);
}
