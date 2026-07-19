import { IsNotEmpty, IsString, IsNumber, IsOptional, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 新增公司 */
export class CreateTenantDto {
  @ApiProperty({ description: '公司名称' })
  @IsString()
  @IsNotEmpty({ message: '公司名称不能为空' })
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: '公司编码（全局唯一）' })
  @IsString()
  @IsNotEmpty({ message: '公司编码不能为空' })
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ description: '状态 1=启用 0=停用', default: 1 })
  @IsNumber()
  @IsIn([0, 1])
  @IsOptional()
  status?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  remark?: string;
}

/** 更新公司 */
export class UpdateTenantDto {
  @ApiPropertyOptional({ description: '公司名称' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '公司编码' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: '状态 1=启用 0=停用' })
  @IsNumber()
  @IsIn([0, 1])
  @IsOptional()
  status?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  remark?: string;
}

/** 公司列表查询 */
export class TenantQueryDto {
  @ApiPropertyOptional({ description: '公司名称（模糊匹配）' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '状态 1=启用 0=停用' })
  @Type(() => Number)
  @IsNumber()
  @IsIn([0, 1])
  @IsOptional()
  status?: number;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', default: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  pageSize?: number;
}
