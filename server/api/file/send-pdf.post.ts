// server/api/send-pdf.post.ts
import { botToken } from "~~/server/utils/constants";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { pdfBase64, filename, chatId } = body;

  if (!pdfBase64 || !chatId) {
    throw createError({ statusCode: 400, message: "Missing required data" });
  }

  try {
    // 1. Strip the data URL prefix to get the raw base64 string
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    
    // 2. Convert to a Buffer
    const buffer = Buffer.from(base64Data, "base64");

    // 3. Build FormData to send as a Telegram document
    const formData = new FormData();
    formData.append("chat_id", chatId.toString());
    
    // Convert Buffer to a Blob for fetch
    const fileBlob = new Blob([buffer], { type: 'application/pdf' });
    formData.append("document", fileBlob, filename || "document.pdf");

    // 4. Fire it off to the Telegram API
    await $fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: "POST",
      body: formData,
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Telegram API Error:", message);
    throw createError({ statusCode: 500, message: "Failed to send to Telegram" });
  }
});
