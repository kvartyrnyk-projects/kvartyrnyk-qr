import type { parse } from "@tma.js/init-data-node";

export interface AuthContext {
  telegramUser: ReturnType<typeof parse>;
  dbUser: {
    id: number;
    telegram_id: number;
    role: string;
    full_name: string;
  };
}

declare module "h3" {
  interface H3EventContext {
    auth?: AuthContext;
  }
}
