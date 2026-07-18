import { BadRequestException, Injectable } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { AgentIntentService } from './agent-intent.service';
import { TextToSqlService } from './text-to-sql.service';
import { AgentNavigateService } from './agent-navigate.service';
import { AgentSessionService } from './agent-session.service';
import { AgentChatResult, AgentReplyContent } from '../agent/agent.types';

/**
 * 合同智能助手编排服务
 *
 * 编排单次对话：确保会话 → 归档用户消息 → 识别意图 →
 * 分派到问数/识别引导/导航/帮助处理器 → 归档助手回复 → 返回结构化结果。
 */
@Injectable()
export class AgentService {
  constructor(
    private readonly aiConfig: AiConfigService,
    private readonly intent: AgentIntentService,
    private readonly textToSql: TextToSqlService,
    private readonly navigate: AgentNavigateService,
    private readonly session: AgentSessionService,
  ) {}

  /**
   * 处理一次对话
   * @param userId 当前用户
   * @param sessionId 会话 ID（可空，为空则新建）
   * @param question 用户问题
   */
  async chat(
    userId: number,
    sessionId: number | undefined,
    question: string,
  ): Promise<AgentChatResult> {
    // 1. 取默认可用 AI 配置
    const config = await this.aiConfig.getActiveCallConfig();
    if (!config) {
      throw new BadRequestException('请先在系统设置中配置并启用 AI 服务');
    }

    // 2. 确保会话并归档用户消息
    const sid = await this.session.ensureSession(userId, sessionId, question);
    await this.session.appendUserMessage(sid, question);

    // 3. 识别意图
    const intent = await this.intent.detect(config, question);

    // 4. 分派处理
    let reply: AgentReplyContent;
    switch (intent) {
      case 'query':
        reply = await this.textToSql.ask(config, userId, question);
        break;
      case 'navigate':
        reply = await this.navigate.resolve(config, question);
        break;
      case 'recognize':
        reply = this.recognizeGuide();
        break;
      default:
        reply = this.chatGuide();
        break;
    }

    // 5. 归档助手回复
    await this.session.appendAssistantMessage(sid, reply);

    return { sessionId: sid, intent, reply };
  }

  /** 识别意图引导：第一版对话内不做上传，引导到智能录入页 */
  private recognizeGuide(): AgentReplyContent {
    return {
      type: 'navigate',
      text: '合同识别请前往「智能录入」页面上传 PDF，我来帮你自动识别并填入登记表单。',
      navigate: { path: '/contract/ai-import', label: '智能录入' },
    };
  }

  /** 帮助引导 */
  private chatGuide(): AgentReplyContent {
    return {
      type: 'text',
      text: '我可以帮你查询合同经营数据、识别合同、快速导航。试试问我「本月新增多少合同」「有哪些本周到期的合同」，或说「打开合同台账」。',
    };
  }
}
