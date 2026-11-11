import { getAccess } from "@/lib/auth";
import { EditForm } from "@/components/edit-form";
import {
  changePassword,
  requestAccountEmailChange,
  resetAccountPassword,
  saveAccountPhone,
  saveAccountProfile,
} from "./actions";

export const instant = false;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{
    erro?: string;
    enviado?: string;
    perfil?: string;
    telefone?: string;
    email?: string;
    email_confirmado?: string;
  }>;
}) {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const { erro, enviado, perfil, telefone, email, email_confirmado } =
    await searchParams;
  const phone =
    typeof access.user.user_metadata?.phone === "string"
      ? access.user.user_metadata.phone
      : "";
  const roleLabel =
    access.member.role === "admin"
      ? "Administrador"
      : access.member.role === "manager"
        ? "Gestor"
        : "Colaborador";
  return (
    <div className="account-page layout-stack">
      <h1>Minha conta</h1>
      <section
        className="panel panel-inset account-panel"
        aria-labelledby="account-details"
      >
        <h2 id="account-details">Dados da conta</h2>
        <dl className="account-details">
          <div>
            <dt>Nome</dt>
            <dd>{access.member.display_name}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{access.user.email ?? "Não informado"}</dd>
          </div>
          <div>
            <dt>Telefone</dt>
            <dd>{phone || "Não informado"}</dd>
          </div>
          <div>
            <dt>Perfil</dt>
            <dd>{roleLabel}</dd>
          </div>
        </dl>
        <details
          className="account-edit-details"
          open={Boolean(
            erro || perfil || telefone || email || email_confirmado,
          )}
        >
          <summary className="btn btn-secondary">Editar</summary>
          <div className="account-edit-content">
            {erro && (
              <p role="alert" className="account-error">
                {erro.slice(0, 200)}
              </p>
            )}
            {(perfil || telefone) && (
              <p role="status" className="account-success">
                Dados da conta atualizados.
              </p>
            )}
            {email_confirmado && (
              <p role="status" className="account-success">
                Confirmação recebida. Se o provedor solicitar duas confirmações,
                conclua também o link enviado ao outro endereço.
              </p>
            )}
            {email && (
              <p role="status" className="account-success">
                Confira os e-mails de confirmação para concluir a alteração do
                endereço.
              </p>
            )}
            <EditForm
              key={JSON.stringify([
                access.member.display_name,
                access.member.role,
              ])}
              initialValues={{
                display_name: access.member.display_name,
                role: access.member.role,
              }}
              action={saveAccountProfile}
              className="account-password-form"
              saveLabel="Salvar nome e perfil"
            >
              <label>
                Nome
                <input
                  name="display_name"
                  defaultValue={access.member.display_name}
                  minLength={2}
                  maxLength={120}
                  required
                />
              </label>
              <label>
                Perfil / permissões
                <select name="role" defaultValue={access.member.role} required>
                  <option value="admin">Administrador</option>
                  <option value="manager">Gestor</option>
                  <option value="collaborator">Colaborador</option>
                </select>
              </label>
              <p className="muted">
                Alterar seu perfil pode mudar imediatamente o acesso a esta
                área.
              </p>
            </EditForm>
            <EditForm
              key={phone}
              initialValues={{ phone }}
              action={saveAccountPhone}
              className="account-password-form"
              saveLabel="Salvar telefone"
            >
              <label>
                Telefone
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={phone}
                  maxLength={30}
                />
              </label>
            </EditForm>
            <EditForm
              key={access.user.email ?? ""}
              initialValues={{ email: access.user.email ?? "" }}
              saveLabel="Alterar e-mail"
              action={requestAccountEmailChange}
              className="account-password-form"
            >
              <label>
                E-mail
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={access.user.email ?? ""}
                  maxLength={254}
                  required
                />
              </label>
            </EditForm>
          </div>
        </details>
      </section>
      <section
        className="panel panel-inset account-panel"
        aria-label="Segurança da conta"
      >
        <details
          className="account-password-details"
          open={Boolean(erro || enviado)}
        >
          <summary className="btn btn-secondary account-password-toggle">
            Trocar senha
          </summary>
          <div className="account-password-content">
            <p className="muted">
              Use pelo menos 12 caracteres, com maiúscula, minúscula, número e
              símbolo. Você entrará novamente após salvar.
            </p>
            {enviado === "1" && (
              <p role="status" className="account-success">
                Solicitação enviada para {access.user.email}. Confira também a
                caixa de spam.
              </p>
            )}
            {erro && (
              <p role="alert" className="account-error">
                {erro.slice(0, 200)}
              </p>
            )}
            <EditForm
              initialValues={{ password: "" }}
              action={changePassword}
              className="account-password-form"
              saveLabel="Salvar nova senha"
            >
              <label>
                Senha atual
                <input
                  type="password"
                  name="current_password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                Nova senha
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <label>
                Repita a nova senha
                <input
                  type="password"
                  name="confirmation"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
            </EditForm>
            <form
              action={resetAccountPassword}
              className="account-recovery-form"
            >
              <button type="submit" className="account-recovery-link">
                Esqueci a senha
              </button>
            </form>
          </div>
        </details>
      </section>
    </div>
  );
}
