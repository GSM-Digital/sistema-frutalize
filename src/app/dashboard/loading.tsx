export default function Loading() {
  return (
    <div className="space-y-5" role="status">
      <p className="muted">Carregando dados da operação…</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-36 animate-pulse rounded-2xl bg-white border border-[#dfe6dc]"
          />
        ))}
      </div>
    </div>
  );
}
