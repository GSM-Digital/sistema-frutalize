export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(
    url &&
    key &&
    /^https?:\/\//.test(url) &&
    !url.includes("seu-projeto") &&
    !key.includes("substitua_aqui"),
  );
}

export function supabaseConfig() {
  if (!isSupabaseConfigured())
    throw new Error("Configure as variáveis de ambiente do Supabase.");
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
}
