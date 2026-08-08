import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const supabase = config.supabaseUrl && config.serviceRoleKey
  ? createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
