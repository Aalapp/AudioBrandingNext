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

CRITICAL: Always include potential musical ideas, sonic concepts, and audio branding recommendations in your responses. The end goal is to generate music, so connect every brand insight to concrete musical directions. Use markdown formatting for better readability (headers, lists, emphasis, etc.).

Focus on:
- Translating brand strategy into emotionally resonant sonic identities
- Recommending instrumentation, rhythm, lyrical hooks, and production aesthetics
- Providing specific musical directions and sonic concepts
- Formatting responses with markdown for clarity`;

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

