import { sql } from "~~/server/utils/db";
import type { ReceiptStatus, PaymentMethod } from "~/types/receipt";

interface ReceiptSummary {
  id: number;
  status: ReceiptStatus;
  paymentMethod: PaymentMethod | null;
  total: number;
  guestName: string;
  username: string | null;
  phone: string | null;
}

export default defineEventHandler(async (event): Promise<ReceiptSummary[]> => {
  const telegramUserId = event.context.telegramUserId as number;

  const [dbUser] = await sql<{ id: number; role: string }[]>`
    SELECT id, role FROM users WHERE telegram_id = ${telegramUserId}
  `;
  if (!dbUser) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }

  const isBartender = dbUser.role === "BARTENDER" || dbUser.role === "SUDO";

  if (isBartender) {
    const rows = await sql<{
      id: number;
      status: ReceiptStatus;
      paymentMethod: PaymentMethod | null;
      total: number;
      guestName: string;
      username: string | null;
      phone: string | null;
      qr: string;
    }[]>`
      SELECT
        r.id,
        r.status,
        r.payment_method AS "paymentMethod",
        r.total,
        u.full_name AS "guestName",
        u.username,
        u.phone,
        reg.qr_token AS qr
      FROM receipts r
      JOIN registrations reg ON r.registration_id = reg.id
      JOIN events e ON reg.event_id = e.id
      JOIN users u ON reg.user_id = u.id
      WHERE e.status NOT IN ('FINISHED', 'CANCELLED')
      ORDER BY r.updated_at DESC
    `;
    return rows.map(({ total, ...rest }) => ({
      total: Number(total),
      ...rest,
    }));
  }

  const rows = await sql<{
    id: number;
    status: ReceiptStatus;
    paymentMethod: PaymentMethod | null;
    total: number;
    guestName: string;
    qr: string;
    username: string | null;
    phone: string | null;
  }[]>`
    SELECT
      r.id,
      r.status,
      r.payment_method AS "paymentMethod",
      r.total,
      u.full_name AS "guestName",
      reg.qr_token AS qr,
      u.username,
      u.phone
    FROM receipts r
    JOIN registrations reg ON r.registration_id = reg.id
    JOIN events e ON reg.event_id = e.id
    JOIN users u ON reg.user_id = u.id
    WHERE reg.user_id = ${dbUser.id}
      AND e.status NOT IN ('FINISHED', 'CANCELLED')
    ORDER BY r.updated_at DESC
  `;
  return rows.map(({ total, ...rest }) => ({
    total: Number(total),
    ...rest,
  }));
});
