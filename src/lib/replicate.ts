const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_API_URL = 'https://api.replicate.com/v1';
const ACE_STEP_MODEL_VERSION = process.env.ACE_STEP_MODEL_VERSION;

export interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[]; // URL(s) to generated audio
  error?: string;
  urls?: {
    get: string;
    cancel: string;
  };
}

export interface AceStepPredictionInput {
  tags: string;
  lyrics?: string;
  duration?: number;
  number_of_steps?: number;
  seed?: number;
  scheduler?: string;
  guidance_type?: string;
  granularity_scale?: number;
  guidance_interval?: number;
  guidance_interval_decay?: number;
  guidance_scale?: number;
  min_guidance_scale?: number;
  tag_guidance_scale?: number;
  lyric_guidance_scale?: number;
}

/**
 * Create a prediction for ace-step model
 */
export async function createAceStepPrediction(
  input: AceStepPredictionInput
): Promise<ReplicatePrediction> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }
  if (!ACE_STEP_MODEL_VERSION) {
    throw new Error('ACE_STEP_MODEL_VERSION not configured');
  }
  if (!input?.tags?.trim()) {
    throw new Error('ACE-Step tags input is required');
  }

  const sanitizedInput = Object.fromEntries(
    Object.entries({
      ...input,
      duration: input.duration ?? -1,
    }).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  const response = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: ACE_STEP_MODEL_VERSION,
      input: sanitizedInput,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Replicate API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get prediction status
 */
export async function getPredictionStatus(
  predictionId: string
): Promise<ReplicatePrediction> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const response = await fetch(`${REPLICATE_API_URL}/predictions/${predictionId}`, {
    headers: {
      'Authorization': `Token ${REPLICATE_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Replicate API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Poll prediction until completion
 */
export async function pollPredictionUntilComplete(
  predictionId: string,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<ReplicatePrediction> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const prediction = await getPredictionStatus(predictionId);

    if (prediction.status === 'succeeded') {
      return prediction;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(
        `Prediction ${predictionId} ${prediction.status}: ${prediction.error || 'Unknown error'}`
      );
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Prediction ${predictionId} did not complete within ${maxAttempts} attempts`);
}

/**
 * Download audio file from URL
 */
export async function downloadAudioFile(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

