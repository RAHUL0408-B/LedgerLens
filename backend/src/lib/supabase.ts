import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // In non-test environments, fail fast if Supabase is not configured
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      '[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Database operations will fail. Please set these in your .env file.'
    );
  }
}

/**
 * Server-side Supabase client using the service role key.
 * NEVER expose this client or the service role key to the frontend.
 */
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseServiceKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
