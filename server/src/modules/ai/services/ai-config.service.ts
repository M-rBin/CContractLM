import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { CryptoService } from './crypto.service';
import { AiService } from './ai.service';
import { AiCallConfig, AiProvider } from '../ai.types';
import { AddAiConfigDto, UpdateAiConfigDto, TestAiConfigDto } from '../dto/ai-config.dto';

/**
 * AI 配置管理服务
 *
 * 负责多套 AI 配置的增删改查、默认配置互斥、启停、连接测试。
 * 密钥保存时加密、读取时脱敏；对外（前端）永不暴露明文密钥。
 * 解密后的明文仅在服务内部用于连接测试或供其他 AI 能力调用。
 */
@Injectable()
export class AiConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly ai: AiService,
  ) {}

  /** 列表查询（密钥脱敏） */
  async list() {
    const rows = await this.prisma.aiConfig.findMany({
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.toVo(row));
  }

  /** 详情（密钥脱敏） */
  async detail(id: number) {
    const row = await this.prisma.aiConfig.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('配置不存在');
    return this.toVo(row);
  }

  /** 新增配置 */
  async create(dto: AddAiConfigDto) {
    this.validateBaseUrl(dto.provider, dto.baseUrl);
    const isDefault = dto.isDefault === 1 ? 1 : 0;
    const isEnabled = dto.isEnabled === 0 ? 0 : 1;

    return this.prisma.$transaction(async (tx) => {
      // 若设为默认，先清除其他默认
      if (isDefault === 1) {
        await tx.aiConfig.updateMany({
          where: { isDefault: 1 },
          data: { isDefault: 0 },
        });
      }
      // 若库中还没有任何配置，首条自动成为默认
      const count = await tx.aiConfig.count();
      const created = await tx.aiConfig.create({
        data: {
          name: dto.name,
          provider: dto.provider,
          model: dto.model,
          apiKey: this.crypto.encrypt(dto.apiKey),
          baseUrl: dto.baseUrl?.trim() || null,
          isDefault: count === 0 ? 1 : isDefault,
          isEnabled,
        },
      });
      return this.toVo(created);
    });
  }

  /** 更新配置 */
  async update(dto: UpdateAiConfigDto) {
    const existing = await this.prisma.aiConfig.findUnique({ where: { id: dto.id } });
    if (!existing) throw new NotFoundException('配置不存在');
    this.validateBaseUrl(dto.provider, dto.baseUrl);
    const isDefault = dto.isDefault === 1 ? 1 : 0;
    const isEnabled = dto.isEnabled === 0 ? 0 : 1;

    return this.prisma.$transaction(async (tx) => {
      if (isDefault === 1) {
        await tx.aiConfig.updateMany({
          where: { isDefault: 1, id: { not: dto.id } },
          data: { isDefault: 0 },
        });
      }
      const updated = await tx.aiConfig.update({
        where: { id: dto.id },
        data: {
          name: dto.name,
          provider: dto.provider,
          model: dto.model,
          // apiKey 留空则保留原密钥
          ...(dto.apiKey ? { apiKey: this.crypto.encrypt(dto.apiKey) } : {}),
          baseUrl: dto.baseUrl?.trim() || null,
          // 不允许把当前唯一的默认配置取消默认（保证始终有默认），
          // 但允许通过设置其他配置为默认来间接转移
          isDefault: existing.isDefault === 1 && isDefault === 0 ? 1 : isDefault,
          isEnabled,
        },
      });
      return this.toVo(updated);
    });
  }

  /** 删除配置：默认配置不可删除 */
  async remove(id: number) {
    const existing = await this.prisma.aiConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('配置不存在');
    if (existing.isDefault === 1) {
      throw new BadRequestException('默认配置不可删除，请先设置其他默认配置');
    }
    await this.prisma.aiConfig.delete({ where: { id } });
  }

  /** 设为默认 */
  async setDefault(id: number) {
    const existing = await this.prisma.aiConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('配置不存在');
    await this.prisma.$transaction([
      this.prisma.aiConfig.updateMany({
        where: { isDefault: 1 },
        data: { isDefault: 0 },
      }),
      this.prisma.aiConfig.update({
        where: { id },
        data: { isDefault: 1, isEnabled: 1 },
      }),
    ]);
  }

  /** 启用/停用：停用默认配置时拒绝（默认必须可用） */
  async toggleEnabled(id: number, isEnabled: number) {
    const existing = await this.prisma.aiConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('配置不存在');
    const target = isEnabled === 1 ? 1 : 0;
    if (target === 0 && existing.isDefault === 1) {
      throw new BadRequestException('默认配置不可停用，请先设置其他默认配置');
    }
    await this.prisma.aiConfig.update({
      where: { id },
      data: { isEnabled: target },
    });
  }

  /** 连接测试：支持已存在配置（传 id）或临时配置 */
  async testConnection(dto: TestAiConfigDto): Promise<{ ok: boolean; message: string }> {
    let callConfig: AiCallConfig;
    if (dto.id !== undefined) {
      const row = await this.prisma.aiConfig.findUnique({ where: { id: dto.id } });
      if (!row) throw new NotFoundException('配置不存在');
      callConfig = {
        provider: row.provider as AiProvider,
        model: row.model,
        apiKey: this.crypto.decrypt(row.apiKey),
        baseUrl: row.baseUrl || undefined,
      };
    } else {
      callConfig = {
        provider: dto.provider as AiProvider,
        model: dto.model as string,
        apiKey: dto.apiKey as string,
        baseUrl: dto.baseUrl || undefined,
      };
    }
    try {
      await this.ai.testConnection(callConfig);
      return { ok: true, message: '连接成功' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : '连接失败' };
    }
  }

  /**
   * 供其他 AI 能力调用：取默认且启用的配置，返回含明文密钥的调用配置。
   * @returns 可用配置；无可用默认配置时返回 null
   */
  async getActiveCallConfig(): Promise<AiCallConfig | null> {
    const row = await this.prisma.aiConfig.findFirst({
      where: { isDefault: 1, isEnabled: 1 },
    });
    if (!row) return null;
    return {
      provider: row.provider as AiProvider,
      model: row.model,
      apiKey: this.crypto.decrypt(row.apiKey),
      baseUrl: row.baseUrl || undefined,
    };
  }

  /** 所有提供商都必须提供 API 调用地址（不同厂商/网关端点各异，显式指定更可靠） */
  private validateBaseUrl(provider: string, baseUrl?: string) {
    const url = baseUrl?.trim();
    if (!url) {
      throw new BadRequestException('请填写 API 调用地址');
    }
    if (!/^https?:\/\/.+/.test(url)) {
      throw new BadRequestException('API 调用地址需以 http(s):// 开头');
    }
  }

  /** 实体转 VO：密钥脱敏 */
  private toVo(row: {
    id: number;
    name: string;
    provider: string;
    model: string;
    apiKey: string;
    baseUrl: string | null;
    isDefault: number;
    isEnabled: number;
    createTime: Date;
    updateTime: Date;
  }) {
    return {
      id: row.id,
      name: row.name,
      provider: row.provider,
      model: row.model,
      apiKey: this.crypto.mask(this.crypto.decrypt(row.apiKey)),
      baseUrl: row.baseUrl,
      isDefault: row.isDefault,
      isEnabled: row.isEnabled,
      createTime: row.createTime.toISOString(),
      updateTime: row.updateTime.toISOString(),
    };
  }
}
