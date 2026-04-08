export type ChatHistoryRole = 'user' | 'assistant';

export interface ChatHistoryMessage {
  role: ChatHistoryRole;
  content: string;
}

type LegacyContext = string[];

function isChatHistoryMessage(value: unknown): value is ChatHistoryMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ChatHistoryMessage>;
  return (
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string' &&
    candidate.content.trim().length > 0
  );
}

function fromLegacyContext(context: LegacyContext): ChatHistoryMessage[] {
  return context
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((content) => ({
      role: 'user' as const,
      content,
    }));
}

export function normalizeSessionContext(context: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(context) || context.length === 0) {
    return [];
  }

  if (typeof context[0] === 'string') {
    return fromLegacyContext(context as LegacyContext);
  }

  return context.filter(isChatHistoryMessage);
}

export function trimConversationHistory(
  history: ChatHistoryMessage[],
  maxMessages: number,
): ChatHistoryMessage[] {
  if (maxMessages <= 0) {
    return [];
  }

  let trimmed = history.slice(-maxMessages);

  if (trimmed[0]?.role === 'assistant') {
    trimmed = trimmed.slice(1);
  }

  return trimmed;
}

export function appendConversationTurn(
  history: ChatHistoryMessage[],
  userMessage: string,
  assistantMessage: string,
  maxMessages: number,
): ChatHistoryMessage[] {
  const nextHistory = [
    ...history,
    { role: 'user' as const, content: userMessage },
    { role: 'assistant' as const, content: assistantMessage },
  ].filter((message) => message.content.trim().length > 0);

  return trimConversationHistory(nextHistory, maxMessages);
}
