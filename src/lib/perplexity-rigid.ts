import { ConversationSnapshot } from './snapshots';
import { perplexityRequest } from './perplexity-client';

export interface MusicalDescription {
  title: string;
  musical_elements: string;
  hook?: string;
  feel?: string;
  emotional_effect?: string;
}

export interface CompositionPlanSection {
  section_name: string;
  positive_local_styles: string[];
  negative_local_styles: string[];
  duration_ms: number; // 3000-120000
  lines?: string[]; // Optional, for lyrics (empty for instrumental)
}

export interface CompositionPlan {
  positive_global_styles: string[];
  negative_global_styles: string[];
  sections: CompositionPlanSection[];
}

export interface RigidJSONResponse {
  brand_findings: {
    positioning: string;
    target_audience: string;
    tone_personality: string;
    visual_tactile_cues: string;
    brand_promise: string;
    practical_constraints: string;
  };
  artistic_rationale: string;
  jingle: {
    concept_statement: string;
    description1: MusicalDescription;
    description2: MusicalDescription;
    description3: MusicalDescription;
    description4: MusicalDescription;
    description5: MusicalDescription;
    keywords: string[];
    imagery: string;
    why_it_works: string[];
  };
  composition_plan: CompositionPlan;
}

export const FINALIZE_SYSTEM_PROMPT = `You are Cadence, a hybrid music director and brand strategist.

- Translate brand insights into fully-scoped sonic narratives
- Recommend structures (intro/verse/chorus/bridge), vocal approach, instrumentation, tempo, and production notes
- Provide just enough specificity for a composer or generative model to execute without guesswork
- Always return strictly valid JSON that follows the requested schema`;

const RIGID_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    brand_findings: {
      type: 'object',
      properties: {
        positioning: { type: 'string' },
        target_audience: { type: 'string' },
        tone_personality: { type: 'string' },
        visual_tactile_cues: { type: 'string' },
        brand_promise: { type: 'string' },
        practical_constraints: { type: 'string' },
      },
      required: [
        'positioning',
        'target_audience',
        'tone_personality',
        'visual_tactile_cues',
        'brand_promise',
        'practical_constraints',
      ],
    },
    artistic_rationale: { type: 'string' },
    jingle: {
      type: 'object',
      properties: {
        concept_statement: { type: 'string' },
        description1: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            musical_elements: { type: 'string' },
            hook: { type: 'string' },
            feel: { type: 'string' },
            emotional_effect: { type: 'string' },
          },
          required: ['title', 'musical_elements'],
        },
        description2: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            musical_elements: { type: 'string' },
            hook: { type: 'string' },
            feel: { type: 'string' },
            emotional_effect: { type: 'string' },
          },
          required: ['title', 'musical_elements'],
        },
        description3: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            musical_elements: { type: 'string' },
            hook: { type: 'string' },
            feel: { type: 'string' },
            emotional_effect: { type: 'string' },
          },
          required: ['title', 'musical_elements'],
        },
        description4: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            musical_elements: { type: 'string' },
            hook: { type: 'string' },
            feel: { type: 'string' },
            emotional_effect: { type: 'string' },
          },
          required: ['title', 'musical_elements'],
        },
        description5: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            musical_elements: { type: 'string' },
            hook: { type: 'string' },
            feel: { type: 'string' },
            emotional_effect: { type: 'string' },
          },
          required: ['title', 'musical_elements'],
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
        },
        imagery: { type: 'string' },
        why_it_works: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['concept_statement', 'description1', 'description2', 'description3', 'description4', 'description5', 'keywords', 'imagery', 'why_it_works'],
    },
    composition_plan: {
      type: 'object',
      properties: {
        positive_global_styles: {
          type: 'array',
          items: { type: 'string' },
        },
        negative_global_styles: {
          type: 'array',
          items: { type: 'string' },
        },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              section_name: { type: 'string' },
              positive_local_styles: {
                type: 'array',
                items: { type: 'string' },
              },
              negative_local_styles: {
                type: 'array',
                items: { type: 'string' },
              },
              duration_ms: { type: 'integer' },
              lines: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: [
              'section_name',
              'positive_local_styles',
              'negative_local_styles',
              'duration_ms',
            ],
          },
        },
      },
      required: ['positive_global_styles', 'negative_global_styles', 'sections'],
    },
  },
  required: ['brand_findings', 'artistic_rationale', 'jingle', 'composition_plan'],
};

const RIGID_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'FinalizeJingleReport',
    schema: RIGID_RESPONSE_SCHEMA,
  },
};

