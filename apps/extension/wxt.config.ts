import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "otto",
    description: "Understands pages, fills forms, remembers them.",
    permissions: ["sidePanel", "scripting", "tabs", "storage", "webNavigation"],
    host_permissions: ["<all_urls>"],
    action: { default_title: "otto" },
    minimum_chrome_version: "120",
  },
  vite: () => ({ plugins: [tailwindcss()] }),
  webExt: { disabled: true },
});
