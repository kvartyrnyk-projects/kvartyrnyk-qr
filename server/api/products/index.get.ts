import { sql } from "~~/server/utils/db";
import { getCurrentUser } from "~~/server/utils/auth";
import type { Product } from "~/types/receipt";

export default defineEventHandler(async (event): Promise<Product[]> => {
  await getCurrentUser(event);

  const rows = await sql<
    {
      id: number;
      name: string;
      description: string | null;
      unit: string;
      price: number;
      tags: string[];
    }[]
  >`
    SELECT id, name, description, unit, price, tags
    FROM products
    ORDER BY name ASC
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    unit: r.unit,
    price: Number(r.price),
    tags: r.tags ?? [],
  }));
});
