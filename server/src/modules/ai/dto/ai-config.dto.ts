import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** 支持的提供商枚举 */
export const AI_PROVIDERS = [
  'openai',
  'anthropic',
  'qwen',
  'deepseek',
  'openai-compatible',
] as const;

/** 模型类型枚举 */
export const AI_MODEL_TYPES = ['text', 'vision'] as const;

/**
 * 新增 AI 配置入参
 */
export class AddAiConfigDto {
  @ApiProperty({ description: '配置名称' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: '提供商', enum: AI_PROVIDERS })
  @IsIn(AI_PROVIDERS)
  provider: string;

  @ApiProperty({ description: '模型名称' })
  @IsString()
  @MaxLength(100)
  model: string;

  @ApiProperty({ description: '访问密钥（明文提交，后端加密存储）' })
  @IsString()
  @MaxLength(500)
  apiKey: string;

  @ApiProperty({ description: 'API 调用地址（所有提供商必填，需以 http(s):// 开头）' })
  @IsString()
  @MaxLength(200)
  baseUrl: string;

  @ApiProperty({ description: '模型类型：text=文本模型 vision=视觉模型', enum: AI_MODEL_TYPES, required: false })
  @IsOptional()
  @IsIn(AI_MODEL_TYPES)
  modelType?: string;

  @ApiProperty({ description: '是否默认：1=是 0=否', required: false })
  @IsOptional()
  @IsInt()
  isDefault?: number;

  @ApiProperty({ description: '是否启用：1=启用 0=停用', required: false })
  @IsOptional()
  @IsInt()
  isEnabled?: number;
}

/**
 * 更新 AI 配置入参
 *
 * apiKey 可选：为空时保留原密钥，不覆盖（避免脱敏值回填导致密钥被覆盖为掩码）。
 */
export class UpdateAiConfigDto {
  @ApiProperty({ description: '配置 ID' })
  @IsInt()
  id: number;

  @ApiProperty({ description: '配置名称' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: '提供商', enum: AI_PROVIDERS })
  @IsIn(AI_PROVIDERS)
  provider: string;

  @ApiProperty({ description: '模型名称' })
  @IsString()
  @MaxLength(100)
  model: string;

  @ApiProperty({ description: '访问密钥（留空则保留原密钥）', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @ApiProperty({ description: 'API 调用地址（需以 http(s):// 开头）', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  baseUrl?: string;

  @ApiProperty({ description: '模型类型：text=文本模型 vision=视觉模型', enum: AI_MODEL_TYPES, required: false })
  @IsOptional()
  @IsIn(AI_MODEL_TYPES)
  modelType?: string;

  @ApiProperty({ description: '是否默认：1=是 0=否', required: false })
  @IsOptional()
  @IsInt()
  isDefault?: number;

  @ApiProperty({ description: '是否启用：1=启用 0=停用', required: false })
  @IsOptional()
  @IsInt()
  isEnabled?: number;
}

/**
 * 连接测试入参：既可传已存在配置的 id，也可传临时配置直接测试。
 */
export class TestAiConfigDto {
  @ApiProperty({ description: '已存在配置 ID（传入则测试该配置）', required: false })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiProperty({ description: '提供商', enum: AI_PROVIDERS, required: false })
  @ValidateIf((o) => o.id === undefined)
  @IsIn(AI_PROVIDERS)
  provider?: string;

  @ApiProperty({ description: '模型名称', required: false })
  @ValidateIf((o) => o.id === undefined)
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiProperty({ description: '访问密钥', required: false })
  @ValidateIf((o) => o.id === undefined)
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @ApiProperty({ description: '服务地址', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  baseUrl?: string;
}
