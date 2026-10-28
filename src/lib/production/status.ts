const labels: Record<string, string> = {
  preparing: "Em preparação",
  configured: "Configurada",
  in_progress: "Em produção",
  paused: "Pausada",
  awaiting_review: "Aguardando conferência",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export function productionStatusLabel(status: string) {
  return labels[status] ?? status;
}
