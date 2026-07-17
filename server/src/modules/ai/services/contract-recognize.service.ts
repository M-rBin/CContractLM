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

    // 4. 解析并归一化
    return this.parseResult(raw);
  }

  /** 构造系统提示词，约束模型只输出 JSON */
  private buildSystemPrompt(): string {
    return [
      '你是合同信息抽取助手。请从用户提供的合同文本中抽取结构化信息，严格按以下 JSON 格式输出，不要输出任何解释性文字或 markdown 代码块标记。',
      '',
      'JSON 结构：',
      '{',
      '  "contract": {',
      '    "name": "合同名称，字符串或 null",',
      '    "type": "合同类型原文，字符串或 null",',
      '    "signSubject": "我方签约主体，字符串或 null",',
      '    "counterparty": "相对方，字符串或 null",',
      '    "amount": 合同总金额数字或 null,',
      '    "currency": "币种原文，字符串或 null",',
      '    "signDate": "签订日期 YYYY-MM-DD 或 null",',
      '    "effectiveDate": "生效日期 YYYY-MM-DD 或 null",',
      '    "expireDate": "到期日期 YYYY-MM-DD 或 null",',
      '    "remark": "其他关键说明或 null"',
      '  },',
      '  "paymentPlans": [',
      '    { "direction": "收款或付款", "planAmount": 金额数字或 null, "planDate": "YYYY-MM-DD 或 null", "remark": "说明或 null" }',
      '  ]',
      '}',
      '',
      '规则：',
      '- 找不到的字段填 null，不要臆造。',
      '- 金额只保留数字，不带货币符号与千分位。',
      '- 日期统一为 YYYY-MM-DD。',
      '- direction 从我方视角判断：我方收钱为"收款"，我方付钱为"付款"。',
      '- 没有分期付款信息时 paymentPlans 返回空数组 []。',
    ].join('\n');
  }

  /** 解析模型返回文本为结构化结果并做枚举归一化 */
  private parseResult(raw: string): RecognizeResultVo {
    const json = this.extractJson(raw);
    if (!json) {
      this.logger.warn('大模型返回内容无法解析为 JSON');
      throw new BadRequestException('识别失败，请重试或手动录入');
    }

    const c = json.contract || {};
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
