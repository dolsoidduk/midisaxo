import type { UserConfig } from "vite";

const repoName = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split("/")[1]
  : undefined;

// GitHub Pages is hosted under /<repo>/ (project pages).
// Keep default '/' for local dev and non-pages builds.
const base =
  process.env.GITHUB_PAGES === "true" && repoName ? `/${repoName}/` : "/";

const config: UserConfig = {
  base,
  hostname: "0.0.0.0",
  port: 3002,
  optimizeDeps: {
    include: [
      "semver/functions/gt",
      "semver/functions/lt",
      "semver/functions/clean",
    ],
  },
};

export default config;
