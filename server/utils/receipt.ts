import { sql } from "~~/server/utils/db";

// Finds the existing UNPAID receipt for a registration, or creates a new one.
// Only UNPAID counts as "open" — AWAITING_PAYMENT/PAID/CANCELLED receipts are not reused.
// The partial unique index receipts_one_unpaid_per_registration enforces at-most-one UNPAID
// per registration at the DB level, so concurrent inserts are safe.
export async function findOrCreateUnpaidReceipt(registrationId: number): Promise<number> {
  const [existing] = await sql<{ id: number }[]>`
    SELECT id FROM receipts
    WHERE registration_id = ${registrationId} AND status = 'UNPAID'
    LIMIT 1
  `;
  if (existing) return existing.id;

  const [created] = await sql<{ id: number }[]>`
    INSERT INTO receipts (registration_id, status, total)
    VALUES (${registrationId}, 'UNPAID', 0)
    RETURNING id
  `;
  return created.id;
}
