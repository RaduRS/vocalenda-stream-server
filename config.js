import dotenv from "dotenv";

/**
 * Load environment variables based on the current environment
 * In production, use system environment variables
 * In development, load from .env.local
 */
export function loadEnvironmentVariables() {
  if (process.env.NODE_ENV !== "production") {
    dotenv.config({ path: ".env.local" });
  }
}

/**
 * Get configuration values from environment variables
 */
export function getConfig() {
  return {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    websocket: {
      port: process.env.WS_PORT || 8080,
    },
    deepgram: {
      apiKey: process.env.DEEPGRAM_API_KEY,
    },
    environment: process.env.NODE_ENV || "development",
  };
}

/**
 * Validate that all required environment variables are present
 */
export function validateConfig() {
  const config = getConfig();
  const required = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", value: config.supabase.url },
    { key: "SUPABASE_SERVICE_ROLE_KEY", value: config.supabase.serviceRoleKey },
    { key: "DEEPGRAM_API_KEY", value: config.deepgram.apiKey },
  ];

  const missing = required.filter(({ value }) => !value);
  
  if (missing.length > 0) {
    const missingKeys = missing.map(({ key }) => key).join(", ");
    throw new Error(`Missing required environment variables: ${missingKeys}`);
  }

  return config;
}

// Initialize configuration on module load
loadEnvironmentVariables();