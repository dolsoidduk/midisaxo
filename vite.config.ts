import type { UserConfig } from "vite";

const config: UserConfig = {
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
