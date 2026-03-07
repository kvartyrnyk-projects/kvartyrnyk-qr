import { isValid, parse } from "@tma.js/init-data-node";
import type { AuthContext } from "~/types/telegram";
import { sql } from "~~/server/utils/db";
import { botToken } from "~~/server/utils/constants";

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith("/api/") || path.startsWith("/api/file")) return;

  // Skip auth validation in development — mock user is injected instead
  if (import.meta.dev) {
    event.context.auth = {
      telegramUser: {
        auth_date: new Date(),
        hash: "mock_hash",
        signature: "mock_signature",
        user: {
          id: 1,
          first_name: "Dev",
          last_name: "User",
          username: "dev_user",
        },
      },
      dbUser: { id: 1, telegram_id: 1, role: "ADMIN", full_name: "Dev User" },
    };
    return;
  }

  const initData = getHeader(event, "Authorization");
  if (!initData) {
    throw createError({ statusCode: 401, message: "Не авторизовано" });
  }

  if (!isValid(initData, botToken)) {
    throw createError({ statusCode: 401, message: "Невірний підпис" });
  }

  const telegramUser = parse(initData);
  if (!telegramUser.user) {
    throw createError({ statusCode: 400, message: "Невірні дані авторизації" });
  }

  const [dbUser] = await sql`
    SELECT id, telegram_id, role, full_name
    FROM users
    WHERE telegram_id = ${telegramUser.user?.id}
  `;

  if (!dbUser || !["ADMIN", "BARTENDER"].includes(dbUser.role)) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }

  event.context.auth = {
    telegramUser,
    dbUser: dbUser as AuthContext["dbUser"],
  };
});
