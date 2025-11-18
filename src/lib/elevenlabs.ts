const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export interface ElevenLabsCompositionPlan {
  positive_global_styles: string[];
  negative_global_styles: string[];
  sections: ElevenLabsSection[];
}

export interface ElevenLabsSection {
  section_name: string;
  positive_local_styles: string[];
  negative_local_styles: string[];
  duration_ms: number; // 3000-120000
  lines?: string[]; // Optional, for lyrics (we'll leave empty for instrumental)
}

export interface ElevenLabsComposeRequest {
  composition_plan?: ElevenLabsCompositionPlan;
  prompt?: string; // Musical description prompt
  model_id?: 'music_v1';
  force_instrumental?: boolean;
  respect_sections_durations?: boolean;
  store_for_inpainting?: boolean;
  music_length_ms?: number;
  output_format?: string;
}

/**
 * Compose music using ElevenLabs API
 */
export async function composeMusic(
  request: ElevenLabsComposeRequest
): Promise<Buffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  // Build payload
  const payload: any = {
    model_id: 'music_v1',
  };

  // Use prompt if provided, otherwise use composition_plan
  if (request.prompt) {
    payload.prompt = request.prompt;
    payload.force_instrumental = request.force_instrumental ?? true;
    payload.music_length_ms = request.music_length_ms ?? 30000; // Default 30 seconds
  } else if (request.composition_plan) {
    payload.composition_plan = request.composition_plan;
    payload.respect_sections_durations = request.respect_sections_durations ?? true;
    // Don't include force_instrumental when using composition_plan
  } else {
    throw new Error('Either prompt or composition_plan must be provided');
  }

  // Add output_format as query parameter (not in body)
  const url = new URL(`${ELEVENLABS_API_URL}/music`);
  if (request.output_format) {
    url.searchParams.append('output_format', request.output_format);
  }

  if (payload.prompt) {
    console.log('Calling ElevenLabs API with prompt:', {
      promptLength: payload.prompt.length,
      promptPreview: payload.prompt.substring(0, 200) + '...',
      musicLengthMs: payload.music_length_ms,
      forceInstrumental: payload.force_instrumental,
      outputFormat: request.output_format,
    });
  } else if (payload.composition_plan) {
    console.log('Calling ElevenLabs API with composition_plan:', {
      sectionsCount: payload.composition_plan.sections.length,
      totalDuration: payload.composition_plan.sections.reduce((sum: number, s: ElevenLabsSection) => sum + s.duration_ms, 0),
      positiveGlobalStyles: payload.composition_plan.positive_global_styles.length,
      outputFormat: request.output_format,
    });
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ElevenLabs API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      payload: JSON.stringify(payload, null, 2),
    });
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  // Response is binary audio data
  const arrayBuffer = await response.arrayBuffer();
  console.log(`ElevenLabs API success: received ${arrayBuffer.byteLength} bytes`);
  return Buffer.from(arrayBuffer);
}

