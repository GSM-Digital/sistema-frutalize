import { getAccess } from "@/lib/auth";
import { dateTime } from "@/lib/inventory/format";
import { listParams } from "@/lib/inventory/validation";
import { PageHeading, Pagination } from "@/components/inventory/ui";
import { EditForm } from "@/components/edit-form";
import {
  reportCategories,
  reportStatuses,
  supportBucket,
  type SupportReport,
} from "@/lib/support/types";
import { changeReportStatus } from "./actions";

const path = "/dashboard/suporte";
const imagePath = (report: SupportReport, name: string) =>
  `${report.author_id}/${report.id}/${name}`;

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    ordem?: string;
    pagina?: string;
    salvo?: string;
    erro?: string;
  }>;
}) {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const params = await searchParams;
  const status =
    params.status === "all"
      ? "all"
      : typeof params.status === "string" &&
          Object.hasOwn(reportStatuses, params.status)
        ? (params.status as SupportReport["status"])
        : "todo";
  const ascending = params.ordem === "asc";
  const { from, to, page } = listParams(params);
  const query = access.supabase
    .from("support_reports")
    .select("*", { count: "exact" });
  if (status !== "all") query.eq("status", status);
  const { data, error, count } = await query
    .order("created_at", { ascending })
    .order("id", { ascending })
    .range(from, to);
  const reports = data ?? [];
  const images = reports.flatMap((report) =>
    report.attachments.map((name) => imagePath(report, name)),
  );
  const signed = images.length
    ? await access.supabase.storage
        .from(supportBucket)
        .createSignedUrls(images, 600)
    : null;
  const links = new Map(
    signed?.data?.map((item) => [item.path, item.signedUrl]) ?? [],
  );

  return (
    <>
      <PageHeading title="Suporte" />
      <form
        method="get"
        className="filter-bar support-filters"
        aria-label="Filtrar relatos"
      >
        <label className="field">
          <span className="field-label">Situação</span>
          <select name="status" defaultValue={status}>
            <option value="all">Todas</option>
            {Object.entries(reportStatuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Data de envio</span>
          <select name="ordem" defaultValue={ascending ? "asc" : "desc"}>
            <option value="desc">Mais recentes primeiro</option>
            <option value="asc">Mais antigos primeiro</option>
          </select>
        </label>
        <button className="btn btn-secondary">Filtrar</button>
      </form>
      {params.salvo && (
        <p className="form-success" role="status">
          Situação atualizada.
        </p>
      )}
      {params.erro && (
        <p className="form-error" role="alert">
          Não foi possível atualizar a situação.
        </p>
      )}
      {error ? (
        <p className="notice" role="alert">
          Não foi possível consultar os relatos.
        </p>
      ) : (
        <section className="space-y-3" aria-label="Relatos recebidos">
          {reports.length === 0 && (
            <p className="panel p-5">Nenhum relato encontrado.</p>
          )}
          {reports.map((report) => (
            <article key={report.id} className="panel space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">
                  {reportCategories[report.category]}
                </h2>
                <span className="badge">{reportStatuses[report.status]}</span>
              </div>
              <p className="muted text-sm [overflow-wrap:anywhere]">
                <strong>
                  {report.author_name ||
                    report.author_email ||
                    "Usuário não identificado"}
                </strong>
                {report.author_name && report.author_email
                  ? ` · ${report.author_email}`
                  : ""}
                {" · "}
                {dateTime(report.created_at)}
              </p>
              <p className="muted text-sm [overflow-wrap:anywhere]">
                Página de origem: {report.source_path ?? "Não registrada"}
              </p>
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                {report.description}
              </p>
              {report.attachments.length > 0 && (
                <ul
                  aria-label="Imagens anexadas"
                  className="flex flex-wrap gap-3"
                >
                  {report.attachments.map((name, index) => {
                    const link = links.get(imagePath(report, name));
                    return (
                      <li key={name}>
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-link"
                          >
                            Imagem {index + 1}
                          </a>
                        ) : (
                          <span className="muted">
                            Imagem {index + 1} indisponível
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <EditForm
                key={report.status}
                action={changeReportStatus}
                className="support-status-form"
                initialValues={{ status: report.status }}
                saveLabel="Salvar situação"
              >
                <input type="hidden" name="id" value={report.id} />
                <input
                  type="hidden"
                  name="currentStatus"
                  value={report.status}
                />
                <input type="hidden" name="filterStatus" value={status} />
                <input
                  type="hidden"
                  name="order"
                  value={ascending ? "asc" : "desc"}
                />
                <input type="hidden" name="page" value={page} />
                <label className="field">
                  <span className="field-label">Alterar situação</span>
                  <select name="status" defaultValue={report.status}>
                    {Object.entries(reportStatuses).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </EditForm>
            </article>
          ))}
          {((count ?? 0) > 25 || page > 1) && (
            <Pagination
              count={count ?? 0}
              page={page}
              path={path}
              params={{ status, ordem: ascending ? "asc" : "desc" }}
            />
          )}
        </section>
      )}
    </>
  );
}
