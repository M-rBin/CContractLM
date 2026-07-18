import { Injectable, Logger } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * 密钥加解密服务
 *
 * 用于 AI 配置中访问密钥（apiKey）的加密存储与脱敏展示。
 * 采用 AES-256-GCM 对称加密，加密密钥来自环境变量 AI_ENCRYPT_KEY，
 * 密文格式为 `iv:authTag:cipherText`（均为 hex），不入前端、不入日志。
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  /** 32 字节密钥，由环境变量派生 */
  private readonly key: Buffer;

  constructor() {
    const secret =
      process.env.AI_ENCRYPT_KEY || process.env.JWT_SECRET || 'ccontractlm-default-ai-key';
    if (!process.env.AI_ENCRYPT_KEY) {
      this.logger.warn(
        '未配置 AI_ENCRYPT_KEY，已回退到默认密钥，生产环境务必设置独立的 AI_ENCRYPT_KEY',
      );
    }
    // 用 sha256 将任意长度的 secret 归一化为 32 字节密钥
    this.key = createHash('sha256').update(secret).digest();
  }

  /**
   * 加密明文
   * @param plainText 明文密钥
   * @returns 密文字符串 `iv:authTag:cipherText`
   */
  encrypt(plainText: string): string {
    if (!plainText) return '';
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * 解密密文
   * @param cipherText 密文字符串 `iv:authTag:cipherText`
   * @returns 明文；密文非法时返回空字符串
   */
  decrypt(cipherText: string): string {
    if (!cipherText) return '';
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      this.logger.warn('密文格式非法，无法解密');
      return '';
    }
    try {
      const [ivHex, authTagHex, dataHex] = parts;
      const decipher = createDecipheriv(
        this.algorithm,
        this.key,
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataHex, 'hex')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (e) {
      this.logger.error('密钥解密失败', e instanceof Error ? e.stack : undefined);
      return '';
    }
  }

  /**
   * 判断字符串是否为本服务生成的密文
   */
  isEncrypted(value: string): boolean {
    if (!value) return false;
    const parts = value.split(':');
    return (
      parts.length === 3 &&
      /^[0-9a-f]+$/i.test(parts[0]) &&
      /^[0-9a-f]+$/i.test(parts[1]) &&
      /^[0-9a-f]+$/i.test(parts[2])
    );
  }

  /**
   * 脱敏展示密钥：保留前 3 位与后 3 位，中间以 *** 代替
   * @param plainText 明文密钥
   * @returns 形如 `sk-***xxx` 的脱敏串
   */
  mask(plainText: string): string {
    if (!plainText) return '';
    if (plainText.length <= 7) return '***';
    const head = plainText.slice(0, 3);
    const tail = plainText.slice(-3);
    return `${head}***${tail}`;
  }
}
