export const configuration = () => ({
  // Cloud Run injects PORT; keep APP_PORT for local/dev overrides.
  port: parseInt(process.env.PORT || process.env.APP_PORT, 10) || 8080,
  listCors: process.env.LIST_CORS,
  secretKeyAuth: process.env.SECRETKEY_AUTH,
  tokenExpiration: process.env.TOKEN_EXPIRATION || '1h',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  // Firebase / GCP
  gcpProjectId: process.env.GCP_PROJECT_ID,
  gcpRegion: process.env.GCP_REGION || 'us-central1',
  gcpPipelineName:
    process.env.GCP_PIPELINE_NAME || 'zenta-solvant-pipe-reading-csv-dev',
  gcpFirestoreDatabaseId: process.env.GCP_FIRESTORE_DATABASE_ID,
  gcpServiceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
  gcpAudioBucketName: process.env.GCP_AUDIO_BUCKET_NAME,
  gcpCsvBucketName: process.env.GCP_CSV_BUCKET_NAME,
  //Axios
  externalApiBaseUrl: process.env.EXTERNAL_API_BASE_URL,
  externalApiSecurityType: process.env.EXTERNAL_API_SECURITY_TYPE,
  externalApiKey: process.env.EXTERNAL_API_KEY,
  externalApiToken: process.env.EXTERNAL_API_TOKEN,
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL,
  // ElevenLabs Webhooks
  elevenLabsWebhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET,
});
