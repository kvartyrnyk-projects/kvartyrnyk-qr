import type { MeResponse } from "~/types/stats";

export default defineEventHandler((event): MeResponse => {
  const dbUser = event.context.auth?.dbUser;
  if (!dbUser) {
    throw createError({ statusCode: 401, message: "Не авторизовано" });
  }
  return {
    role: dbUser.role,
    fullName: dbUser.full_name ?? null,
  };
});
