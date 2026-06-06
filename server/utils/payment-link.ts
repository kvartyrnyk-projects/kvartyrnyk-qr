import { sql } from "~~/server/utils/db";

export async function generatePaymentLink(amountHryvnia: number, maxResults: number = 1): Promise<string> {
  const [jar] = await sql<{
        url: string;
      }[]>`SELECT url FROM jars ORDER BY RANDOM() LIMIT ${maxResults}`;
    if (!jar) {
      throw new Error("No payment jars available");
    }

  return `${jar.url}?a=${amountHryvnia}`;
}
