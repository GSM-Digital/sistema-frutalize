import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";
import { changePassword } from "./actions";

export const instant = false;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const { erro } = await searchParams;
  return (
    <div className="account-page">
      <h1>Minha conta</h1>
      <section
        className="panel account-panel"
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
            <dt>Perfil</dt>
            <dd>Administrador</dd>
          </div>
        </dl>
        <p className="muted">
          Para alterar nome, e-mail ou perfil, solicite ao administrador em{" "}
          <Link className="text-link" href="/dashboard/gestao/staff">
            Equipe e acessos
          </Link>
          .
        </p>
      </section>
      <section
        className="panel account-panel"
        aria-labelledby="account-password"
      >
        <h2 id="account-password">Alterar senha</h2>
        <p className="muted">
          Use pelo menos 12 caracteres, com maiúscula, minúscula, número e
          símbolo. Você entrará novamente após salvar.
        </p>
        <form action={changePassword} className="account-password-form">
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
          {erro && (
            <p role="alert" className="account-error">
              {erro.slice(0, 200)}
            </p>
          )}
          <SubmitButton>Salvar nova senha</SubmitButton>
        </form>
      </section>
    </div>
  );
}
