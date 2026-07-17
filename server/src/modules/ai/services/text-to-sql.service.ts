import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { AiService } from './ai.service';
import { ReadonlyDbService } from './readonly-db.service';
import { guardSql } from '../agent/sql-guard';
import { SCHEMA_PROMPT } from '../agent/schema-prompt';
import { AiCallConfig } from '../ai.types';
import { AgentReplyContent } from '../agent/agent.types';

/**
 * Text-to-SQL 经营数据问答服务
 *
 * 流程：AI 生成 SQL → SqlGuard 校验加固 → 只读连接执行 →
 * 结果 + 原问题再送 AI 生成解读 → 返回表格 + 解读。
 * 每次调用都落 SQL 审计（成功/拦截/失败）。
 */
@Injectable()
export class TextToSqlService {
  private readonly logger = new Logger(TextToSqlService.name);

  constructor(
    private readonly ai: AiService,
    private readonly readonlyDb: ReadonlyDbService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 处理一次经营数据问答
   * @param config AI 配置
   * @param userId 提问用户（审计用）
   * @param question 用户问题
   * @returns 结构化回复（表格 + 解读，或拦截/失败提示）
   */
  async ask(
    config: AiCallConfig,
    userId: number,
    question: string,
  ): Promise<AgentReplyContent> {
    // 1. 生成 SQL
    let generatedSql: string;
    try {
      generatedSql = await this.generateSql(config, question);
    } catch (e) {
      await this.audit(userId, question, null, 0, 'failed', e instanceof Error ? e.message : 'AI 生成失败');
      return { type: 'text', text: '抱歉，暂时无法处理这个问题，请稍后再试。' };
    }

    // 2. 安全校验
    const guard = guardSql(generatedSql);
    if (!guard.ok || !guard.safeSql) {
      await this.audit(userId, question, generatedSql, 0, 'blocked', guard.reason);
      return { type: 'text', text: this.blockedHint(guard.reason) };
    }

    // 3. 只读执行
    let rows: Array<Record<string, unknown>>;
    try {
      rows = await this.readonlyDb.executeReadonly(guard.safeSql);
    } catch (e) {
      await this.audit(userId, question, guard.safeSql, 0, 'failed', e instanceof Error ? e.message : '执行失败');
      return { type: 'text', text: '查询执行失败，请换个问法或稍后再试。' };
    }

    // 4. 审计成功
    await this.audit(userId, question, guard.safeSql, rows.length, 'success');

    // 5. 组装结果 + 解读
    return this.buildReply(config, question, rows);
  }

  /** 调用大模型生成 SQL */
  private async generateSql(config: AiCallConfig, question: string): Promise<string> {
    const raw = await this.ai.chat(
      config,
      [
        { role: 'system', content: SCHEMA_PROMPT },
        { role: 'user', content: question },
      ],
      { temperature: 0, maxTokens: 512 },
    );
    // 去掉可能的 markdown 代码块包裹
    return raw
      .replace(/```sql/gi, '')
      .replace(/```/g, '')
      .trim();
  }

  /** 组装表格 + AI 解读回复 */
  private async buildReply(
    config: AiCallConfig,
    question: string,
    rows: Array<Record<string, unknown>>,
  ): Promise<AgentReplyContent> {
    if (rows.length === 0) {
      return { type: 'text', text: '没有查询到符合条件的数据。' };
    }

    const columns = Object.keys(rows[0]);
    // 结果超 1000 条已被 LIMIT 截断，前端友好提示
    const truncatedHint = rows.length >= 1000 ? '（结果较多，仅展示前 1000 条）' : '';

    let interpretation = '';
    try {
      interpretation = await this.interpret(config, question, rows);
    } catch (e) {
      this.logger.warn(`结果解读失败：${e instanceof Error ? e.message : e}`);
      interpretation = '以下是查询结果：';
    }

    return {
      type: 'table',
      text: `${interpretation}${truncatedHint}`,
      table: { columns, rows: this.serializeRows(rows) },
    };
  }

  /** 结果 + 问题再送 AI 生成自然语言解读 */
  private async interpret(
    config: AiCallConfig,
    question: string,
    rows: Array<Record<string, unknown>>,
  ): Promise<string> {
    // 仅取前 50 行喂给模型做解读，控制 token
    const sample = this.serializeRows(rows.slice(0, 50));
    const prompt = [
      '你是数据分析助手。根据用户问题和查询结果，用简洁中文给出结论性解读（1-3 句），不要罗列全部数据，不要编造数据。',
      `用户问题：${question}`,
      `查询结果（JSON，最多 50 行）：${JSON.stringify(sample)}`,
    ].join('\n');
    const raw = await this.ai.chat(
      config,
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, maxTokens: 256 },
    );
    return raw.trim();
  }

  /** 序列化行数据：处理 Decimal/Date/BigInt 等无法直接 JSON 化的类型 */
  private serializeRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (v === null || v === undefined) {
          out[k] = null;
        } else if (v instanceof Date) {
          out[k] = v.toISOString().slice(0, 10);
        } else if (typeof v === 'bigint') {
          out[k] = Number(v);
        } else if (typeof v === 'object' && typeof (v as any).toString === 'function') {
          // Prisma Decimal 等对象类型转字符串
          out[k] = (v as any).toString();
        } else {
          out[k] = v;
        }
      }
      return out;
    });
  }

  /** 拦截提示文案 */
  private blockedHint(reason?: string): string {
    if (reason?.includes('不允许的数据表') || reason?.includes('数据表')) {
      return '仅支持查询合同相关数据（合同、收付款、履约节点、提醒）。';
    }
    return '该问题无法安全查询，请换个问法。';
  }

  /** 写 SQL 审计 */
  private async audit(
    userId: number,
    question: string,
    generatedSql: string | null,
    rowCount: number,
    status: 'success' | 'blocked' | 'failed',
    errorMsg?: string,
  ) {
    try {
      await this.prisma.contractAgentSqlAudit.create({
        data: {
          userId,
          question: question.slice(0, 500),
          generatedSql,
          rowCount,
          status,
          errorMsg: errorMsg?.slice(0, 500) || null,
        },
      });
    } catch (e) {
      // 审计失败不应影响主流程，仅记录
      this.logger.error(`SQL 审计写入失败：${e instanceof Error ? e.message : e}`);
    }
  }
}
