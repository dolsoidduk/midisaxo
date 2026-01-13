import type { UserConfig } from "vite";

const repoName = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split("/")[1]
  : undefined;

// GitHub Pages is hosted under /<repo>/ (project pages).
// Keep default '/' for local dev and non-pages builds.
// Default to relative asset paths so the UI can be loaded from file:// (Electron)
// as well as via HTTP. Override for GitHub Pages project pages.
const base =
  process.env.GITHUB_PAGES === "true" && repoName ? `/${repoName}/` : "./";

const config: UserConfig = {
  base,
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
