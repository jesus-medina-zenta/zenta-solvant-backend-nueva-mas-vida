// src/core/config/validation.ts
import * as Joi from 'joi';

export function validate(config: Record<string, any>) {
  const schema = Joi.object({
    APP_PORT: Joi.number().default(3000),
    LIST_CORS: Joi.string().allow('').optional(),
    SECRETKEY_AUTH: Joi.string().required(),
    TOKEN_EXPIRATION: Joi.string().default('1h'),
    GOOGLE_CLIENT_ID: Joi.string().optional(),
    GCP_PROJECT_ID: Joi.string().required(),
    GCP_REGION: Joi.string().default('us-central1'),
    GCP_PIPELINE_NAME: Joi.string().default(
      'zenta-solvant-pipe-reading-csv-dev',
    ),
    GCP_SERVICE_ACCOUNT_EMAIL: Joi.string().optional(),
    GCP_FIRESTORE_DATABASE_ID: Joi.string().allow('').optional(),
    GCP_AUDIO_BUCKET_NAME: Joi.string().required(),
    EXTERNAL_API_BASE_URL: Joi.string().required(),
    EXTERNAL_API_SECURITY_TYPE: Joi.string().required().default('none'),
    EXTERNAL_API_KEY: Joi.string().allow('').optional(),
    EXTERNAL_API_TOKEN: Joi.string().allow('').optional(),
    SENDGRID_API_KEY: Joi.string().allow('').optional(),
    SENDGRID_FROM_EMAIL: Joi.string().email().allow('').optional(),
    ELEVENLABS_WEBHOOK_SECRET: Joi.string().optional(),
    GCP_CSV_BUCKET_NAME: Joi.string().required(),
  });

  const { error, value } = schema.validate(config, { allowUnknown: true });
  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }
  return value;
}