/**
 * Build rigid prompt for finalize step
 */
export function buildRigidPrompt(
  snapshot: ConversationSnapshot,
  useFindingsDraft: boolean = false
): string {
  const { projectMetadata, recentMessages, fileSummaries } = snapshot;

  let prompt = `You are a brand strategist generating a structured jingle report. 

Brand Information:
- Brand Name: ${projectMetadata.brandName}
- Website: ${projectMetadata.brandWebsite}

IMPORTANT: Please visit and analyze the website at ${projectMetadata.brandWebsite} to gather information about this brand, including their services, values, target audience, and brand personality. Use this information to inform your analysis. 

If the website is not accessible or has limited information, use the brand name to search for information about this brand online, including any reviews, social media presence, or local business listings.

`;

  if (useFindingsDraft && projectMetadata.findingsDraft) {
    prompt += `Use these findings as the basis:\n${JSON.stringify(
      projectMetadata.findingsDraft,
      null,
      2
    )}\n\n`;
  } else if (recentMessages.length > 0) {
    prompt += `Conversation Context:\n`;
    recentMessages.forEach((msg) => {
      prompt += `${msg.role}: ${JSON.stringify(msg.content)}\n`;
    });
    prompt += `\n`;
  }

  prompt += `Generate a structured JSON response with the following exact structure:
{
  "brand_findings": {
    "positioning": "... (include musical/sonic implications)",
    "target_audience": "... (include musical preferences and sonic associations)",
    "tone_personality": "... (include specific musical directions)",
    "visual_tactile_cues": "... (include corresponding sonic elements)",
    "brand_promise": "... (include musical expression ideas)",
    "practical_constraints": "... (include audio production constraints)"
  },
  "artistic_rationale": "...",
  "jingle": {
    "concept_statement": "... (e.g., 'Five sensory sonic ideas — weaving [brand themes] into an emotionally immersive brand experience')",
    "description1": {
      "title": "... (e.g., 'Sacred Circle — Ancient wisdom, modern trust')",
      "musical_elements": "... (detailed description of instrumentation, vocals, production, e.g., 'Begins with a Himalayan singing bowl, layered with soft finger snaps...')",
      "hook": "... (optional: vocal hook or tagline)",
      "feel": "... (optional: BPM and mood, e.g., '~90 BPM, steady, grounded')",
      "emotional_effect": "... (optional: what emotion it evokes, e.g., 'Feels grounding and sacred — a dawn-lit sanctuary')"
    },
    "description2": {
      "title": "...",
      "musical_elements": "...",
      "hook": "...",
      "feel": "...",
      "emotional_effect": "..."
    },
    "description3": {
      "title": "...",
      "musical_elements": "...",
      "hook": "...",
      "feel": "...",
      "emotional_effect": "..."
    },
    "description4": {
      "title": "...",
      "musical_elements": "...",
      "hook": "...",
      "feel": "...",
      "emotional_effect": "..."
    },
    "description5": {
      "title": "...",
      "musical_elements": "...",
      "hook": "...",
      "feel": "...",
      "emotional_effect": "..."
    },
    "keywords": ["..."],
    "imagery": "...",
    "why_it_works": ["..."]
  },
  "composition_plan": {
    "positive_global_styles": ["...", "..."],
    "negative_global_styles": ["...", "..."],
    "sections": [
      {
        "section_name": "... (e.g., 'Introduction', 'Verse', 'Chorus', 'Bridge', 'Outro')",
        "positive_local_styles": ["...", "..."],
        "negative_local_styles": ["...", "..."],
        "duration_ms": 6000,
        "lines": []
      }
    ]
  }
}

CRITICAL REQUIREMENTS:

For the "jingle" object:
- You MUST provide exactly 5 distinct musical descriptions (description1 through description5). Each should be a unique sonic concept with:
  - A descriptive title that captures the essence
  - Detailed musical_elements describing instrumentation, vocals, production techniques, and sonic textures
  - Optional hook (vocal tagline or catchphrase)
  - Optional feel (BPM range and mood description)
  - Optional emotional_effect (what emotional response it creates)
- Each description should offer a different sonic approach to the brand, providing variety and options for different use cases (ads, retail, social media, etc.).

For the "composition_plan" object:
1. The composition_plan must create a 30-second (30000ms) instrumental piece divided into multiple sections.
2. The total duration of all sections must equal 30000ms (30 seconds).
3. Each section should have a unique character that conveys the musical concept.
4. Use English language for all style descriptions.
5. positive_global_styles: List of musical styles that should be present throughout the entire song (e.g., "uplifting", "modern", "energetic").
6. negative_global_styles: List of styles to avoid throughout (e.g., "dark", "aggressive", "chaotic").
7. Each section should have:
   - section_name: A descriptive name (e.g., "Introduction", "Main Theme", "Build-up", "Climax", "Resolution")
   - positive_local_styles: Styles specific to this section (e.g., "gentle strings", "pulsing bass", "bright synths")
   - negative_local_styles: Styles to avoid in this section
   - duration_ms: Duration in milliseconds (must be between 3000 and 120000, and total must equal 30000)
   - lines: Empty array [] (since this is instrumental only)

IMPORTANT: Every brand_findings field must include potential musical ideas, sonic concepts, and audio branding recommendations. The goal is to generate music, so connect every brand insight to concrete musical directions.

The composition_plan should translate the brand's musical concepts into a structured plan that can be used to generate a 30-second instrumental piece with distinct sections. The jingle descriptions provide detailed creative guidance for the PDF report.

Return ONLY valid JSON, no markdown, no code blocks.`;

  return prompt;
}

