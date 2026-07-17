import { BadRequestException, Injectable, Logger } from '@nestjs/common';
// pdf-parse v2 改为 class 导出，不再有默认函数
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PDFParse } = require('pdf-parse');

/** 识别所需的最小有效文本长度（低于此视为扫描件/空白件）
 *  图片型PDF过滤占位行后残留文本通常 < 10 字符；文本型合同正文一般远超 50 字符 */
export const MIN_TEXT_LENGTH = 50;

/** 页面占位标记模式（pdf-parse 对扫描件产生的无意义行，如 "-- 1 of 7 --"） */
const PAGE_MARKER_PATTERN = /^--\s*\d+\s*of\s*\d+\s*--$/;

/** 视觉渲染最大页数（合同关键信息一般在前几页） */
const MAX_RENDER_PAGES = 8;

/**
 * PDF 文本提取服务
 *
 * 从上传的 PDF 内存缓冲中提取纯文本，或将页面渲染为图片，供合同智能识别使用。
 * 文件不落盘。扫描件（图片型 PDF）提取不到有效文本时，由调用方决定是否走视觉路径。
 */
@Injectable()
export class PdfExtractService {
  private readonly logger = new Logger(PdfExtractService.name);

  /**
   * 从 PDF buffer 提取文本
   * @param buffer PDF 文件内存缓冲
   * @returns 提取到的文本；若为扫描件或无可用文本则返回空字符串（不抛出）
   * @throws BadRequestException 文件内容为空或解析失败
   */
  async extractText(buffer: Buffer): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('文件内容为空');
    }
    let parser: InstanceType<typeof PDFParse> | null = null;
    try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const raw = (result?.text || '').trim();
      // 过滤掉 pdf-parse 对扫描件产生的页面占位行（"-- N of M --"），再判断有效文本量
      const meaningful = raw
        .split('\n')
        .filter((line) => !PAGE_MARKER_PATTERN.test(line.trim()))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return meaningful;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e).slice(0, 200);
      this.logger.warn(`PDF 解析失败：${msg}`);
      throw new BadRequestException('PDF 文件解析失败，请确认文件格式正确');
    } finally {
      parser?.destroy?.();
    }
  }

  /**
   * 将 PDF 页面渲染为 base64 图片（用于图片型 PDF 的视觉识别）
   * @param buffer PDF 文件内存缓冲
   * @param maxPages 最多渲染的页数，默认 8
   * @returns 各页 base64 data URL（data:image/png;base64,...）数组
   */
  async renderPagesAsImages(buffer: Buffer, maxPages = MAX_RENDER_PAGES): Promise<string[]> {
    if (!buffer || buffer.length === 0) return [];
    let parser: InstanceType<typeof PDFParse> | null = null;
    try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getScreenshot({ imageDataUrl: true, scale: 2, first: maxPages });
      return (result?.pages || [])
        .map((p: any) => p.dataUrl as string)
        .filter(Boolean);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e).slice(0, 200);
      this.logger.warn(`PDF 页面渲染失败：${msg}`);
      return [];
    } finally {
      parser?.destroy?.();
    }
  }
}
