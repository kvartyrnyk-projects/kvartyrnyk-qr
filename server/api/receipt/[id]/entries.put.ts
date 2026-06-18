import { sql } from "~~/server/utils/db";
import { fetchReceipt } from "../upsert-for/[qr].post";
import type { UpdateEntriesBody, ReceiptResponse } from "~/types/receipt";

export default defineEventHandler(async (event): Promise<ReceiptResponse> => {
  const telegramUserId = event.context.telegramUserId as number;
  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  const [dbUser] = await sql<{ id: number; role: string }[]>`
    SELECT id, role FROM users WHERE telegram_id = ${telegramUserId}
  `;
  if (!dbUser) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
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

  const body = await readBody<UpdateEntriesBody>(event);
  const entries = body?.entries ?? [];

  for (const e of entries) {
    if (!Number.isInteger(e.product_id) || e.product_id < 1) {
      throw createError({ statusCode: 400, message: "Невірний product_id" });
    }
    if (!Number.isInteger(e.unit_count) || e.unit_count < 1) {
      throw createError({ statusCode: 400, message: "unit_count must be >= 1" });
    }
  }

  const [receipt] = await sql<{ status: string }[]>`
    SELECT status FROM receipts WHERE id = ${id}
  `;
  if (!receipt) {
    throw createError({ statusCode: 404, message: "Чек не знайдено" });
  }
  if (receipt.status !== "UNPAID") {
    throw createError({
      statusCode: 409,
      message: "Можна редагувати тільки неоплачений чек",
    });
  }

  await sql`DELETE FROM receipt_entries WHERE receipt_id = ${id}`;

  for (const entry of entries) {
    const [product] = await sql<{ price: number }[]>`
      SELECT price FROM products WHERE id = ${entry.product_id}
    `;
    if (!product) {
      throw createError({
        statusCode: 400,
        message: `Продукт ${entry.product_id} не знайдено`,
      });
    }
    await sql`
      INSERT INTO receipt_entries (receipt_id, product_id, unit_count, subtotal)
      VALUES (
        ${id},
        ${entry.product_id},
        ${entry.unit_count},
        ${entry.unit_count * Number(product.price)}
      )
    `;
  }

  await sql`
    UPDATE receipts
    SET total      = (SELECT COALESCE(SUM(subtotal), 0) FROM receipt_entries WHERE receipt_id = ${id}),
        updated_at = now()
    WHERE id = ${id}
  `;

  return fetchReceipt(id);
});
