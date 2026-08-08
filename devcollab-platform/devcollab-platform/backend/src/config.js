import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 5000),
  supabaseUrl: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  sentryDsn: process.env.SENTRY_DSN || ''
};
