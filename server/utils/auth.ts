import type { H3Event } from "h3";
import { sql } from "~~/server/utils/db";

export interface DbUser {
  id: number;
  telegram_id: number;
  role: string;
  full_name: string;
}

/**
 * Resolves the authenticated user from the request's Telegram identity.
 * Throws 403 if no matching user row exists.
 */
export async function getCurrentUser(event: H3Event): Promise<DbUser> {
  const telegramUserId = event.context.telegramUserId as number;
  const [dbUser] = await sql<DbUser[]>`
    SELECT id, telegram_id, role, full_name
    FROM users
    WHERE telegram_id = ${telegramUserId}
  `;
  if (!dbUser) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }
  return dbUser;
}

export async function isInRole(event: H3Event, roles: string[]): Promise<DbUser> {
  const dbUser = await getCurrentUser(event);
  if (!roles.includes(dbUser.role)) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }
  return dbUser;
}

/** Staff roles that may act on any receipt regardless of ownership. */
export function isBartender(user: Pick<DbUser, "role">): boolean {
  return user.role === "BARTENDER" || user.role === "SUDO";
}

/**
 * Ensures the user may act on the given receipt. Bartenders/SUDO bypass the
 * ownership check; everyone else must own the receipt via their registration.
 * Throws 403 otherwise.
 */
export async function assertReceiptOwnership(
  receiptId: number,
  dbUser: DbUser,
): Promise<void> {
  if (isBartender(dbUser)) return;

  const [ownership] = await sql<{ id: number }[]>`
    SELECT r.id
    FROM receipts r
    JOIN registrations reg ON r.registration_id = reg.id
    WHERE r.id = ${receiptId} AND reg.user_id = ${dbUser.id}
    LIMIT 1
  `;
  if (!ownership) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }
}
