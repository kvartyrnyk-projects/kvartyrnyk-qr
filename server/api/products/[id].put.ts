import { sql } from "~~/server/utils/db";
import { isInRole } from "~~/server/utils/auth";
import type { Product, CreateProductBody } from "~/types/receipt";

export default defineEventHandler(async (event): Promise<Product> => {
  await isInRole(event, ["BARTENDER", "SUDO"]);

  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  const body = await readBody<CreateProductBody>(event);

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: "Назва обов'язкова" });
  }
  if (!body.unit?.trim()) {
    throw createError({
      statusCode: 400,
      message: "Одиниця вимірювання обов'язкова",
    });
  }
  if (!Number.isFinite(body.price) || body.price < 0) {
    throw createError({ statusCode: 400, message: "Невірна ціна" });
  }

  const tags = body.tags ?? [];
  const [row] = await sql<
    {
      id: number;
      name: string;
      description: string | null;
      unit: string;
      price: number;
      tags: string[];
    }[]
  >`
    UPDATE products
    SET
      name        = ${body.name.trim()},
      description = ${body.description?.trim() ?? null},
      unit        = ${body.unit.trim()},
      price       = ${body.price},
      tags        = ${sql.array(tags)},
      updated_at  = now()
    WHERE id = ${id}
    RETURNING id, name, description, unit, price, tags
  `;

  if (!row) {
    throw createError({ statusCode: 404, message: "Продукт не знайдено" });
  }

  return row;
});
