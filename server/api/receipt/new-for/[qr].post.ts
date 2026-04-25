import { sql } from "~~/server/utils/db";
import { isInRole } from "~~/server/utils/auth";
import { uuidRegex } from "~/utils/redirects";
import { fetchReceipt } from "../upsert-for/[qr].post";
import type { ReceiptResponse } from "~/types/receipt";

export default defineEventHandler(async (event): Promise<ReceiptResponse> => {
  await isInRole(event, ["BARTENDER", "SUDO"]);

  const qr = event.context.params?.qr;
  if (!qr || !uuidRegex.test(qr)) {
    throw createError({ statusCode: 400, message: "Невірний формат QR-коду" });
  }

  const [reg] = await sql<{ id: number }[]>`
    SELECT r.id
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.qr_token = ${qr}
      AND e.status NOT IN ('FINISHED', 'CANCELLED')
    LIMIT 1
  `;

  if (!reg) {
    throw createError({
      statusCode: 404,
      message: "Реєстрацію не знайдено або захід не активний",
    });
  }

  const [created] = await sql<{ id: number }[]>`
    INSERT INTO receipts (registration_id, status, total)
    VALUES (${reg.id}, 'UNPAID', 0)
    RETURNING id
  `;

  return fetchReceipt(created.id);
});
