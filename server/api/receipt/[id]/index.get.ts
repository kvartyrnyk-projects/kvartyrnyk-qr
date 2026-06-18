import { sql } from "~~/server/utils/db";
import { fetchReceipt } from "../upsert-for/[qr].post";
import type { ReceiptResponse } from "~/types/receipt";

export default defineEventHandler(async (event): Promise<ReceiptResponse> => {
  const telegramUserId = event.context.telegramUserId as number;

  const [dbUser] = await sql<{ id: number; role: string }[]>`
    SELECT id, role FROM users WHERE telegram_id = ${telegramUserId}
  `;
  if (!dbUser) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }

  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  const isBartender = dbUser.role === "BARTENDER" || dbUser.role === "SUDO";

  if (!isBartender) {
    const [ownership] = await sql<{ id: number }[]>`
      SELECT r.id
      FROM receipts r
      JOIN registrations reg ON r.registration_id = reg.id
      WHERE r.id = ${id} AND reg.user_id = ${dbUser.id}
      LIMIT 1
    `;
    if (!ownership) {
      throw createError({ statusCode: 403, message: "Доступ заборонено" });
    }
  }

  return fetchReceipt(id);
});
