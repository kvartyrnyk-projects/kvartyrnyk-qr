import type { FullValidationResponse } from "~/types/validation";

/**
 * Fetches validation data for a given QR code.
 * @param qr The QR code contents
 * @returns The useFetch result (client-only, auth header set on mount)
 */
export const useScanData = async (qr: MaybeRef<string>) => {
  const qrValue = unref(qr);

  if (!qrValue || !uuidRegex.test(qrValue)) {
    await onQrError("Невірний QR код. Спробуйте ще раз.");
  }

  return useClientFetch<FullValidationResponse>(`/api/qr/${qrValue}`, {
    method: "POST",
  });
};
