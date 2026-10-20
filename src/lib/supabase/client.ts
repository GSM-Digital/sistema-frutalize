import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/inventory/types";
import { supabaseConfig } from "./config";

export function createClient() {
  const { url, key } = supabaseConfig();
  return createBrowserClient<Database>(url, key);
}
