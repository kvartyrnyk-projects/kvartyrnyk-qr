import { isValid, parse } from "@tma.js/init-data-node";
import { botToken } from "~~/server/utils/constants";

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith("/api/") || path.startsWith("/api/file")) return;

  // Skip auth validation in development — mock user is injected instead
  if (import.meta.dev) {
    event.context.telegramUserId = 1;
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

  event.context.telegramUserId = telegramUser.user.id;
});
