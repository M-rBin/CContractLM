import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiConfigService } from './ai-config.service';
import { PdfExtractService } from './pdf-extract.service';
import { matchContractType, matchCurrency } from '../agent/enum-matcher';
import { RecognizeResultVo } from '../vo/recognize.vo';

/** 送入大模型的合同文本上限，避免超长（约控制在 token 预算内） */
const MAX_TEXT_LENGTH = 12000;

/**
 * 合同智能识别服务
 *
 * 编排：PDF 文本提取 → 组装提示词 → 调用大模型 → 解析 JSON →
 * 枚举归一化 → 输出结构化识别结果（不落盘、不持久化）。
 */
@Injectable()
export class ContractRecognizeService {
  private readonly logger = new Logger(ContractRecognizeService.name);

  constructor(
    private readonly ai: AiService,
    private readonly aiConfig: AiConfigService,
    private readonly pdf: PdfExtractService,
  ) {}

  /**
   * 识别合同 PDF
   * @param buffer PDF 内存缓冲
   * @returns 结构化识别结果
   */
  async recognize(buffer: Buffer): Promise<RecognizeResultVo> {
    // 1. 取默认可用 AI 配置
    const config = await this.aiConfig.getActiveCallConfig();
    if (!config) {
      throw new BadRequestException('请先在系统设置中配置并启用 AI 服务');
    }

    // 2. 提取文本（扫描件/空白件在此抛出）
    let text = await this.pdf.extractText(buffer);
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.slice(0, MAX_TEXT_LENGTH);
    }

    // 3. 调用大模型
    const raw = await this.ai.recognize(config, this.buildSystemPrompt(), text, {
      temperature: 0,
      maxTokens: 2048,
    });
    this.logger.debug(`AI 原始返回（前 500 字符）：${raw.slice(0, 500)}`);

    // 4. 解析并归一化
    const result = this.parseResult(raw);
    if (result.confidence === 0) {
      // 只记录字段摘要（哪些字段有值），不记录原始合同内容，避免业务数据进入日志系统
      const keys = Object.entries(result.contract)
        .filter(([, v]) => v !== null)
        .map(([k]) => k);
      this.logger.warn(`识别置信度为 0，有值字段：[${keys.join(', ') || '无'}]，请检查 AI 配置或 PDF 内容`);
    }
    return result;
  }

  /** 构造系统提示词，约束模型只输出 JSON */
  private buildSystemPrompt(): string {
    return [
      '你是一个合同信息抽取 API。从用户提供的合同文本中提取指定字段，只输出一个 JSON 对象，',
      '不要输出任何前缀文字、解释或 markdown 代码块标记（不要输出 ```json）。',
      '',
      '需要提取的字段（找不到的填 null，不要臆造）：',
      '- contract.name：合同全称',
      '- contract.type：合同类型原文',
      '- contract.signSubject：我方签约主体名称',
      '- contract.counterparty：对方签约主体名称',
      '- contract.amount：合同总金额，纯数字（不含货币符号与千分位）',
      '- contract.currency：货币单位原文',
      '- contract.signDate：签订日期，格式 YYYY-MM-DD',
      '- contract.effectiveDate：生效日期，格式 YYYY-MM-DD',
      '- contract.expireDate：到期日期，格式 YYYY-MM-DD',
      '- contract.remark：其他关键备注',
      '- paymentPlans：分期付款计划数组，无分期信息时为 []，每项包含：',
      '  direction（"收款" 或 "付款"，从我方视角判断）、planAmount（纯数字）、planDate（YYYY-MM-DD）、remark',
      '',
      '输出示例（仅展示格式，实际请提取真实内容）：',
      '{"contract":{"name":"技术服务合同","type":"服务合同","signSubject":"甲方公司","counterparty":"乙方公司","amount":100000,"currency":"人民币","signDate":"2024-01-01","effectiveDate":"2024-01-01","expireDate":"2024-12-31","remark":null},"paymentPlans":[{"direction":"收款","planAmount":50000,"planDate":"2024-06-01","remark":null}]}',
    ].join('\n');
  }

  /** 解析模型返回文本为结构化结果并做枚举归一化 */
  private parseResult(raw: string): RecognizeResultVo {
    const json = this.extractJson(raw);
    if (!json) {
      this.logger.warn('大模型返回内容无法解析为 JSON');
      throw new BadRequestException('识别失败，请重试或手动录入');
    }

    // 兼容两种结构：{ contract: {...}, paymentPlans: [...] } 或直接平铺字段
    const knownFields = ['name', 'type', 'signSubject', 'counterparty', 'amount'];
    const isFlat = !json.contract && knownFields.some((k) => json[k] !== undefined);
    const c = json.contract || (isFlat ? json : {});
    const contract = {
      name: this.str(c.name),
      type: matchContractType(this.str(c.type)),
      signSubject: this.str(c.signSubject),
      counterparty: this.str(c.counterparty),
      amount: this.num(c.amount),
      currency: matchCurrency(this.str(c.currency)),
      signDate: this.date(c.signDate),
      effectiveDate: this.date(c.effectiveDate),
      expireDate: this.date(c.expireDate),
      remark: this.str(c.remark),
    };

    const plansRaw = Array.isArray(json.paymentPlans) ? json.paymentPlans : [];
    const paymentPlans = plansRaw.map((p: any) => ({
      direction: p?.direction === '收款' || p?.direction === '付款' ? p.direction : null,
      planAmount: this.num(p?.planAmount),
      planDate: this.date(p?.planDate),
      remark: this.str(p?.remark),
    }));

    const confidence = this.computeConfidence(contract);
    return { contract, paymentPlans, confidence };
  }

  /** 从可能含 markdown 包裹的文本中提取 JSON 对象 */
  private extractJson(raw: string): any | null {
    if (!raw) return null;
    // 去掉可能的 ```json ``` 包裹
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  /** 依据关键字段的识别完整度估算置信度 */
  private computeConfidence(contract: Record<string, unknown>): number {
    const keyFields = ['name', 'signSubject', 'counterparty', 'amount', 'signDate'];
    const filled = keyFields.filter((f) => contract[f] !== null && contract[f] !== undefined).length;
    return Math.round((filled / keyFields.length) * 100) / 100;
  }

  private str(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t && t.toLowerCase() !== 'null' ? t : null;
  }

  private num(v: unknown): number | null {
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[,，\s]/g, ''));
      return Number.isNaN(n) ? null : n;
    }
    return null;
  }

  private date(v: unknown): string | null {
    const s = this.str(v);
    if (!s) return null;
    // 归一化 2024/1/2、2024.1.2 → 2024-01-02
    const m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (!m) return null;
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
}
