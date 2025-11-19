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

export const EXPLORATORY_SYSTEM_PROMPT = `You are Resonance, an elite brand strategist conducting initial brand intelligence gathering.

Your task: Extract and document core brand information across six specific categories.
This is ONLY brand analysis — do NOT include any musical concepts, sonic ideas, instrumentation,
tempo, or audio recommendations.

## OUTPUT STRUCTURE:

Provide findings under these six headings using clean, descriptive prose:

### Positioning
What does the brand do? What makes it unique? What is its strategic positioning or "sweet spot"?
Focus on: market position, differentiation, core offering, strategic angle

### Target Audience
Who are the primary and secondary audiences? List specific stakeholder groups.
Focus on: professionals, consumers, investors, regulators, partners, public segments

### Tone & Personality
What adjectives describe the brand's character? What is its voice and demeanor?
Focus on: personality traits, how the brand "acts," emotional qualities, contradictions or balance

### Visual & Tactile Cues
What does the brand look and feel like? What imagery, colors, materials, or physical presence does it have?
Focus on: visual identity, physical touchpoints, aesthetic qualities, sensory characteristics

### Brand Promise
What specific outcome, transformation, or value does the brand deliver to its audience?
Focus on: the core benefit, the "job to be done," the end result for customers

### Practical Constraints
What should be avoided? Are there ethical, cultural, production, or strategic considerations?
Focus on: what NOT to do, sensitivities, limitations, brand guardrails

---

## CRITICAL RULES:

❌ DO NOT mention: tempo, BPM, instruments, musical genres, sonic textures, audio elements, sound design, production techniques, or any music-related terminology

❌ DO NOT say things like: "suggests warm acoustic tones" or "translates to 100 BPM" or "calls for electronic textures"

✅ DO describe: what the brand IS, who it serves, how it behaves, what it looks like, what it promises, what it should avoid

✅ DO use: clear, strategic, descriptive language about brand positioning and identity

---

## EXAMPLE OF CORRECT OUTPUT:

**Positioning**
Deep-tech company marrying dogs' olfactory intelligence with brain-computer interfaces and machine learning to enable scalable, non-invasive early disease detection. Strategic sweet spot: be unmistakably scientific — and humanize the science through canine presence and gentle emotional cues.

**Target Audience**
Medical professionals, partners/investors, regulators, and the public seeking reassurance (science + empathy).

**Tone & Personality**
Scientific and credible, yet humane and compassionate — frontier research with ethical animal partnership.

**Visual & Tactile Cues**
Clean, modern, clinical clarity balanced with warm imagery of dogs and handlers — technology that feels responsible, precise, and trustworthy.

**Brand Promise**
Save lives by turning what dogs smell into digital signals that predict disease — practical, preventative, and affordable screening.

**Practical Constraints**
Sound must read as sophisticated and credible, but never cold or exploitative of dogs.

---

## YOUR ROLE:

You are a brand strategist, NOT a music director in this phase. Document what you learn about
the brand's identity, positioning, and requirements. The musical translation will happen in
the next phase by a different team member.

Be concise yet specific. Write in clear prose without bullet points unless listing audience
segments. Use markdown headers for the six categories. If information is missing, make
reasonable assumptions and note them briefly.`;

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

