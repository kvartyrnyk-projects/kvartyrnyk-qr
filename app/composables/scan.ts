import { retrieveRawInitData } from "@tma.js/sdk-vue";
import type { FullValidationResponse } from "~/types/validation";

/**
 * Fetches validation data for a given QR code.
 * @param qr The QR code contents
 * @returns A promise resolving to the validation result
 */
export const useScanData = async (qr: MaybeRef<string>) => {
  const qrValue = unref(qr);
  const initData = ref<string>();
  const headers = computed(() =>
    initData.value ? { Authorization: initData.value } : undefined,
  );

  onMounted(() => {
    initData.value = retrieveRawInitData();
  });

  if (!qrValue || !uuidRegex.test(qrValue)) {
    await onQrError("Невірний QR код. Спробуйте ще раз.");
  }

  const result = await useFetch<FullValidationResponse>(`/api/qr/${qrValue}`, {
    method: "POST",
    server: false,
    headers,
  });

  return result;
};
