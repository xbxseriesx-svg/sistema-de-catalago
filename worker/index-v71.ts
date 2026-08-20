import worker from './index-v72';
import { handleAccountAuth } from './auth-account-v89';

type Env = {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  REMOTE_IMAGE_HMAC_SECRET?: string;
  SDM_BOOTSTRAP_TOKEN?: string;
  GOOGLE_CSE_API_KEY?: string;
  GOOGLE_CSE_CX?: string;
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const accountAuth = await handleAccountAuth(req, env);
    if (accountAuth) return accountAuth;
    return worker.fetch(req, env as any);
  },
};
