import {
  BadGatewayException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  AiCallConfig,
  AiChatOptions,
  AiMessage,
  AiProvider,
} from '../ai.types';

/**
 * AI Provider 适配层
 *
 * 统一封装对多家大模型服务的调用，业务层只需提供配置与消息，
 * 无需感知不同提供商的接口差异。使用 Node 原生 fetch（Node 18+），
 * 通过 AbortController 施加超时，所有下游异常归一化为 502（BadGateway）。
 *
 * 提供商分两类接口形态：
 *  - OpenAI 兼容（openai / deepseek / qwen / openai-compatible）：/chat/completions
 *  - Anthropic：/messages
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  /** 各提供商默认服务地址（openai-compatible 无默认，必须显式提供 baseUrl） */
  private readonly defaultBaseUrls: Record<AiProvider, string | null> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    deepseek: 'https://api.deepseek.com/v1',
    'openai-compatible': null,
  };

  /**
   * 通用对话调用，返回完整文本。
   * @param config AI 配置（明文密钥）
   * @param messages 对话消息列表
   * @param options 可选参数
   * @returns 模型返回的文本内容
   */
  async chat(
    config: AiCallConfig,
    messages: AiMessage[],
    options: AiChatOptions = {},
  ): Promise<string> {
    if (config.provider === 'anthropic') {
      return this.callAnthropic(config, messages, options);
    }
    return this.callOpenAiCompatible(config, messages, options);
  }

  /**
   * 合同识别专用调用：给定系统提示与合同文本，要求模型返回 JSON。
   * @returns 模型返回的原始文本（期望为 JSON 字符串，由上层解析）
   */
  async recognize(
    config: AiCallConfig,
    systemPrompt: string,
    contractText: string,
    options: AiChatOptions = {},
  ): Promise<string> {
    return this.chat(
      config,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contractText },
      ],
      options,
    );
  }

  /**
   * 连接测试：用最小请求验证配置是否可用。
   * @returns 成功返回 true；失败抛出 BadGatewayException
   */
  async testConnection(config: AiCallConfig): Promise<boolean> {
    await this.chat(
      config,
      [{ role: 'user', content: 'ping' }],
      { maxTokens: 8, timeoutMs: 15000 },
    );
    return true;
  }

  /** 解析实际使用的服务地址 */
  private resolveBaseUrl(config: AiCallConfig): string {
    const base = config.baseUrl?.trim() || this.defaultBaseUrls[config.provider];
    if (!base) {
      throw new BadGatewayException('缺少服务地址：openai-compatible 提供商必须配置服务地址');
    }
    return base.replace(/\/+$/, '');
  }

  /** 带超时的 fetch 封装，超时或网络异常统一转 502 */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (e) {
      const msg = e instanceof Error && e.name === 'AbortError'
        ? `AI 服务请求超时（超过 ${timeoutMs}ms）`
        : 'AI 服务网络请求失败';
      this.logger.error(msg, e instanceof Error ? e.message : undefined);
      throw new BadGatewayException(msg);
    } finally {
      clearTimeout(timer);
    }
  }

  /** OpenAI 兼容接口调用（openai / deepseek / qwen / openai-compatible） */
  private async callOpenAiCompatible(
    config: AiCallConfig,
    messages: AiMessage[],
    options: AiChatOptions,
  ): Promise<string> {
    const timeoutMs = options.timeoutMs ?? Number(process.env.AI_CALL_TIMEOUT_MS || 30000);
    const url = `${this.resolveBaseUrl(config)}/chat/completions`;
    const body = {
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.2,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    };
    const res = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
    const data = await this.parseJsonOrThrow(res);
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new BadGatewayException('AI 服务返回内容格式异常');
    }
    return content;
  }

  /** Anthropic Messages 接口调用 */
  private async callAnthropic(
    config: AiCallConfig,
    messages: AiMessage[],
    options: AiChatOptions,
  ): Promise<string> {
    const timeoutMs = options.timeoutMs ?? Number(process.env.AI_CALL_TIMEOUT_MS || 30000);
    const url = `${this.resolveBaseUrl(config)}/messages`;
    // Anthropic 将 system 独立传参，其余消息保留 user/assistant
    const systemPrompt = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
    const body = {
      model: config.model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.2,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: chatMessages,
    };
    const res = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
    const data = await this.parseJsonOrThrow(res);
    const content = data?.content?.[0]?.text;
    if (typeof content !== 'string') {
      throw new BadGatewayException('AI 服务返回内容格式异常');
    }
    return content;
  }

  /** 解析响应 JSON，非 2xx 或解析失败统一转 502 并记录脱敏日志 */
  private async parseJsonOrThrow(res: Response): Promise<any> {
    const text = await res.text();
    if (!res.ok) {
      // 记录状态码与截断的响应体，避免泄露密钥（密钥在请求头，不在响应体）
      this.logger.error(
        `AI 服务返回错误状态 ${res.status}：${text.slice(0, 300)}`,
      );
      throw new BadGatewayException(`AI 服务调用失败（状态码 ${res.status}）`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new BadGatewayException('AI 服务返回内容无法解析');
    }
  }
}
