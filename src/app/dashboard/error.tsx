"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="notice" role="alert">
      <h1 className="text-xl font-semibold">
        Não foi possível carregar esta página
      </h1>
      <p className="muted my-4">
        Tente novamente. Se o problema continuar, avise o administrador.
      </p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Tentar novamente
      </button>
    </section>
  );
}
