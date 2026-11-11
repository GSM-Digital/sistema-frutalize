export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div data-terminal-page>{children}</div>;
}
