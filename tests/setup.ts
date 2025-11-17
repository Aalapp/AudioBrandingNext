// tests/setup.ts
// NOTE: this file is loaded by Jest before tests run (setupFilesAfterEnv)

// 1) Ensure env vars expected by your code/tests
process.env.PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || "test-api-key";
process.env.REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "test-token";
process.env.ACE_STEP_MODEL_VERSION = process.env.ACE_STEP_MODEL_VERSION || "test-version";
// Auth / OAuth dummy values
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "test-client-secret";
// Upstash dummy values (prevent real connections)
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "http://localhost:6379";
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "test-upstash-token";

// 2) Provide a default global fetch mock so libs that call fetch won't throw.
// Individual tests can override/spy on global.fetch as needed.
if (!globalThis.fetch) {
  // @ts-ignore
  globalThis.fetch = jest.fn(async (url: string, options?: any) => {
    // Default stub — individual tests should mock fetch specifically when they need to check calls.
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    };
  });
}

// 3) Mock packages that initialize clients at import-time to avoid real network calls.
// Example: mock @upstash/redis to a fake client
jest.mock("@upstash/redis", () => {
  return {
    // The Upstash package exports `Redis` (class or function). Return a mock constructor.
    Redis: jest.fn().mockImplementation(() => {
      return {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue("OK"),
        pipeline: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        // add other methods your code calls
      };
    }),
  };
});

// 4) Optionally mock 'nanoid' as a fallback (not strictly necessary if transform applied)
jest.mock("nanoid", () => ({
  nanoid: () => "fixed-nanoid",
}));

// 5) Optional: seed other globals (Date, timers etc.)
// jest.useFakeTimers();   // use if tests rely on fake timers

// Note: keep this setup minimal — specific tests should still mock modules they depend on
