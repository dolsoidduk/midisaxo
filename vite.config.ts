import type { UserConfig } from "vite";

const hasCliFlag = (name: string): boolean => {
  const arg = `--${name}`;
  return process.argv.some((v) => v === arg || v.startsWith(`${arg}=`));
};

const parsePort = (raw: unknown, fallback: number): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  const i = Math.floor(n);
  if (i < 1 || i > 65535) {
    return fallback;
  }
  return i;
};

const repoName = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split("/")[1]
  : undefined;

// GitHub Pages is hosted under /<repo>/ (project pages).
// Keep default '/' for local dev and non-pages builds.
// Default to relative asset paths so the UI can be loaded from file:// (Electron)
// as well as via HTTP. Override for GitHub Pages project pages.
const base =
  process.env.GITHUB_PAGES === "true" && repoName ? `/${repoName}/` : "./";

// Vite v1 + Node 18: avoid passing duplicate options from both CLI and config.
// If the user specifies --host/--port on the CLI, do not set hostname/port here.
const defaultHost = process.env.VITE_HOST || process.env.HOST || "0.0.0.0";
const defaultPort = parsePort(process.env.VITE_PORT || process.env.PORT, 3004);
const hostname = hasCliFlag("host") ? undefined : defaultHost;
const port = hasCliFlag("port") ? undefined : defaultPort;

const config: UserConfig = {
  base,
  hostname,
  port,
  strictPort: true,
  optimizeDeps: {
    include: [
      "semver/functions/gt",
      "semver/functions/lt",
      "semver/functions/clean",
    ],
  },
};

export default config;
