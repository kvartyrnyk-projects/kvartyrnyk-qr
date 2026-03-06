import { botToken } from "~~/server/utils/constants";

interface TelegramGetFileResponse {
  ok: boolean;
  result?: { file_path?: string };
}

export default defineEventHandler(async (event) => {
  const { id } = event.context.params ?? {};
  if (!id || typeof id !== "string") {
    throw createError({ statusCode: 404, message: "File not found" });
  }

  const apiUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${id}`;
  const res = await $fetch<TelegramGetFileResponse>(apiUrl);

  if (!res.ok || !res.result?.file_path) {
    throw createError({ statusCode: 404, message: "File not found" });
  }

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${res.result.file_path}`;
  return sendRedirect(event, fileUrl);
});