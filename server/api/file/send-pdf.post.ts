import { botToken } from "~~/server/utils/constants";

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event);
  if (!parts)
    throw createError({ statusCode: 400, message: "Missing multipart data" });

  const get = (name: string) => parts.find((p) => p.name === name);

  const chatIdPart = get("chatId");
  const filenamePart = get("filename");
  const filePart = get("file");

  if (!chatIdPart || !filePart) {
    throw createError({ statusCode: 400, message: "Missing required fields" });
  }

  const chatId = chatIdPart.data.toString();
  const filename = filenamePart?.data.toString() ?? "document.pdf";

  try {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    const fileBlob = new Blob([new Uint8Array(filePart.data)], {
      type: "application/pdf",
    });
    formData.append("document", fileBlob, filename);

    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendDocument`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Telegram API rejected the file: ${err}`);
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Telegram API Error:", message);
    throw createError({
      statusCode: 500,
      message: "Failed to send to Telegram",
    });
  }
});
