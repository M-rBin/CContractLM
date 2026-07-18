import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiCallConfig, AiMessage } from '../ai.types';
import { AgentIntent } from '../agent/agent.types';

/**
 * 意图识别服务
 *
 * 用一次大模型调用，将用户问题分类为四类意图：
 *  - query：经营数据问答（查合同/收付款/履约/提醒统计）
 *  - recognize：合同识别（用户想上传/识别合同）
 *  - navigate：页面导航（打开某页面、跳转到某列表）
 *  - chat：帮助引导（打招呼、问能做什么、无法归类）
 */
@Injectable()
export class AgentIntentService {
  private readonly logger = new Logger(AgentIntentService.name);

  constructor(private readonly ai: AiService) {}

  /**
   * 识别意图
   * @param config AI 配置
   * @param question 用户问题
   * @returns 意图分类
   */
  async detect(config: AiCallConfig, question: string): Promise<AgentIntent> {
    const messages: AiMessage[] = [
      { role: 'system', content: this.buildPrompt() },
      { role: 'user', content: question },
    ];
    try {
      const raw = await this.ai.chat(config, messages, {
        temperature: 0,
        maxTokens: 16,
      });
      return this.normalize(raw, question);
    } catch (e) {
      this.logger.warn(`意图识别失败，使用规则兜底：${e instanceof Error ? e.message : e}`);
      return this.detectByKeyword(question);
    }
  }

  /**
   * 关键词规则兜底（AI 不可用时使用）
   *
   * 优先级：navigate > recognize > query > chat
   */
  private detectByKeyword(question: string): AgentIntent {
    const q = question.trim();
    if (
      /打开|跳转|前往|去.*页|查看.*页/.test(q) &&
      /台账|列表|页面|模块|合同|收付款|履约|提醒|录入/.test(q)
    ) {
      return 'navigate';
    }
    if (/识别|解析|上传|读取/.test(q) && (/合同|文件/.test(q) || /pdf/i.test(q))) {
      return 'recognize';
    }
    if (
      /多少|几份|几个|统计|汇总|合计|金额|数量|本月|上月|本周|今年|去年|签约|到期|新增|逾期|未付|已付|履约/.test(
        q,
      )
    ) {
      return 'query';
    }
    return 'chat';
  }

  private buildPrompt(): string {
    return [
      '你是一个意图分类器。请判断用户输入属于以下哪一类，只输出一个英文单词，不要输出其他任何内容：',
      '- query：查询合同经营数据（包括：统计数量/金额、查看收付款、履约节点、提醒；"有哪些…合同"、"列出…合同"、"查…到期/逾期/未付"等明细查询也属于此类）',
      '- recognize：想要上传或识别合同文件',
      '- navigate：想要打开某个页面或跳转到某个列表（如"打开台账"、"去收付款页"）',
      '- chat：打招呼、询问功能、闲聊或无法归入以上类别',
      '',
      '只输出 query、recognize、navigate、chat 中的一个。',
    ].join('\n');
  }

  private normalize(raw: string, question: string): AgentIntent {
    const text = (raw || '').toLowerCase();
    if (text.includes('query')) return 'query';
    if (text.includes('recognize')) return 'recognize';
    if (text.includes('navigate')) return 'navigate';
    // AI 返回了无法识别的内容，降级到关键词规则兜底，避免误判为 chat
    this.logger.warn(`意图识别结果无法解析（raw="${(raw ?? '').slice(0, 40)}"），降级到关键词规则`);
    return this.detectByKeyword(question);
  }
}
