import { ConversationSnapshot } from './snapshots';
import { perplexityRequest } from './perplexity-client';

export interface MusicalDescription {
  title: string;
  musical_elements: string;
  elevenlabs_prompt: string; // Optimized prompt for ElevenLabs music generation
  feel?: string;
  emotional_effect?: string;
}

export interface CompositionPlan {
  positive_global_styles: string[];
  negative_global_styles: string[];
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

Your role: Translate brand insights into sonic strategy (Section 2) and fully-scoped jingle 
concepts (Section 3).

## SECTION 2: ARTISTIC RATIONALE (200-300 words)

Before detailing individual jingles, write an "Artistic Rationale" section that bridges the 
brand findings to the musical concepts.

**Structure:**

1. **Opening statement**: Identify the brand duality or creative challenge
   - Example: "Dognosis is a curious hybrid: it must sound like a laboratory you can trust 
     and a partnership you can love."

2. **Musical translation** (bullet format):
   - Show how each brand quality translates to sonic language
   - Format: [Brand quality] → [Sonic approach]
   - Example:
     • "Precision & data → clean, subtle electronic textures, steady pulses or patterns 
       that suggest measurement and reliability."
     • "Canine partnership & care → organic breath, sniff, and animal sounds used 
       respectfully as musical gestures; warm harmonic colors that feel comforting 
       rather than clinical."

3. **Signature sound elements**:
   - Identify 2-4 non-obvious sonic ideas unique to this brand
   - Example: "Sampling both the sniff and the EEG waveform"
   - Example: "Turn the sniff into a rhythm"
   - Example: "Heartbeat rhythm locks with dog's sniff on upbeat"

4. **Variation strategy**:
   - Explain how different jingles will serve different contexts
   - Example: "Investor-facing pieces will favour measured, dignified tones; public outreach 
     will tilt softer and more human."

5. **Throughline statement**:
   - What stays consistent across all concepts?
   - Example: "Across all five concepts the throughline is the same: science as hopeful, 
     dogs as collaborators, and detection as a gentle act of care."

---

## SECTION 3: FINAL JINGLE CONCEPTS

Create 5 distinct jingle concepts following this format for each:

### For Each Jingle:

**1. Concept Name & Tagline**
- Evocative name that tells a story (not "Version 1" or "Upbeat Jingle")
- Short tagline in quotes capturing essence
- **Examples**: 
  - "The Neural Symphony — 'The sound of discovery'"
  - "Sniff-Rhythm — 'The heartbeat of curiosity'"
  - "Heartbeat & Nose — 'Life, listened to'"

**2. Musical Description** (150-200 words narrative)
Write a sensory journey that includes:
- **Opening moment**: How does it start? What's the first sound?
- **Key signature element**: What makes this concept unique? (use signature sounds from Section 2)
- **Development**: How does it progress? What layers in?
- **Emotional arc**: What journey does the listener experience?
- **Resolution**: How does it conclude? What feeling remains?

**Style guidelines**:
- Use metaphorical, sensory language (not just technical specs)
- Include light timing references ("From that breath, delicate tones unfurl...")
- Mention specific sonic elements (instruments, textures, signature sounds)
- Connect music to brand meaning throughout

**Example**:
"Imagine the dog's nose as the starting point of a story: a single, curious sniff opens a 
quiet room. From that breath, delicate tones unfurl — not random beeps but drawn from the 
signals of detection. These tones are shaped by the dog's own brain signals (we use the 
waveform as an audio starting point), so the music has an organic intelligence: it breathes, 
pauses, then resolves into a hopeful, rising phrase."

**3. Emotional Effect** (one sentence, 10-15 words)
- Capture the precise feeling this concept evokes
- **Examples**:
  - "Every step of the diagnosis made to music — thoughtful, slightly wondrous."
  - "Approachable competence — humanizing the dog without trivializing the science."
  - "Warmly emotional, quietly urgent in a hopeful way."

---

### After All 5 Concepts, Include:

**Keywords** (5-7 adjectives, lowercase):
Example: "scientific humane measured hopeful credible"

**How It Sounds (Imagery)** (one paragraph):
Summarize the overall sonic approach across all concepts.
Example: "Each concept keeps the dog at the center — respected, audible, and treated as 
collaborator — while letting the technological rigor of DogSense and DogOS read clearly 
through sound."

**Why This Will Work** (3-4 bullet points):
Strategic justification covering:
- Brand alignment and positioning
- Audience flexibility and context adaptation
- Unique approach or competitive differentiation
- How it maintains consistency while varying

Example:
- "Combines precise, trustworthy electronic language with humane canine presence, aligning 
  with brand's scientific credibility and compassion."
- "Flexible tone across audiences — dignified for investors; softer and human for public 
  outreach — while maintaining a consistent sonic identity."

---

## QUALITY REQUIREMENTS:

**For Section 2 (Artistic Rationale)**:
- Must identify signature sound elements specific to this brand (not generic)
- Must explain the brand duality or tension being resolved
- Must preview how concepts will vary for different audiences

