import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser-side client (anon key) — safe for realtime subscriptions on public pages
export const createBrowserClient = () =>
    createClient(supabaseUrl, supabaseAnonKey);
