export type SupabaseClientLike = {
  // Minimal interface so the rest of the app can type against it without hard-coupling.
  // When you install `@supabase/supabase-js`, you can replace this with the real client.
  from: (table: string) => unknown;
};

export function createSupabaseClient(): SupabaseClientLike {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  // Placeholder until you add the dependency:
  // import { createClient } from "@supabase/supabase-js";
  // return createClient(url, anonKey);
  throw new Error(
    "Supabase client not wired: install @supabase/supabase-js and replace createSupabaseClient() implementation.",
  );
}

