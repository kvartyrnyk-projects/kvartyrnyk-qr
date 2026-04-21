import { sql } from "~~/server/utils/db";
import { isInRole } from "~~/server/utils/auth";
import type { Product, CreateProductBody } from "~/types/receipt";

export default defineEventHandler(async (event): Promise<Product> => {
  await isInRole(event, ["BARTENDER", "SUDO"]);

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
    INSERT INTO products (name, description, unit, price, tags)
    VALUES (
      ${body.name.trim()},
      ${body.description?.trim() ?? null},
      ${body.unit.trim()},
      ${body.price},
      ${sql.array(tags)}
    )
    RETURNING id, name, description, unit, price, tags
  `;
  if (!row) {
    throw createError({ statusCode: 500, message: "Помилка при створенні продукту" });
  }

  return row;
});
