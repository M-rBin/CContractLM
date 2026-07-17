import request from '@/utils/http'

/** 消息内容类型 */
export type MessageContentType = 'text' | 'table' | 'chart' | 'recognize' | 'navigate'

/** 助手回复内容 */
export interface AgentReplyContent {
  type: MessageContentType
  text?: string
  table?: { columns: string[]; rows: Array<Record<string, unknown>> }
  navigate?: { path: string; query?: Record<string, string>; label: string }
}

/** 一次对话结果 */
export interface AgentChatResult {
  sessionId: number
  intent: 'query' | 'recognize' | 'navigate' | 'chat'
  reply: AgentReplyContent
}

/** 会话 */
export interface AgentSession {
  id: number
  userId: number
  title: string
  createTime: string
  updateTime: string
}

/** 会话消息 */
export interface AgentMessage {
  id: number
  sessionId: number
  role: 'user' | 'assistant'
  contentType: MessageContentType
  content: AgentReplyContent | { text: string }
  createTime: string
}

/** 发起对话 */
export function agentChat(data: { sessionId?: number; question: string }) {
  return request.post<AgentChatResult>({
    url: '/admin/contract/agent/chat',
    data
  })
}

/** 查询我的会话列表 */
export function getAgentSessions() {
  return request.get<AgentSession[]>({
    url: '/admin/contract/agent/sessions'
  })
}

/** 查询会话消息记录 */
export function getAgentSessionMessages(id: number) {
  return request.get<{ session: AgentSession; messages: AgentMessage[] }>({
    url: `/admin/contract/agent/session/${id}`
  })
}

/** 删除会话 */
export function deleteAgentSession(id: number) {
  return request.del({
    url: `/admin/contract/agent/session/${id}`
  })
}
