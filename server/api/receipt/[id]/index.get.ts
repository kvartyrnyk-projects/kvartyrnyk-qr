import { getCurrentUser, assertReceiptOwnership } from "~~/server/utils/auth";
import { fetchReceipt } from "../upsert-for/[qr].post";
import type { ReceiptResponse } from "~/types/receipt";

export default defineEventHandler(async (event): Promise<ReceiptResponse> => {
  const dbUser = await getCurrentUser(event);

  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  await assertReceiptOwnership(id, dbUser);

  return fetchReceipt(id);
});
