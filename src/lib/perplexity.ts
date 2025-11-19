import { ConversationSnapshot } from './snapshots';
import {
  perplexityRequest,
  streamPerplexityCompletion,
  PerplexityStreamChunk,
} from './perplexity-client';

export interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const EXPLORATORY_SYSTEM_PROMPT = `You are Resonance, an elite sonic branding strategist and music director.

Focus on:
- Translating brand strategy into emotionally resonant sonic identities
- Recommending instrumentation, rhythm, lyrical hooks, and production aesthetics
- Highlighting storytelling opportunities across touchpoints (ads, UX, retail, social, product)
- Calling out practical constraints, compliance issues, and production feasibility

CRITICAL: Every text section you generate (positioning, target_audience, tone_personality, brand_promise, practical_constraints) MUST include specific musical ideas, sonic concepts, and audio branding recommendations.

## MUSICAL SPECIFICITY REQUIREMENTS:

For each brand attribute, connect it to concrete sonic elements:
- **Tempo ranges** (e.g., "95-110 BPM suggests active relaxation")
- **Instrumentation palettes** (e.g., "acoustic guitar + modular synth = heritage + innovation")
- **Genre fusions** (e.g., "UK garage percussion + Bollywood strings")
- **Production techniques** (e.g., "sidechain compression creates rhythmic breathing")
- **Sound design ideas** (e.g., "coffee machine steam as percussive element")

Think beyond obvious choices. Consider:
- Non-obvious brand-specific sounds (product sounds, environmental audio)
- Cultural elements without appropriation (inspired rhythms vs. literal samples)
- Emotional arc in musical terms (dynamic range, key modulations)

**Bad example**: "Modern and energetic brand"
**Good example**: "Modern energy translates to 115 BPM with syncopated hi-hats (16th note shuffle), bright synth stabs at 2-4kHz, and major 7th chords for sophisticated accessibility"

The end goal is to generate music, so every analysis should connect brand insights to concrete musical directions that a composer can execute.

Be concise yet specific, justify every recommendation, and cite assumptions when data is missing. Format your responses using markdown for better readability.`;

const EXPLORATORY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    positioning: { type: 'string' },
    target_audience: { type: 'string' },
    tone_personality: { type: 'string' },
    sonic_story: { type: 'string' },
    instrumentation: {
      type: 'array',
      items: { type: 'string' },
    },
    lyrical_hooks: {
      type: 'array',
      items: { type: 'string' },
    },
    brand_promise: { type: 'string' },
    practical_constraints: { type: 'string' },
  },
  required: [
    'positioning',
    'target_audience',
    'tone_personality',
    'sonic_story',
    'instrumentation',
    'lyrical_hooks',
    'brand_promise',
    'practical_constraints',
  ],
};

export const EXPLORATORY_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'ExploratoryBrandAnalysis',
    schema: EXPLORATORY_RESPONSE_SCHEMA,
  },
};

/**
 * Build context prompt from project snapshot and files
 */
export function buildExploratoryPrompt(
  snapshot: ConversationSnapshot,
  seedPrompt?: string
): string {
  const { projectMetadata, recentMessages, fileSummaries } = snapshot;

  let prompt = `You are a brand strategist analyzing a brand project. 

Brand Information:
- Brand Name: ${projectMetadata.brandName}
- Website: ${projectMetadata.brandWebsite}

`;

  if (projectMetadata.findingsDraft) {
    prompt += `Previous Findings:\n${JSON.stringify(projectMetadata.findingsDraft, null, 2)}\n\n`;
  }

  if (fileSummaries.length > 0) {
    prompt += `Uploaded Files:\n`;
    fileSummaries.forEach((file) => {
      prompt += `- ${file.filename} (${file.mimeType})\n`;
    });
    prompt += `\n`;
  }

  if (recentMessages.length > 0) {
    prompt += `Recent Conversation:\n`;
    recentMessages.forEach((msg) => {
      prompt += `${msg.role}: ${JSON.stringify(msg.content)}\n`;
    });
    prompt += `\n`;
  }

  if (seedPrompt) {
    prompt += `User Request: ${seedPrompt}\n\n`;
  } else {
    prompt += `Please provide an exploratory analysis of this brand, including:\n`;
    prompt += `1. Brand positioning and identity (with musical/sonic implications)\n`;
    prompt += `2. Target audience insights (with musical preferences and sonic associations)\n`;
    prompt += `3. Tone and personality recommendations (with specific musical directions)\n`;
    prompt += `4. Visual and messaging themes (with corresponding sonic elements)\n`;
    prompt += `5. Brand promise and value proposition (with musical expression ideas)\n`;
    prompt += `6. Practical constraints and considerations (including audio production constraints)\n`;
  }

  prompt += `\nIMPORTANT: Every section must include potential musical ideas, sonic concepts, instrumentation suggestions, tempo/mood recommendations, and production aesthetics. The goal is to generate music, so connect every brand insight to concrete musical directions. Format text using markdown for better readability.\n\nProvide a comprehensive, structured analysis in JSON format.`;

  return prompt;
}

/**
 * Call Perplexity API for exploratory analysis
 */
export interface PerplexityCallOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: Record<string, any>;
  maxRetries?: number;
}

export async function callPerplexityExploratory(
  messages: PerplexityMessage[],
  options: PerplexityCallOptions = {}
): Promise<PerplexityResponse> {
  const response = await perplexityRequest(
    {
      model: options.model ?? 'sonar-pro',
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 4000,
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
    },
    {
      maxRetries: options.maxRetries ?? 4,
    }
  );

  return response as PerplexityResponse;
}

export async function streamExploratoryCompletion(
  messages: PerplexityMessage[],
  options: Omit<PerplexityCallOptions, 'responseFormat'> = {}
): Promise<AsyncIterable<PerplexityStreamChunk>> {
  return streamPerplexityCompletion(
    {
      model: options.model ?? 'sonar-pro',
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 4000,
    },
    {
      maxRetries: options.maxRetries ?? 4,
    }
  );
}

/**
 * Parse Perplexity response and extract findings
 */
export function parseExploratoryResponse(
  response: PerplexityResponse
): Record<string, any> {
  const content = response.choices[0]?.message?.content || '';

  try {
    // Try to parse as JSON first
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // If not JSON, structure the text response
    return {
      rawResponse: content,
      structured: {
        positioning: extractSection(content, 'positioning', 'Positioning'),
        targetAudience: extractSection(content, 'target audience', 'Target Audience'),
        tonePersonality: extractSection(content, 'tone', 'Tone'),
        visualThemes: extractSection(content, 'visual', 'Visual'),
        brandPromise: extractSection(content, 'promise', 'Brand Promise'),
        constraints: extractSection(content, 'constraint', 'Constraints'),
      },
    };
  } catch (error) {
    // Fallback to raw response
    return {
      rawResponse: content,
      error: 'Failed to parse response',
    };
  }
}

function extractSection(content: string, keyword: string, sectionName: string): string {
  const regex = new RegExp(
    `(?:${sectionName}|${keyword})[\\s:]*([^\\n]+(?:\\n(?!\\d+\\.|\\n|${sectionName})[^\\n]+)*)`,
    'i'
  );
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

