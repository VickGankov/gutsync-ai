export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // Direct AI provider (any OpenAI-compatible chat completions API).
  // Defaults to Google Gemini's OpenAI-compatible endpoint.
  llmApiUrl: process.env.LLM_API_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "gemini-2.5-flash",

  // Direct S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2, ...).
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3Region: process.env.S3_REGION ?? "auto",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  /** Optional public/CDN base URL for the bucket. If unset, photos are served via /api/media. */
  s3PublicUrlBase: process.env.S3_PUBLIC_URL_BASE ?? "",
};
