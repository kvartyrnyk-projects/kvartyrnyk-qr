import { onMounted } from "vue";
import { mockTelegramEnv, emitEvent } from "@tma.js/sdk-vue";

const tgWebAppThemeParams = {
  accent_text_color: "#6ab2f2",
  bg_color: "#17212b",
  button_color: "#5288c1",
  button_text_color: "#ffffff",
  destructive_text_color: "#ec3942",
  header_bg_color: "#17212b",
  hint_color: "#708499",
  link_color: "#6ab3f3",
  secondary_bg_color: "#232e3c",
  section_bg_color: "#17212b",
  section_header_text_color: "#6ab3f3",
  subtitle_text_color: "#708499",
  text_color: "#f5f5f5",
} as const;

/**
 * Mocks the Telegram Web App API when `process.env.NODE_ENV`
 * is not equal to `"production"`.
 *
 * This is a REQUIREMENT for development, as the Telegram Web App API
 * is only available when the app is ran inside Telegram.
 */
export const useMockTelegram = () => {
  onMounted(() => {
    if (!import.meta.dev) {
      return;
    }

    mockTelegramEnv({
      launchParams: {
        tgWebAppThemeParams,
        tgWebAppData: new URLSearchParams([
          [
            "user",
            JSON.stringify({
              id: 1,
              first_name: "Pavel",
            }),
          ],
          ["hash", ""],
          ["signature", ""],
          ["auth_date", Date.now().toString()],
        ]),
        tgWebAppStartParam: "debug",
        tgWebAppVersion: "8",
        tgWebAppPlatform: "tdesktop",
      },
      onEvent(event) {
        // Mock QR scanner: emit qr_text_received after a short delay
        if (event.name === "web_app_open_scan_qr_popup") {
          setTimeout(() => {
            emitEvent("qr_text_received", {
              data: globalThis.crypto.randomUUID(),
            });
          }, 500);
        }
      },
    });
  });
};
