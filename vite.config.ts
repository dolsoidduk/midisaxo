import type { UserConfig } from "vite";

const config: UserConfig = {
  // Use relative asset paths so the UI can be loaded from file:// (Electron) as well as via HTTP.
  base: "./",
  hostname: "0.0.0.0",
  port: 3004,
  optimizeDeps: {
    include: [
      "semver/functions/gt",
      "semver/functions/lt",
      "semver/functions/clean",
    ],
  },
};

export default config;
