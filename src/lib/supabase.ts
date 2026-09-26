import { createClient } from "@supabase/supabase-js";

export let activeSupabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "https://gvbsigeuyjlvwcueonmg.supabase.co";
export let activeSupabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YnNpZ2V1eWpsdndjdWVvbm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MTcxNzAsImV4cCI6MjEwMzk5MzE3MH0.nTq55NyBPEAogBN7VPCxNvok6J7JdXGzlDIhH87okUU";

let supabaseInstance: any = null;

function isPlaceholder(val: string): boolean {
  if (!val) return true;
  const lower = val.toLowerCase().trim();
  return (
    lower.includes("sua_chave") ||
    lower.includes("xxxxx") ||
    lower.includes("seu_token") ||
    lower.includes("placeholder")
  );
}

if (!activeSupabaseUrl || !activeSupabaseAnonKey || isPlaceholder(activeSupabaseUrl) || isPlaceholder(activeSupabaseAnonKey)) {
  console.warn(
    "⚠️ Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are unconfigured or placeholders. " +
    "Please configure them in the Environment tab or .env file."
  );
  
  // Provide a safe mock so the app doesn't crash on startup
  supabaseInstance = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ data: { user: null }, error: new Error("Supabase URL or Key is missing") }),
      signUp: async () => ({ data: { user: null }, error: new Error("Supabase URL or Key is missing") }),
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
          then: (cb: any) => cb({ data: [], error: null })
        }),
        then: (cb: any) => cb({ data: [], error: null })
      }),
      insert: () => Promise.resolve({ data: null, error: new Error("Supabase URL or Key is missing") }),
      update: () => Promise.resolve({ data: null, error: new Error("Supabase URL or Key is missing") }),
      delete: () => Promise.resolve({ data: null, error: new Error("Supabase URL or Key is missing") }),
    })
  };
} else {
  try {
    supabaseInstance = createClient(activeSupabaseUrl, activeSupabaseAnonKey);
    console.log("⚡ Supabase client initialized successfully!");
  } catch (err) {
    console.error("❌ Failed to initialize Supabase client:", err);
  }
}

export let supabase = supabaseInstance;

export function updateSupabaseClient(url: string, key: string) {
  if (!url || !key) return false;
  try {
    supabase = createClient(url, key);
    activeSupabaseUrl = url;
    activeSupabaseAnonKey = key;
    console.log("⚡ Supabase client dynamically updated with backend credentials!");
    return true;
  } catch (err) {
    console.error("❌ Failed to dynamically update Supabase client:", err);
    return false;
  }
}

export default supabase;
