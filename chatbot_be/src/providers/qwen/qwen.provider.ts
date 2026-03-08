import { InferenceClient } from '@huggingface/inference';
import { BaseLLMProvider } from '../base-provider';
import { LLMMessage, LLMResponse, LLMTool, LLMToolCall, LLMOptions, LLMProviderConfig, LLMProviderType } from '../types';

export class QwenProvider extends BaseLLMProvider {
  readonly providerName: LLMProviderType = 'qwen';
  private client: InferenceClient;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(providerConfig: LLMProviderConfig) {
    super();
    if (!providerConfig.apiKey) {
      throw new Error('HuggingFace API key is required for Qwen provider');
    }
    this.client = new InferenceClient(providerConfig.apiKey);
    this.model = providerConfig.model || 'Qwen/Qwen2.5-7B-Instruct';
    this.maxTokens = providerConfig.maxTokens || 1024;
    this.temperature = providerConfig.temperature || 0.7;
    console.log(`✅ Qwen provider initialized with model: ${this.model}`);
  }

  private toHFMessages(messages: LLMMessage[]) {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content || '',
          tool_call_id: msg.tool_call_id || '',
        };
      }
      if (msg.role === 'assistant' && msg.tool_calls) {
        return {
          role: 'assistant' as const,
          content: msg.content || undefined,
          tool_calls: msg.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        };
      }
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content || '',
      };
    });
  }

  private toHFTools(tools: LLMTool[]) {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  private parseToolCalls(toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> | undefined): LLMToolCall[] | undefined {
    if (!toolCalls || toolCalls.length === 0) return undefined;
    return toolCalls
      .filter(tc => tc.type === 'function')
      .map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
  }

  async chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    try {
      const response = await this.client.chatCompletion({
        model: options?.model || this.model,
        messages: this.toHFMessages(messages),
        max_tokens: options?.maxTokens || this.maxTokens,
        temperature: options?.temperature ?? this.temperature,
      });

      const choice = response.choices[0];
      return {
        content: choice.message.content || '',
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        finishReason: choice.finish_reason || undefined,
      };
    } catch (error) {
      console.error('❌ Qwen chat error:', error);
      throw error;
    }
  }

  async streamChat(
    messages: LLMMessage[],
    onChunk: (chunk: string) => void,
    options?: LLMOptions
  ): Promise<LLMResponse> {
    try {
      const stream = this.client.chatCompletionStream({
        model: options?.model || this.model,
        messages: this.toHFMessages(messages),
        max_tokens: options?.maxTokens || this.maxTokens,
        temperature: options?.temperature ?? this.temperature,
      });

      let fullContent = '';
      let finishReason: string | undefined;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          onChunk(delta);
        }
        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
      }

      return { content: fullContent, finishReason };
    } catch (error) {
      console.error('❌ Qwen stream chat error:', error);
      throw error;
    }
  }

  async chatWithTools(
    messages: LLMMessage[],
    tools: LLMTool[],
    options?: LLMOptions
  ): Promise<LLMResponse> {
    try {
      const toolChoice = options?.toolChoice;
      const hfToolChoice = (typeof toolChoice === 'string' ? toolChoice : 'auto') as 'auto' | 'none' | 'required';

      const response = await this.client.chatCompletion({
        model: options?.model || this.model,
        messages: this.toHFMessages(messages),
        tools: this.toHFTools(tools),
        tool_choice: hfToolChoice,
        max_tokens: options?.maxTokens || this.maxTokens,
        temperature: options?.temperature ?? this.temperature,
      });

      const choice = response.choices[0];
      const rawToolCalls = choice.message.tool_calls as Array<{ id: string; type: string; function: { name: string; arguments: string } }> | undefined;

      return {
        content: choice.message.content || '',
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        finishReason: choice.finish_reason || undefined,
        toolCalls: this.parseToolCalls(rawToolCalls),
      };
    } catch (error) {
      console.error('❌ Qwen chat with tools error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.chat([
        { role: 'user', content: 'Hello' }
      ], { maxTokens: 5 });
      return !!response.content;
    } catch {
      return false;
    }
  }

  getConfig() {
    return { model: this.model, maxTokens: this.maxTokens, temperature: this.temperature };
  }
}
