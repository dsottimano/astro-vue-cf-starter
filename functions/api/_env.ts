/// <reference types="@cloudflare/workers-types" />

// Shared environment bindings for the Pages Functions.
// Secrets (GITHUB_TOKEN) are set via `wrangler pages secret` / dashboard;
// everything else lives in wrangler.toml [vars] or .dev.vars locally.
export interface Env {
  // Auth
  ENVIRONMENT?: string; // "development" bypasses Access verification
  CF_ACCESS_TEAM_DOMAIN: string; // e.g. "myteam.cloudflareaccess.com"
  CF_ACCESS_AUD: string; // Access application AUD tag

  // GitHub commit target
  GITHUB_TOKEN: string; // fine-grained PAT (secret)
  GITHUB_REPO: string; // "owner/repo"
  GITHUB_BRANCH: string; // e.g. "main"

  // R2 bucket binding for uploaded media
  MEDIA: R2Bucket;
}
