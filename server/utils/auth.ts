import type { H3Event } from "h3";
import { sql } from "~~/server/utils/db";

export interface DbUser {
  id: number;
  telegram_id: number;
  role: string;
  full_name: string;
}

export async function isInRole(event: H3Event, roles: string[]): Promise<DbUser> {
  const telegramUserId = event.context.telegramUserId as number;
  const [dbUser] = await sql<DbUser[]>`
    SELECT id, telegram_id, role, full_name
    FROM users
    WHERE telegram_id = ${telegramUserId}
  `;
  if (!dbUser || !roles.includes(dbUser.role)) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }
  return dbUser;
}
