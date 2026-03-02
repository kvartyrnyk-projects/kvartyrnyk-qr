import { sendData, miniApp } from "@tma.js/sdk-vue";

export const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const errorMessage = encodeURIComponent("Невірний QR-код");

/**
 * Sets up event listeners for handling QR code scanning results and errors.
 * On successful scan, redirects to a validation page with the scanned data.
 * On error, redirects to an error page with the error message.
 * 
 * @param data - The scanned QR code data to be validated.
 */
export const onQrError = async (error: string) => {
  const encodedError = encodeURIComponent(error);
  await navigateTo(`/error?message=${encodedError}`);
};

/**
 * Initializes event listeners for QR code scanning results and errors.
 * Should be called once when the application starts.
 * 
 * @param data - The scanned QR code data to be validated.
 */
export const validateQr = async (data: string) => {
  if (uuidRegex.test(data)) {
    await navigateTo(`/validate/${data}`);
  } else {
    await onQrError(errorMessage);
  }
};

/**
 * Send back the user data to the Telegram bot.
 * 
 * @param data - The scanned QR code data to be sent back to the Telegram bot.
 */
export const sendBackQr = (data: string) => {
    sendData(data);
    miniApp.close();
}
