import { BadRequestException, Injectable, Logger } from '@nestjs/common';
// pdf-parse v2 改为 class 导出，不再有默认函数
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PDFParse } = require('pdf-parse');

/** 识别所需的最小有效文本长度（低于此视为扫描件/空白件） */
const MIN_TEXT_LENGTH = 20;

/**
 * PDF 文本提取服务
 *
 * 从上传的 PDF 内存缓冲中提取纯文本，供合同智能识别使用。
 * 文件不落盘。扫描件（图片型 PDF）提取不到有效文本，直接拒绝并提示手动录入。
 */
@Injectable()
export class PdfExtractService {
  private readonly logger = new Logger(PdfExtractService.name);

  /**
   * 从 PDF buffer 提取文本
   * @param buffer PDF 文件内存缓冲
   * @returns 提取到的文本
   * @throws BadRequestException 文件非法或为扫描件（无有效文本）
   */
  async extractText(buffer: Buffer): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('文件内容为空');
    }
    let text: string;
    let parser: InstanceType<typeof PDFParse> | null = null;
    try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      text = (result?.text || '').trim();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e).slice(0, 200);
      this.logger.warn(`PDF 解析失败：${msg}`);
      throw new BadRequestException('PDF 文件解析失败，请确认文件格式正确');
    } finally {
      parser?.destroy?.();
    }
    if (text.length < MIN_TEXT_LENGTH) {
      throw new BadRequestException('当前仅支持文本型 PDF，扫描件请手动录入');
    }
    return text;
  }
}
