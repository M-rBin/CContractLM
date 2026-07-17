/**
 * 合同智能助手公共类型
 */

/** 意图分类 */
export type AgentIntent = 'query' | 'recognize' | 'navigate' | 'chat';

/** 消息内容类型 */
export type MessageContentType =
  | 'text'
  | 'table'
  | 'chart'
  | 'recognize'
  | 'navigate';

/** 助手回复内容（按 type 结构化） */
export interface AgentReplyContent {
  type: MessageContentType;
  /** 文字说明（各类型都可带一段解读/引导文字） */
  text?: string;
  /** 表格数据（type=table）：列头与行 */
  table?: { columns: string[]; rows: Array<Record<string, unknown>> };
  /** 导航指令（type=navigate） */
  navigate?: { path: string; query?: Record<string, string>; label: string };
}

/** 一次对话的完整回复 */
export interface AgentChatResult {
  /** 会话 ID（新建会话时回传） */
  sessionId: number;
  /** 识别到的意图 */
  intent: AgentIntent;
  /** 结构化回复内容 */
  reply: AgentReplyContent;
}
