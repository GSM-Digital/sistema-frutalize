export const reportCategories = {
  problem: "Problema",
  suggestion: "Sugestão",
  other: "Outros",
} as const;

export const reportStatuses = {
  todo: "A fazer",
  in_progress: "Em andamento",
  done: "Concluído",
  discarded: "Descartado",
} as const;

export type SupportReport = {
  id: string;
  author_id: string;
  author_email: string;
  author_name: string | null;
  source_path: string | null;
  category: keyof typeof reportCategories;
  status: keyof typeof reportStatuses;
  description: string;
  attachments: string[];
  created_at: string;
};

export const supportBucket = "frutalize-support";
export const supportImageLimit = 3.5 * 1024 * 1024;
