export type Env = {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  REMOTE_IMAGE_HMAC_SECRET?: string;
  SDM_BOOTSTRAP_TOKEN?: string;
  GOOGLE_CSE_API_KEY?: string;
  GOOGLE_CSE_CX?: string;
};

export const COMPANY_ID = 'cmp_asteryon';
export const ACCESS_COOKIE = '__Host-asteryon_access';
export const REFRESH_COOKIE = '__Host-asteryon_refresh';
