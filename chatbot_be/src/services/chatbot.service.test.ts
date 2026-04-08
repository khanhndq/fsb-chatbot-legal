import { ChatbotService } from './chatbot.service';
import { LLMFactory } from '../providers/llm-factory';
import { chatbotToolExecutor } from '../common/functions';

jest.mock('../providers/llm-factory', () => ({
  LLMFactory: {
    getAvailableProviders: jest.fn(() => ['openai']),
    getProvider: jest.fn(),
  },
}));

jest.mock('../common/functions', () => ({
  chatbotTools: [],
  chatbotToolExecutor: jest.fn(),
}));

describe('ChatbotService', () => {
  const mockProvider = {
    providerName: 'openai',
    chat: jest.fn(),
    streamChat: jest.fn(),
    chatWithTools: jest.fn(),
    runWithTools: jest.fn(),
    streamChatWithTools: jest.fn(),
    testConnection: jest.fn(),
    getConfig: jest.fn(() => ({ model: 'gpt-4o-mini', maxTokens: 1024, temperature: 0.2 })),
  };

  const redisService = {
    getCachedResponse: jest.fn(),
    cacheChatbotResponse: jest.fn(),
    getSessionData: jest.fn(),
    storeSessionData: jest.fn(),
    getStats: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (LLMFactory.getProvider as jest.Mock).mockReturnValue(mockProvider);
    redisService.getCachedResponse.mockResolvedValue(null);
    redisService.getSessionData.mockResolvedValue(null);
    redisService.cacheChatbotResponse.mockResolvedValue(undefined);
    redisService.storeSessionData.mockResolvedValue(undefined);
    (chatbotToolExecutor as jest.Mock).mockResolvedValue(
      JSON.stringify({
        found: true,
        legal_provisions: { results: [] },
      }),
    );
  });

  it('forces the first OpenAI legal search to use law source for direct lookup questions', async () => {
    mockProvider.runWithTools.mockImplementation(
      async (
        messages: Array<{ role: string; content: string }>,
        _tools: unknown,
        executor: (name: string, args: Record<string, unknown>) => Promise<string>,
        options?: { maxToolCalls?: number },
      ) => {
        expect(options?.maxToolCalls).toBe(1);
        expect(messages).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Detected intent: definition'),
            }),
          ]),
        );
        await executor('search_legal', { query: 'Hợp đồng lao động là gì?' });
        return { content: 'Theo Điều 13 Bộ luật Lao động 2019...' };
      },
    );

    const service = new ChatbotService(redisService as any);
    await service.processMessage('session-1', 'Hợp đồng lao động là gì?', 'openai');

    expect(chatbotToolExecutor).toHaveBeenCalledWith(
      'search_legal',
      expect.objectContaining({
        query: 'Hợp đồng lao động là gì?',
        source_type: 'law',
        top_k: 3,
      }),
    );
  });

  it('uses broader top_k and intent-specific answer shaping for health insurance lookups', async () => {
    mockProvider.runWithTools.mockImplementation(
      async (
        messages: Array<{ role: string; content: string }>,
        _tools: unknown,
        executor: (name: string, args: Record<string, unknown>) => Promise<string>,
        options?: { maxToolCalls?: number },
      ) => {
        expect(options?.maxToolCalls).toBe(1);
        expect(messages).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Detected domain: health_insurance'),
            }),
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Detected intent: procedure'),
            }),
          ]),
        );
        await executor('search_legal', { query: 'Thủ tục cấp lại thẻ BHYT như thế nào?' });
        return { content: 'Bạn cần nộp hồ sơ đề nghị cấp lại thẻ BHYT...' };
      },
    );

    const service = new ChatbotService(redisService as any);
    await service.processMessage('session-health', 'Thủ tục cấp lại thẻ BHYT như thế nào?', 'openai');

    expect(chatbotToolExecutor).toHaveBeenCalledWith(
      'search_legal',
      expect.objectContaining({
        query: expect.stringContaining('hồ sơ'),
        original_query: 'Thủ tục cấp lại thẻ BHYT như thế nào?',
        source_type: 'law',
        top_k: 4,
      }),
    );
  });

  it('allows broader retrieval and one extra tool call for dispute-style questions', async () => {
    mockProvider.runWithTools.mockImplementation(
      async (
        _messages: unknown,
        _tools: unknown,
        executor: (name: string, args: Record<string, unknown>) => Promise<string>,
        options?: { maxToolCalls?: number },
      ) => {
        expect(options?.maxToolCalls).toBe(2);
        await executor('search_legal', { query: 'Nếu công ty sa thải trái luật tôi có thể kiện không?' });
        return { content: 'Bạn có thể khởi kiện nếu có căn cứ cho rằng việc sa thải trái luật.' };
      },
    );

    const service = new ChatbotService(redisService as any);
    await service.processMessage(
      'session-hybrid',
      'Nếu công ty sa thải trái luật tôi có thể kiện không?',
      'openai',
    );

    expect(chatbotToolExecutor).toHaveBeenCalledWith(
      'search_legal',
      expect.objectContaining({
        query: 'Nếu công ty sa thải trái luật tôi có thể kiện không?',
        top_k: 5,
      }),
    );
  });

  it('stores user and assistant messages together in session history', async () => {
    mockProvider.runWithTools.mockResolvedValue({
      content: 'Theo Điều 13 Bộ luật Lao động 2019...',
    });

    const service = new ChatbotService(redisService as any);
    await service.processMessage('session-2', 'Hợp đồng lao động là gì?', 'openai');

    expect(redisService.storeSessionData).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-2',
        lastMessage: 'Hợp đồng lao động là gì?',
        context: [
          { role: 'user', content: 'Hợp đồng lao động là gì?' },
          { role: 'assistant', content: 'Theo Điều 13 Bộ luật Lao động 2019...' },
        ],
      }),
    );
  });

  it('stores complete history after streaming responses', async () => {
    mockProvider.streamChatWithTools.mockImplementation(
      async (
        _messages: unknown,
        _tools: unknown,
        _executor: unknown,
        onChunk: (chunk: string) => void,
      ) => {
        onChunk('Theo Điều 13 ');
        onChunk('Bộ luật Lao động 2019...');
        return { content: 'Theo Điều 13 Bộ luật Lao động 2019...' };
      },
    );

    const service = new ChatbotService(redisService as any);
    await service.processMessageStream(
      'session-3',
      'Hợp đồng lao động là gì?',
      {
        onChunk: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn(),
      },
      'openai',
    );

    expect(redisService.storeSessionData).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-3',
        context: [
          { role: 'user', content: 'Hợp đồng lao động là gì?' },
          { role: 'assistant', content: 'Theo Điều 13 Bộ luật Lao động 2019...' },
        ],
      }),
    );
  });
});
