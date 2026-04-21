import { sql } from "~~/server/utils/db";
import { isInRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await isInRole(event, ["BARTENDER", "SUDO"]);

  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  try {
    const [row] = await sql<{ id: number }[]>`
      DELETE FROM products WHERE id = ${id} RETURNING id
    `;
    if (!row) {
      throw createError({ statusCode: 404, message: "Продукт не знайдено" });
    }
  } catch (err: any) {
    if (err?.code === "23503") {
      throw createError({
        statusCode: 409,
        message: "Cannot delete: product is used in existing receipts",
      });
    }
    throw err;
  }

  return { ok: true };
});
