import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { AgentReplyContent } from '../agent/agent.types';

/** 上下文保留的最近轮数（一问一答为一轮） */
const MAX_CONTEXT_ROUNDS = 10;

/**
 * 合同智能助手会话与消息管理服务
 *
 * 负责会话的创建、消息归档、上下文截断、会话列表/详情查询。
 * 所有查询都以 userId 隔离，用户只能访问自己的会话。
 */
@Injectable()
export class AgentSessionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 确保存在会话：传入 sessionId 则校验归属并返回；否则用首条问题创建新会话。
   * @param userId 当前用户
   * @param sessionId 已有会话 ID（可空）
   * @param firstQuestion 首条问题（新建会话时作标题）
   */
  async ensureSession(
    userId: number,
    sessionId: number | undefined,
    firstQuestion: string,
  ): Promise<number> {
    if (sessionId) {
      const session = await this.prisma.contractAgentSession.findFirst({
        where: { id: sessionId, userId },
      });
      if (!session) throw new NotFoundException('会话不存在');
      return session.id;
    }
    const title = firstQuestion.trim().slice(0, 50) || '新会话';
    const created = await this.prisma.contractAgentSession.create({
      data: { userId, title },
    });
    return created.id;
  }

  /** 追加一条用户消息 */
  async appendUserMessage(sessionId: number, text: string) {
    await this.prisma.contractAgentMessage.create({
      data: { sessionId, role: 'user', contentType: 'text', content: { text } },
    });
    await this.touchSession(sessionId);
  }

  /** 追加一条助手消息 */
  async appendAssistantMessage(sessionId: number, reply: AgentReplyContent) {
    await this.prisma.contractAgentMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        contentType: reply.type,
        content: reply as unknown as object,
      },
    });
    await this.touchSession(sessionId);
  }

  /** 取最近 N 轮上下文的文本消息（用于给模型做多轮理解） */
  async getRecentContext(sessionId: number): Promise<Array<{ role: string; text: string }>> {
    const rows = await this.prisma.contractAgentMessage.findMany({
      where: { sessionId },
      orderBy: { id: 'desc' },
      take: MAX_CONTEXT_ROUNDS * 2,
    });
    return rows
      .reverse()
      .map((r) => {
        const content = r.content as { text?: string };
        return { role: r.role, text: content?.text || '' };
      })
      .filter((m) => m.text);
  }

  /** 会话列表（仅本人，按更新时间倒序） */
  async listSessions(userId: number) {
    return this.prisma.contractAgentSession.findMany({
      where: { userId },
      orderBy: { updateTime: 'desc' },
    });
  }

  /** 会话消息详情（仅本人） */
  async getSessionMessages(userId: number, sessionId: number) {
    const session = await this.prisma.contractAgentSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('会话不存在');
    const messages = await this.prisma.contractAgentMessage.findMany({
      where: { sessionId },
      orderBy: { id: 'asc' },
    });
    return { session, messages };
  }

  /** 删除会话（仅本人，级联删除消息） */
  async deleteSession(userId: number, sessionId: number) {
    const session = await this.prisma.contractAgentSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('会话不存在');
    await this.prisma.contractAgentSession.delete({ where: { id: sessionId } });
  }

  /** 更新会话的 updateTime */
  private async touchSession(sessionId: number) {
    await this.prisma.contractAgentSession.update({
      where: { id: sessionId },
      data: { updateTime: new Date() },
    });
  }
}
