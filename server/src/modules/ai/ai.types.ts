/**
 * AI 能力模块公共类型
 */

/** 支持的 AI 服务提供商 */
export type AiProvider =
  | 'openai'
  | 'anthropic'
  | 'qwen'
  | 'deepseek'
  | 'openai-compatible';

/** 调用 AI 服务所需的配置（明文密钥，调用前由上层解密） */
export interface AiCallConfig {
  /** 提供商 */
  provider: AiProvider;
  /** 模型名称 */
  model: string;
  /** 明文访问密钥 */
  apiKey: string;
  /** 服务地址（openai-compatible 必填；其余可覆盖默认地址） */
  baseUrl?: string;
  /** 模型类型：text=文本模型（默认）vision=视觉模型（直接走图片识别路径） */
  modelType?: 'text' | 'vision';
}

/** 对话消息内容块（视觉消息用） */
export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/** 对话消息 */
export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  /** 纯文本消息直接传字符串；视觉消息传 AiContentPart 数组 */
  content: string | AiContentPart[];
}

/** chat 调用可选参数 */
export interface AiChatOptions {
  /** 温度，默认 0.2（偏确定性） */
  temperature?: number;
  /** 最大输出 token */
  maxTokens?: number;
  /** 超时（毫秒），默认取环境变量 AI_CALL_TIMEOUT_MS 或 30000 */
  timeoutMs?: number;
}
