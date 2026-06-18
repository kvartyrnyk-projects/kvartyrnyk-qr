import { sql } from "~~/server/utils/db";
import { sendTelegramMessage } from "~~/server/utils/telegram";
import { generatePaymentLink } from "~~/server/utils/payment-link";

// Customer-initiated card payment. Always uses CARD — no method choice exposed to the customer.
// Accessible to USER (own receipt) or BARTENDER/SUDO (any receipt).
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
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

  const [row] = await sql<
    {
      status: string;
      total: number;
      telegram_id: bigint;
      receipt_payment_message: string | null;
    }[]
  >`
    SELECT
      r.status,
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
  if (row.status !== "UNPAID") {
    throw createError({
      statusCode: 409,
      message: "Оплатити можна тільки неоплачений чек",
    });
  }

  const totalHryvnia = Number(row.total) / 100;
  const link = await generatePaymentLink(totalHryvnia);
  const template = row.receipt_payment_message ?? "Сплати рахунок за бар і прикріпи скрін: {link}";
  const message = template
    .replace("{total}", totalHryvnia % 1 === 0 ? String(totalHryvnia) : totalHryvnia.toFixed(2))
    .replace("{link}", link);

  await sendTelegramMessage(row.telegram_id, message);

  await sql`
    UPDATE receipts
    SET status = 'AWAITING_PAYMENT', payment_method = 'CARD', updated_at = now()
    WHERE id = ${id}
  `;

  return { ok: true };
});
