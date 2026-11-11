import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ReportForm } from "./report-form";

export const instant = false;

export default async function ReportPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?retorno=/suporte/relatar");
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 sm:p-8">
      <Link className="text-link" href="/">
        Voltar ao sistema
      </Link>
      <h1 className="text-3xl font-semibold">Reportar problema</h1>
      <section className="panel p-5">
        <ReportForm />
      </section>
    </main>
  );
}
