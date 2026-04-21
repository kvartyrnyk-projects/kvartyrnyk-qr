import { sql } from "~~/server/utils/db";
import { isInRole } from "~~/server/utils/auth";
import { sendTelegramMessage } from "~~/server/utils/telegram";
import { generatePaymentLink } from "~~/server/utils/payment-link";

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await isInRole(event, ["BARTENDER", "SUDO"]);

  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  const [row] = await sql<
    {
      status: string;
      payment_id: number | null;
      total: number;
      telegram_id: bigint;
      receipt_payment_message: string | null;
    }[]
  >`
    SELECT
      r.status,
      r.payment_id,
      r.total,
      u.telegram_id,
      e.receipt_payment_message
    FROM receipts r
    JOIN registrations reg ON r.registration_id = reg.id
    JOIN users u ON reg.user_id = u.id
    JOIN events e ON reg.event_id = e.id
    WHERE r.id = ${id}
    LIMIT 1
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

  await sql`UPDATE payments SET status = 'FAILED' WHERE id = ${row.payment_id}`;
  await sql`
    UPDATE receipts
    SET status = 'UNPAID', payment_id = NULL, updated_at = now()
    WHERE id = ${id}
  `;

  const link = generatePaymentLink(Number(row.total));
  const template = row.receipt_payment_message ?? "Сплати рахунок за бар: {link}";
  const message = template.replace("{link}", link);
  await sendTelegramMessage(row.telegram_id, message);

  return { ok: true };
});
