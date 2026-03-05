// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "@nuxt/ui"],
  css: ["~/assets/css/main.css"],
  nitro: {
    // Keep bun built-in modules external so Nitro doesn't try to bundle them
    rollupConfig: {
      external: ["bun"],
    },
  },
});
