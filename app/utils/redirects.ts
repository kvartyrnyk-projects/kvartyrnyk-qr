import { sendData, miniApp } from "@tma.js/sdk-vue";

export const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const errorMessage = encodeURIComponent("Невірний QR-код");

/**
 * Redirects to the error page with the given message.
 * Optionally carries the event ID so the error page can offer a re-scan.
 */
export const onQrError = async (error: string) => {
  const params = new URLSearchParams({ message: error });
  await navigateTo(`/error?${params.toString()}`);
};

/**
 * Validates the scanned QR code format and navigates to the validation page.
 * Requires the current event ID to build the correct route.
 */
export const validateQr = async (data: string) => {
  if (!uuidRegex.test(data)) {
    return onQrError(decodeURIComponent(errorMessage));
  }
  await navigateTo(`/validate/qr/${data}`);
};

/**
 * Send back the user data to the Telegram bot.
 *
 * @param data - The scanned QR code data to be sent back to the Telegram bot.
 */
export const sendBackQr = (data: string) => {
  sendData(data);
  miniApp.close();
};
