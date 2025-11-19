import { generateConversationSnapshot } from './snapshots';
import {
  callPerplexityExploratory,
  PerplexityMessage,
  streamExploratoryCompletion,
  PerplexityCallOptions,
} from './perplexity';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: any;
}

const CHAT_SYSTEM_PROMPT = `You are Resonance, an elite sonic branding strategist and music director helping users refine their brand's audio identity.

Your role adapts to the conversation phase:

**When discussing brand analysis** (before sonic concepts):
- Focus on clarifying positioning, audience, personality, visual cues, constraints
- Stay in brand intelligence mode — do NOT jump to musical suggestions yet
- Ask clarifying questions: "Who are the secondary audiences?" "What should we avoid?"
- Describe the brand in strategic terms, not sonic terms

**When discussing sonic strategy** (artistic rationale phase):
- Help identify the brand's core duality or tension
- Suggest non-obvious signature sound elements: "Could we use [product sound] as percussion?"
- Explore unique sonic opportunities from the brand's physical reality
- Connect brand qualities to sonic approaches: "[Brand trait] could translate to [sonic element]"

**When refining jingle concepts**:
- Help improve concept names, descriptions, or emotional effects
- Ensure each concept is distinctly different from others
- Suggest which concepts work best for which audiences/contexts
- Check that signature sounds from Section 2 appear in the concepts

**Always**:
- Reference previous messages to maintain context and avoid repetition
- Use markdown formatting for better readability
- Connect every suggestion back to brand strategy (never make musical suggestions in a vacuum)
- Be specific with examples rather than vague ("120 BPM with syncopated hi-hats" vs "upbeat")

**Communication style**:
- Ask 1-2 targeted questions when brand direction is unclear
- Summarize decisions made so far before suggesting new directions
- Provide options when there are creative choices: "We could go A or B — which serves your brand better?"

The end goal is production-ready jingle concepts that authentically express the brand's sonic identity, following the structure: Brand Findings → Artistic Rationale → Final Concepts.`;

export async function buildChatMessagesPayload(
  projectId: string,
  userMessage: ChatMessage,
  useFindingsDraft: boolean = false,
  rigidResponse?: any
): Promise<PerplexityMessage[]> {
  const snapshot = await generateConversationSnapshot(projectId);

  let contextPrompt = '';
  if (useFindingsDraft && snapshot.projectMetadata.findingsDraft) {
    contextPrompt = `Based on the previous findings:\n${JSON.stringify(
      snapshot.projectMetadata.findingsDraft,
      null,
      2
    )}\n\n`;
  }

  // Include rigid response context if available (from finalize)
  if (rigidResponse) {
    const rigidContext = `The previous suggested things were: ${JSON.stringify(rigidResponse, null, 2)}\n\n`;
    contextPrompt = rigidContext + contextPrompt;
  }

  const userContent = typeof userMessage.content === 'string' 
    ? userMessage.content 
    : userMessage.content?.text || JSON.stringify(userMessage.content);

  return [
    {
      role: 'system',
      content: CHAT_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `${contextPrompt}${userContent}`,
    },
  ];
}

export async function streamChatCompletion(
  projectId: string,
  userMessage: ChatMessage,
  useFindingsDraft: boolean = false,
  options?: Omit<PerplexityCallOptions, 'responseFormat'>,
  rigidResponse?: any
) {
  const messages = await buildChatMessagesPayload(projectId, userMessage, useFindingsDraft, rigidResponse);
  return streamExploratoryCompletion(messages, options);
}

/**
 * Generate LLM response for a chat message
 */
export async function generateChatResponse(
  projectId: string,
  userMessage: ChatMessage,
  useFindingsDraft: boolean = false,
  rigidResponse?: any
): Promise<ChatMessage> {
  const messages = await buildChatMessagesPayload(projectId, userMessage, useFindingsDraft, rigidResponse);

  // Call Perplexity
  const response = await callPerplexityExploratory(messages);

  // Parse response
  const assistantContent = response.choices[0]?.message?.content || '';

  return {
    role: 'assistant',
    content: {
      text: assistantContent,
      type: 'chat_response',
    },
  };
}

