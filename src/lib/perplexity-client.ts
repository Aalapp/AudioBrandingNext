import Perplexity from '@perplexity-ai/perplexity_ai';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const DEFAULT_MAX_RETRIES = 3;

const sharedClient = PERPLEXITY_API_KEY
  ? new Perplexity({
      apiKey: PERPLEXITY_API_KEY,
    })
  : null;

function getBackoffDelay(attempt: number): number {
  const base = Math.pow(2, attempt) * 1000;
  return base + Math.random() * 1000;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getClient(): Perplexity {
  if (!sharedClient) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }
  return sharedClient;
}

interface RequestOptions {
  maxRetries?: number;
}

export interface PerplexityStreamChunk {
  choices: Array<{
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
    };
    finish_reason?: string | null;
  }>;
}

export async function perplexityRequest(
  payload: Record<string, any>,
  options: RequestOptions = {}
) {
  const client = getClient();
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const body = {
        ...payload,
        stream: false,
      };
      return await client.chat.completions.create(body as any);
    } catch (error: any) {
      const canRetry =
        error instanceof Perplexity.RateLimitError ||
        error instanceof Perplexity.APIError;

      if (canRetry && attempt < maxRetries - 1) {
        await delay(getBackoffDelay(attempt));
        continue;
      }

      throw error;
    }
  }

  throw new Error('Perplexity API request exhausted retries');
}

export async function streamPerplexityCompletion(
  payload: Record<string, any>,
  options: RequestOptions = {}
) {
  const client = getClient();
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const body = {
        ...payload,
        stream: true,
      };

      const streamResult = (await client.chat.completions.create(body as any)) as unknown;
      const stream = streamResult as AsyncIterable<any>;

      async function* mapStream(): AsyncGenerator<PerplexityStreamChunk, void, unknown> {
        for await (const chunk of stream) {
          const normalizedChoices =
            chunk?.choices?.map((choice: any) => ({
              delta: {
                content:
                  typeof choice?.delta?.content === 'string'
                    ? choice.delta.content
                    : undefined,
              },
              message: {
                content:
                  typeof choice?.message?.content === 'string'
                    ? choice.message.content
                    : undefined,
              },
              finish_reason: choice?.finish_reason ?? null,
            })) || [];

          yield {
            choices: normalizedChoices,
          };
        }
      }

      return mapStream();
    } catch (error: any) {
      const canRetry =
        error instanceof Perplexity.RateLimitError ||
        error instanceof Perplexity.APIError;

      if (canRetry && attempt < maxRetries - 1) {
        await delay(getBackoffDelay(attempt));
        continue;
      }

      throw error;
    }
  }

  throw new Error('Perplexity streaming request exhausted retries');
}

