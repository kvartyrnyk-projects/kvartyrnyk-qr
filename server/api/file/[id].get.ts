import mime from "mime/lite";
import { botToken } from "~~/server/utils/constants";

interface TelegramGetFileResponse {
  ok: boolean;
  result?: { file_path?: string };
}

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id");
  if (!rawId || typeof rawId !== "string") {
    throw createError({ statusCode: 404, message: "File not found" });
  }

  const id = decodeURIComponent(rawId);
  const apiUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${id}`;
  const res = await $fetch<TelegramGetFileResponse>(apiUrl);

  if (!res.ok || !res.result?.file_path) {
    throw createError({ statusCode: 404, message: "File not found" });
  }

  const filePath = res.result.file_path;
  const fileExt = filePath.split(".").pop();
  const mimetype =
    (fileExt ? mime.getType(fileExt) : null) ?? "application/octet-stream";

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

  const range = getRequestHeader(event, "range");
  const headers = range ? { Range: range } : undefined;

  // Bypass CORS blocking by re-streaming
  return proxyRequest(event, fileUrl, {
    sendStream: true,
    fetchOptions: {
      headers,
    },
    onResponse(outputEvent) {
      // 3. SET FILE IDENTITY HEADERS
      // This stops the browser from defaulting to a .bin file
      setResponseHeader(outputEvent, "Content-Type", mimetype);
      setResponseHeader(
        outputEvent,
        "Content-Disposition",
        `attachment; filename="${filePath}"`,
      );

      // Tell the client that chunking is supported
      setResponseHeader(outputEvent, "Accept-Ranges", "bytes");

      // 4. INJECT CORS HEADERS FOR PDF.JS
      setResponseHeader(outputEvent, "Access-Control-Allow-Origin", "*");
      setResponseHeader(
        outputEvent,
        "Access-Control-Allow-Methods",
        "GET, HEAD, OPTIONS",
      );

      // PDF.js MUST be able to read these specific headers to know how to piece the chunks together
      setResponseHeader(
        outputEvent,
        "Access-Control-Expose-Headers",
        "Content-Length, Content-Range, Accept-Ranges, Content-Type",
      );
    },
  });
});
