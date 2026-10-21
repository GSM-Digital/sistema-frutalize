export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section className="production-terminal-route">{children}</section>;
}
