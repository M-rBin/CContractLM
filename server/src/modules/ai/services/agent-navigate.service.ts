import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiCallConfig } from '../ai.types';
import { AgentReplyContent } from '../agent/agent.types';

/** 可导航的目标页面（与前端合同菜单路由一致） */
const NAV_TARGETS: Array<{ path: string; label: string; keywords: string[] }> = [
  { path: '/contract/workbench', label: '合同工作台', keywords: ['工作台', '首页', '概览'] },
  { path: '/contract/ledger', label: '合同台账', keywords: ['台账', '合同列表', '所有合同', '合同管理'] },
  { path: '/contract/reminder', label: '履约提醒', keywords: ['提醒', '到期', '履约提醒'] },
  { path: '/contract/payment', label: '收付款管理', keywords: ['收付款', '收款', '付款', '回款'] },
  { path: '/contract/analysis', label: '经营分析', keywords: ['经营分析', '分析', '报表', '统计图'] },
  { path: '/contract/ai-import', label: '智能录入', keywords: ['智能录入', '识别合同', '上传合同'] },
];

/**
 * 智能导航解析服务
 *
 * 将导航类意图解析为具体的目标页面路由指令。先用关键词快速匹配，
 * 未命中再交给大模型从候选页面中择一。返回 navigate 类型回复，
 * 前端据此执行 router.push。
 */
@Injectable()
export class AgentNavigateService {
  private readonly logger = new Logger(AgentNavigateService.name);

  constructor(private readonly ai: AiService) {}

  /**
   * 解析导航目标
   * @param config AI 配置
   * @param question 用户问题
   */
  async resolve(config: AiCallConfig, question: string): Promise<AgentReplyContent> {
    // 1. 关键词快速匹配
    const byKeyword = this.matchByKeyword(question);
    if (byKeyword) {
      return this.toNavigateReply(byKeyword);
    }

    // 2. 交给大模型择一
    try {
      const path = await this.matchByAi(config, question);
      const target = NAV_TARGETS.find((t) => t.path === path);
      if (target) return this.toNavigateReply(target);
    } catch (e) {
      this.logger.warn(`导航 AI 匹配失败：${e instanceof Error ? e.message : e}`);
    }

    // 3. 无法确定，给引导
    const list = NAV_TARGETS.map((t) => t.label).join('、');
    return { type: 'text', text: `你想去哪个页面呢？我可以带你去：${list}。` };
  }

  private matchByKeyword(question: string) {
    const text = question.toLowerCase();
    return NAV_TARGETS.find((t) => t.keywords.some((k) => text.includes(k.toLowerCase())));
  }

  private async matchByAi(config: AiCallConfig, question: string): Promise<string> {
    const options = NAV_TARGETS.map((t) => `${t.path} = ${t.label}`).join('\n');
    const prompt = [
      '用户想要导航到某个页面。请从以下候选页面中选择最匹配的一个，只输出对应的 path，不要输出其他内容。',
      '候选页面：',
      options,
      '如果都不匹配，输出 none。',
    ].join('\n');
    const raw = await this.ai.chat(
      config,
      [
        { role: 'system', content: prompt },
        { role: 'user', content: question },
      ],
      { temperature: 0, maxTokens: 32 },
    );
    return raw.trim();
  }

  private toNavigateReply(target: { path: string; label: string }): AgentReplyContent {
    return {
      type: 'navigate',
      text: `即将为你打开「${target.label}」`,
      navigate: { path: target.path, label: target.label },
    };
  }
}
