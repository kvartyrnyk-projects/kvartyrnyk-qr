import { sql } from "~~/server/utils/db";
import { isInRole } from "~~/server/utils/auth";
import { uuidRegex } from "~/utils/redirects";
import type { ReceiptResponse } from "~/types/receipt";

export async function fetchReceipt(receiptId: number): Promise<ReceiptResponse> {
  const [receipt] = await sql<
    {
      id: number;
      status: string;
      total: number;
      payment_id: number | null;
      full_name: string;
      payment_file_id: string | null;
      payment_mimetype: string | null;
    }[]
  >`
    SELECT
      r.id,
      r.status,
      r.total,
      r.payment_id,
      u.full_name,
      pay.file_id  AS payment_file_id,
      pay.mimetype AS payment_mimetype
    FROM receipts r
    JOIN registrations reg ON r.registration_id = reg.id
    JOIN users u ON reg.user_id = u.id
    LEFT JOIN payments pay ON r.payment_id = pay.id
    WHERE r.id = ${receiptId}
  `;

  const entries = await sql<
    {
      product_id: number;
      product_name: string;
      unit: string;
      unit_price: number;
      unit_count: number;
      subtotal: number;
    }[]
  >`
    SELECT
      re.product_id,
      p.name  AS product_name,
      p.unit,
      p.price AS unit_price,
      re.unit_count,
      re.subtotal
    FROM receipt_entries re
    JOIN products p ON re.product_id = p.id
    WHERE re.receipt_id = ${receiptId}
  `;

  if (!receipt) {
    throw createError({ statusCode: 404, message: "Чек не знайдено" });
  }

  return {
    id: receipt.id,
    status: receipt.status as ReceiptResponse["status"],
    total: Number(receipt.total),
    guestName: receipt.full_name,
    paymentFileId: receipt.payment_file_id,
    paymentMimetype: receipt.payment_mimetype,
    entries: entries.map((e) => ({
      productId: e.product_id,
      productName: e.product_name,
      unit: e.unit,
      unitPrice: Number(e.unit_price),
      unitCount: e.unit_count,
      subtotal: Number(e.subtotal),
    })),
  };
}

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
      AND e.status = 'ONGOING'
    LIMIT 1
  `;

  if (!reg) {
    throw createError({
      statusCode: 404,
      message: "Реєстрацію не знайдено або захід не активний",
    });
  }

  // Return most recent receipt regardless of status; create UNPAID only if none exists
  const [existing] = await sql<{ id: number }[]>`
    SELECT id
    FROM receipts
    WHERE registration_id = ${reg.id}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  let receiptId: number;
  if (existing) {
    receiptId = existing.id;
  } else {
    const [created] = await sql<{ id: number }[]>`
      INSERT INTO receipts (registration_id, status, total)
      VALUES (${reg.id}, 'UNPAID', 0)
      RETURNING id
    `;
    receiptId = created.id;
  }

  return fetchReceipt(receiptId);
});
