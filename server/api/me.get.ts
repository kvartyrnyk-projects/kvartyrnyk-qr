import { isInRole } from "~~/server/utils/auth";
import type { MeResponse } from "~/types/stats";

export default defineEventHandler(async (event): Promise<MeResponse> => {
  const dbUser = await isInRole(event, ["ADMIN", "BARTENDER", "SUDO"]);
  return {
    role: dbUser.role,
    fullName: dbUser.full_name,
  };
});
