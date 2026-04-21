import { sql } from "~~/server/utils/db";
import { isInRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await isInRole(event, ["BARTENDER", "SUDO"]);

  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  const [row] = await sql<{ status: string; payment_id: number | null }[]>`
    SELECT status, payment_id FROM receipts WHERE id = ${id}
  `;

  if (!row) {
    throw createError({ statusCode: 404, message: "Чек не знайдено" });
  }
  if (row.status !== "AWAITING_PAYMENT" || !row.payment_id) {
    throw createError({
      statusCode: 409,
      message: "Чек не очікує підтвердження оплати",
    });
  }

  await sql`UPDATE payments SET status = 'CONFIRMED' WHERE id = ${row.payment_id}`;
  await sql`UPDATE receipts SET status = 'PAID', updated_at = now() WHERE id = ${id}`;

  return { ok: true };
});
