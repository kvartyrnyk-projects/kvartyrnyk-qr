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
      message: "Запит оплати можна надіслати тільки для неоплаченого чеку",
    });
  }

  const link = generatePaymentLink(Number(row.total) / 100);
  const template = row.receipt_payment_message ?? "Сплати рахунок за бар і прикріпи скрін: {link}";
  const message = template.replace("{link}", link);

  await sendTelegramMessage(row.telegram_id, message);

  await sql`
    UPDATE receipts
    SET status = 'AWAITING_PAYMENT', updated_at = now()
    WHERE id = ${id}
  `;

  return { ok: true };
});
