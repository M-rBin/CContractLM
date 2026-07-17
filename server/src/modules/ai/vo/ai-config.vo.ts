import { ApiProperty } from '@nestjs/swagger';

/**
 * AI 配置响应 VO
 *
 * apiKey 始终以脱敏形式返回（如 sk-***xxx），明文密钥不出后端。
 */
export class AiConfigVo {
  @ApiProperty({ description: '配置 ID' })
  id: number;

  @ApiProperty({ description: '配置名称' })
  name: string;

  @ApiProperty({ description: '提供商' })
  provider: string;

  @ApiProperty({ description: '模型名称' })
  model: string;

  @ApiProperty({ description: '脱敏后的访问密钥' })
  apiKey: string;

  @ApiProperty({ description: '服务地址', nullable: true })
  baseUrl: string | null;

  @ApiProperty({ description: '模型类型：text=文本模型 vision=视觉模型' })
  modelType: string;

  @ApiProperty({ description: '是否默认：1=是 0=否' })
  isDefault: number;

  @ApiProperty({ description: '是否启用：1=启用 0=停用' })
  isEnabled: number;

  @ApiProperty({ description: '创建时间' })
  createTime: string;

  @ApiProperty({ description: '更新时间' })
  updateTime: string;
}
