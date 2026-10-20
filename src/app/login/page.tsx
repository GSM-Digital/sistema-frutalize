import { login } from "./actions";

export const instant = false;

type LoginPageProps = {
  searchParams: Promise<{ erro?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { erro } = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden overflow-hidden bg-[#194d2e] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-sm font-semibold tracking-[0.18em] uppercase">
          <span className="grid size-10 place-items-center rounded-xl bg-white/12 text-xl" aria-hidden="true">F</span>
          Frutalize
        </div>
        <div className="max-w-xl">
          <p className="mb-5 text-sm font-semibold tracking-[0.22em] text-[#b9dabf] uppercase">Gestão integrada</p>
          <h1 className="text-5xl leading-[1.05] font-semibold tracking-[-0.04em]">Toda a operação da fábrica em um só lugar.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/70">Estoque, lotes, recebimentos e rastreabilidade com acesso seguro para a equipe Frutalize.</p>
        </div>
        <p className="text-sm text-white/45">Uso exclusivo de colaboradores autorizados.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-[#236b3c] text-lg font-bold text-white" aria-hidden="true">F</span>
            <span className="font-semibold tracking-tight">Sistema Frutalize</span>
          </div>

          <p className="text-sm font-semibold tracking-[0.16em] text-[#236b3c] uppercase">Acesso interno</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#172117]">Bem-vindo de volta</h2>
          <p className="mt-3 leading-7 text-[#667166]">Entre com o e-mail e a senha cadastrados pelo administrador.</p>

          <form action={login} className="mt-9 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#273327]">E-mail</span>
              <input className="h-12 w-full rounded-xl border border-[#d5ddd2] bg-white px-4 text-base text-[#172117] shadow-sm transition placeholder:text-[#9aa49a] hover:border-[#b7c4b5] focus:border-[#236b3c] focus:outline-none" name="email" type="email" autoComplete="email" inputMode="email" placeholder="voce@frutalize.com.br" required />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#273327]">Senha</span>
              <input className="h-12 w-full rounded-xl border border-[#d5ddd2] bg-white px-4 text-base text-[#172117] shadow-sm transition placeholder:text-[#9aa49a] hover:border-[#b7c4b5] focus:border-[#236b3c] focus:outline-none" name="password" type="password" autoComplete="current-password" placeholder="Digite sua senha" required />
            </label>

            {erro ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p> : null}

            <button className="flex h-12 w-full items-center justify-center rounded-xl bg-[#236b3c] px-5 font-semibold text-white shadow-[0_10px_25px_rgba(35,107,60,0.18)] transition hover:bg-[#194d2e] active:translate-y-px" type="submit">Entrar no sistema</button>
          </form>

          <p className="mt-7 text-center text-sm leading-6 text-[#788278]">Esqueceu a senha? Solicite a redefinição ao administrador.</p>
        </div>
      </section>
    </main>
  );
}
