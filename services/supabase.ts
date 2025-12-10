import { createClient } from '@supabase/supabase-js';

// Setup Supabase client
// Prefer environment variables (Vercel / .env.local). Fallbacks are only for local/dev.
const supabaseUrl =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env?.SUPABASE_URL) ||
  'https://muealqfayezomxcdijla.supabase.co';

const supabaseKey =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && process.env?.SUPABASE_ANON_KEY) ||
  'eyJhbGciOi...CI6MjA4MDE5MDk0MH0.lcZV3HhdNsODKdBcnViTUsCuPt0VXAFGwsHpO8fOWEM';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Utility to check if we have valid credentials to decide whether to use real API or Mock
export const isSupabaseConfigured = () => {
  // Check if we are using real credentials (not placeholders)
  return supabaseUrl.includes('supabase.co') && supabaseKey.length > 20;
};

// Helper to generate UUIDs in frontend if DB defaults are missing
export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
