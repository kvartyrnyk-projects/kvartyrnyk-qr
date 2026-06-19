import { sql } from "~~/server/utils/db";
import { getCurrentUser } from "~~/server/utils/auth";
import { findOrCreateUnpaidReceipt } from "~~/server/utils/receipt";
import { fetchReceipt } from "./upsert-for/[qr].post";
import type { ReceiptResponse } from "~/types/receipt";

export default defineEventHandler(async (event): Promise<ReceiptResponse> => {
  const dbUser = await getCurrentUser(event);

  // Find the most relevant active event, mirroring findCurrentEvent() priority:
  // ONGOING first (event is happening), then REGISTRATION_OPEN, then REGISTRATION_CLOSED.
  // DRAFT, FINISHED, and CANCELLED are excluded.
  const [activeEvent] = await sql<{ id: number }[]>`
    SELECT id FROM events
    WHERE status NOT IN ('DRAFT', 'FINISHED', 'CANCELLED')
    ORDER BY
      CASE status
        WHEN 'ONGOING' THEN 1
        WHEN 'REGISTRATION_OPEN' THEN 2
        WHEN 'REGISTRATION_CLOSED' THEN 3
        ELSE 4
      END,
      starts_at ASC
    LIMIT 1
  `;
  if (!activeEvent) {
    throw createError({ statusCode: 404, message: "Немає активної події" });
  }

  const [registration] = await sql<{ id: number }[]>`
    SELECT id FROM registrations
    WHERE user_id = ${dbUser.id} AND event_id = ${activeEvent.id}
    LIMIT 1
  `;
  if (!registration) {
    throw createError({
      statusCode: 404,
      message: "Вас не зареєстровано на поточну подію",
    });
  }

  // If a payment is already awaiting confirmation, return that receipt so the
  // caller can redirect the customer to the receipt view instead of creating a
  // new order on top of an in-flight payment.
  const [awaiting] = await sql<{ id: number }[]>`
    SELECT id FROM receipts
    WHERE registration_id = ${registration.id} AND status = 'AWAITING_PAYMENT'
    LIMIT 1
  `;
  if (awaiting) return fetchReceipt(awaiting.id);

  const receiptId = await findOrCreateUnpaidReceipt(registration.id);
  return fetchReceipt(receiptId);
});
