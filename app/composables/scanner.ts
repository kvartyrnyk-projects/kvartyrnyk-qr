import { qrScanner } from "@tma.js/sdk-vue";

/**
 * Composable for handling QR code scanning using the TMA.js SDK.
 *
 * @param onResult - Callback function to handle successful scan results.
 * @param onError - Callback function to handle errors during scanning.
 * @returns An object containing the scanning state and a function to open the scanner.
 */
export const useScanner = (
  onResult: (code: string) => void,
  onError: (error: string) => void,
) => {
  const isScanning = ref(false);

  async function openScanner() {
    if (isScanning.value) return;

    isScanning.value = true;

    try {
      const result = await qrScanner.capture({
        text: "Наведіть камеру на QR код",
        capture: () => true,
      });

      if (result) {
        onResult(result);
      }
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Невідома помилка сканування",
      );
    } finally {
      isScanning.value = false;
    }
  }

  return {
    isScanning,
    openScanner,
  };
};