/**
 * Call Perplexity rigid JSON endpoint
 */
export async function callPerplexityRigid(
  prompt: string,
  model: string = 'sonar-reasoning'
): Promise<RigidJSONResponse> {
  const response = (await perplexityRequest({
    model,
    messages: [
      {
        role: 'system',
        content: FINALIZE_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 12000,
    response_format: RIGID_RESPONSE_FORMAT,
  })) as {
    choices: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const data = response;
  const content = data.choices[0]?.message?.content || '{}';

  // Log the full response for debugging - use console.error to make it more visible
  console.error('=== Full Perplexity Rigid Response ===');
  console.error('Response length:', content.length);
  console.error('Full response content:');
  console.error(content);
  console.error('=== End of Perplexity Rigid Response ===');

  // Parse JSON response
  try {
    let jsonContent = content;
    
    // More aggressive removal of reasoning tags - handle various formats
    // First, try to remove complete tags (with closing tags)
    jsonContent = jsonContent.replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '');
    jsonContent = jsonContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    jsonContent = jsonContent.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    jsonContent = jsonContent.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Handle unclosed tags - remove everything from opening tag until we find a {
    // This is more aggressive - remove everything from tag start to first brace
    jsonContent = jsonContent.replace(/<think>[\s\S]*?(?=\{)/gi, '');
    jsonContent = jsonContent.replace(/<reasoning>[\s\S]*?(?=\{)/gi, '');
    jsonContent = jsonContent.replace(/<thinking>[\s\S]*?(?=\{)/gi, '');
    jsonContent = jsonContent.replace(/<think>[\s\S]*?(?=\{)/gi, '');
    
    // If there's still a tag at the start, find the first { and remove everything before it
    const firstBraceIndex = jsonContent.indexOf('{');
    if (firstBraceIndex > 0) {
      const beforeBrace = jsonContent.substring(0, firstBraceIndex);
      // Check for any reasoning-related tags
      if (/<[^>]*(reasoning|thinking|think)[^>]*>/i.test(beforeBrace)) {
        jsonContent = jsonContent.substring(firstBraceIndex);
      }
    }
    
    // Remove markdown code blocks if present
    jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to extract JSON object if there's text before it
    // Look for the first { that starts a JSON object
    const jsonStart = jsonContent.indexOf('{');
    if (jsonStart === -1) {
      throw new Error('No JSON object found in response');
    }
    
    if (jsonStart > 0) {
      jsonContent = jsonContent.substring(jsonStart);
    }
    
    // Try to find the end of the JSON object (matching braces)
    // This handles nested objects correctly
    let braceCount = 0;
    let jsonEnd = -1;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < jsonContent.length; i++) {
      const char = jsonContent[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
    
    if (jsonEnd === -1 || jsonEnd <= 0) {
      throw new Error('Could not find end of JSON object');
    }
    
    jsonContent = jsonContent.substring(0, jsonEnd);
    
    const parsed = JSON.parse(jsonContent) as RigidJSONResponse;
    
    // Validate that all 5 descriptions are present
    if (!parsed.jingle?.description1 || !parsed.jingle?.description2 || 
        !parsed.jingle?.description3 || !parsed.jingle?.description4 || 
        !parsed.jingle?.description5) {
      throw new Error('Missing required descriptions: all 5 descriptions (description1-5) must be present');
    }
    
    // Validate each description has required fields
    const descriptions = [
      parsed.jingle.description1,
      parsed.jingle.description2,
      parsed.jingle.description3,
      parsed.jingle.description4,
      parsed.jingle.description5,
    ];
    
    for (let i = 0; i < descriptions.length; i++) {
      const desc = descriptions[i];
      if (!desc.title || !desc.musical_elements) {
        throw new Error(`Description ${i + 1} is missing required fields: title and musical_elements are required`);
      }
    }
    
    // Validate composition_plan structure
    if (!parsed.composition_plan) {
      throw new Error('Missing required composition_plan');
    }
    
    if (!Array.isArray(parsed.composition_plan.positive_global_styles) || 
        parsed.composition_plan.positive_global_styles.length === 0) {
      throw new Error('composition_plan.positive_global_styles must be a non-empty array');
    }
    
    if (!Array.isArray(parsed.composition_plan.negative_global_styles)) {
      throw new Error('composition_plan.negative_global_styles must be an array');
    }
    
    if (!Array.isArray(parsed.composition_plan.sections) || 
        parsed.composition_plan.sections.length === 0) {
      throw new Error('composition_plan.sections must be a non-empty array');
    }
    
    // Validate each section
    let totalDuration = 0;
    for (let i = 0; i < parsed.composition_plan.sections.length; i++) {
      const section = parsed.composition_plan.sections[i];
      if (!section.section_name) {
        throw new Error(`Section ${i + 1} is missing section_name`);
      }
      if (!Array.isArray(section.positive_local_styles) || 
          section.positive_local_styles.length === 0) {
        throw new Error(`Section ${i + 1} must have non-empty positive_local_styles array`);
      }
      if (!Array.isArray(section.negative_local_styles)) {
        throw new Error(`Section ${i + 1} must have negative_local_styles array`);
      }
      if (typeof section.duration_ms !== 'number' || 
          section.duration_ms < 3000 || 
          section.duration_ms > 120000) {
        throw new Error(`Section ${i + 1} duration_ms must be between 3000 and 120000`);
      }
      totalDuration += section.duration_ms;
    }
    
    // Validate total duration is approximately 30 seconds (allow some flexibility)
    if (totalDuration < 25000 || totalDuration > 35000) {
      throw new Error(`Total duration must be approximately 30000ms (30 seconds), got ${totalDuration}ms`);
    }
    
    return parsed;
  } catch (error) {
    // Try one more time with a more robust approach
    try {
      // First, try to remove all reasoning tags more aggressively
      let cleanedContent = content;
      cleanedContent = cleanedContent.replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '');
      cleanedContent = cleanedContent.replace(/<think>[\s\S]*?(?=\{)/gi, '');
      cleanedContent = cleanedContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
      cleanedContent = cleanedContent.replace(/<reasoning>[\s\S]*?(?=\{)/gi, '');
      cleanedContent = cleanedContent.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
      cleanedContent = cleanedContent.replace(/<think>[\s\S]*?<\/think>/gi, '');
      
      // Find the first { and extract from there
      const firstBrace = cleanedContent.indexOf('{');
      if (firstBrace === -1) {
        throw new Error('No opening brace found');
      }
      
      cleanedContent = cleanedContent.substring(firstBrace);
      
      // Find matching closing brace
      let braceCount = 0;
      let endPos = -1;
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < cleanedContent.length; i++) {
        const char = cleanedContent[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (inString) continue;
        
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            endPos = i + 1;
            break;
          }
        }
      }
      
      if (endPos === -1) {
        throw new Error('No matching closing brace found');
      }
      
      const jsonStr = cleanedContent.substring(0, endPos);
      return JSON.parse(jsonStr) as RigidJSONResponse;
    } catch (e) {
      // Log the actual error for debugging
      console.error('JSON parsing error in fallback:', e);
      console.error('Content preview (first 2000 chars):', content.substring(0, 2000));
      console.error('Content preview (last 2000 chars):', content.substring(Math.max(0, content.length - 2000)));
      
      // Try one final approach: find all potential JSON objects in the content
      const jsonMatches = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      if (jsonMatches && jsonMatches.length > 0) {
        // Try the longest match (most likely to be complete)
        const longestMatch = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
        try {
          const parsed = JSON.parse(longestMatch) as RigidJSONResponse;
          console.error('Successfully parsed JSON using fallback extraction');
          return parsed;
        } catch (parseError) {
          console.error('Fallback JSON extraction also failed:', parseError);
        }
      }
      
      // Fall through to original error
    }
    throw new Error(`Failed to parse Perplexity response as JSON: ${content.substring(0, 500)}...`);
  }
}