**For Section 3 (Jingle Concepts)**:
- Each concept must be conceptually distinct (not just tempo/energy variations)
- At least 2-3 concepts must use brand-specific signature sounds from Section 2
- Concept names must be evocative and brand-connected
- Musical descriptions must use sensory language and narrative structure
- Emotional effects must be specific to brand story (not generic like "upbeat" or "calm")
- The set of 5 should feel cohesive yet distinctly varied

Always return strictly valid JSON that follows the requested schema, with Section 2 and 
Section 3 properly structured.`;

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
            elevenlabs_prompt: { type: 'string' },
            feel: { type: 'string' },
            emotional_effect: { type: 'string' },
          },
          required: ['title', 'musical_elements', 'elevenlabs_prompt'],
        },
        description2: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            musical_elements: { type: 'string' },
            elevenlabs_prompt: { type: 'string' },
            feel: { type: 'string' },
            emotional_effect: { type: 'string' },
          },
          required: ['title', 'musical_elements', 'elevenlabs_prompt'],
        },
        description3: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            musical_elements: { type: 'string' },
            elevenlabs_prompt: { type: 'string' },
            feel: { type: 'string' },
            emotional_effect: { type: 'string' },
          },
          required: ['title', 'musical_elements', 'elevenlabs_prompt'],
        },
        description4: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            musical_elements: { type: 'string' },
            elevenlabs_prompt: { type: 'string' },
            feel: { type: 'string' },
            emotional_effect: { type: 'string' },
          },
          required: ['title', 'musical_elements', 'elevenlabs_prompt'],
        },
        description5: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            musical_elements: { type: 'string' },
            elevenlabs_prompt: { type: 'string' },
            feel: { type: 'string' },
            emotional_effect: { type: 'string' },
          },
          required: ['title', 'musical_elements', 'elevenlabs_prompt'],
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
      },
      required: ['positive_global_styles', 'negative_global_styles'],
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
      "elevenlabs_prompt": "... (optimized prompt for ElevenLabs music generation API - concise, focused on musical elements, tempo, mood, and instrumentation. Should be ready to use directly with ElevenLabs without modification)",
      "feel": "... (optional: BPM and mood, e.g., '~90 BPM, steady, grounded')",
      "emotional_effect": "... (optional: what emotion it evokes, e.g., 'Feels grounding and sacred — a dawn-lit sanctuary')"
    },
    "description2": {
      "title": "...",
      "musical_elements": "...",
      "elevenlabs_prompt": "...",
      "feel": "...",
      "emotional_effect": "..."
    },
    "description3": {
      "title": "...",
      "musical_elements": "...",
      "elevenlabs_prompt": "...",
      "feel": "...",
      "emotional_effect": "..."
    },
    "description4": {
      "title": "...",
      "musical_elements": "...",
      "elevenlabs_prompt": "...",
      "feel": "...",
      "emotional_effect": "..."
    },
    "description5": {
      "title": "...",
      "musical_elements": "...",
      "elevenlabs_prompt": "...",
      "feel": "...",
      "emotional_effect": "..."
    },
    "keywords": ["..."],
    "imagery": "...",
    "why_it_works": ["..."]
  },
    "composition_plan": {
      "positive_global_styles": ["...", "..."],
      "negative_global_styles": ["...", "..."]
    }
}

CRITICAL REQUIREMENTS:

For the "jingle" object:
- You MUST provide exactly 5 distinct musical descriptions (description1 through description5). Each should be a unique sonic concept with:
  - A descriptive title that captures the essence
  - Detailed musical_elements describing instrumentation, vocals, production techniques, and sonic textures (for PDF report)
  - REQUIRED elevenlabs_prompt: A concise, optimized prompt specifically designed for ElevenLabs music generation API. This should:
    * Be ready to use directly without modification
    * Focus on musical elements, tempo, mood, instrumentation, and production style
    * Be clear and specific (e.g., "Upbeat electronic track at 125 BPM with driving synth bass, crisp hi-hats, and uplifting major-key melodies. Features layered percussion and modern production with a motivational, energetic feel")
    * Avoid financial/payment terms (no "cash-register", "POS systems", "transaction", "checkout", "payment")
    * Be concise but descriptive (aim for 100-300 characters)
  - Optional hook (vocal tagline or catchphrase)
  - Optional feel (BPM range and mood description)
  - Optional emotional_effect (what emotional response it creates)
- Each description should offer a different sonic approach to the brand, providing variety and options for different use cases (ads, retail, social media, etc.).

For the "composition_plan" object:
1. The composition_plan provides global style guidance (no sections required).
2. positive_global_styles: List of musical styles that should be present throughout (e.g., "uplifting", "modern", "energetic").
3. negative_global_styles: List of styles to avoid throughout (e.g., "dark", "aggressive", "chaotic").

IMPORTANT: Every brand_findings field must include potential musical ideas, sonic concepts, and audio branding recommendations. The goal is to generate music, so connect every brand insight to concrete musical directions.

The elevenlabs_prompt in each description is the primary input for music generation - make it clear, specific, and optimized for the ElevenLabs API.

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
      if (!desc.elevenlabs_prompt || desc.elevenlabs_prompt.trim().length === 0) {
        throw new Error(`Description ${i + 1} is missing required field: elevenlabs_prompt is required`);
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

