import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export const CONTRACT_TYPES = ['采购合同', '销售合同', '服务合同', '租赁合同', '框架协议', '其他合同'] as const;
export const CONTRACT_STATUS = ['草稿', '履行中', '已到期', '已终止', '已归档'] as const;
export const CONTRACT_CURRENCIES = ['人民币', '美元', '欧元', '其他'] as const;
export const CONTRACT_ATTACHMENT_CATEGORIES = ['合同正文', '补充协议', '验收材料', '发票', '付款凭证', '其他附件'] as const;
export const CONTRACT_PENDING_STATUS = ['待处理', '已完成', '逾期'] as const;
export const CONTRACT_PAYMENT_DIRECTIONS = ['收款', '付款'] as const;

/**
 * 新增合同入参
 */
export class AddContractDto {
  @ApiProperty({ description: '合同编号' })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty({ description: '合同名称' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: '合同类型', enum: CONTRACT_TYPES })
  @IsIn(CONTRACT_TYPES)
  type: string;

  @ApiProperty({ description: '签约主体' })
  @IsString()
  @MaxLength(100)
  signSubject: string;

  @ApiProperty({ description: '相对方' })
  @IsString()
  @MaxLength(100)
  counterparty: string;

  @ApiProperty({ description: '合同金额' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: '币种', enum: CONTRACT_CURRENCIES })
  @IsIn(CONTRACT_CURRENCIES)
  currency: string;

  @ApiProperty({ description: '签订日期' })
  @IsDateString()
  signDate: string;

  @ApiProperty({ description: '生效日期' })
  @IsDateString()
  effectiveDate: string;

  @ApiProperty({ description: '到期日期' })
  @IsDateString()
  expireDate: string;

  @ApiProperty({ description: '负责人用户 ID', required: false })
  @IsOptional()
  @IsInt()
  @IsPositive()
  ownerId?: number;

  @ApiProperty({ description: '负责人姓名', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ownerName?: string;

  @ApiProperty({ description: '合同状态', enum: CONTRACT_STATUS })
  @IsIn(CONTRACT_STATUS)
  status: string;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 更新合同入参
 */
export class UpdateContractDto extends AddContractDto {
  @ApiProperty({ description: '合同 ID' })
  @IsInt()
  @IsPositive()
  id: number;
}

export class AddAttachmentDto {
  @ApiProperty({ description: '合同 ID' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  contractId: number;

  @ApiProperty({ description: '附件分类', enum: CONTRACT_ATTACHMENT_CATEGORIES })
  @IsIn(CONTRACT_ATTACHMENT_CATEGORIES)
  category: string;
}

export class AddMilestoneDto {
  @ApiProperty({ description: '合同 ID' })
  @IsInt()
  @IsPositive()
  contractId: number;

  @ApiProperty({ description: '节点名称' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: '计划日期' })
  @IsDateString()
  planDate: string;

  @ApiProperty({ description: '负责人用户 ID', required: false })
  @IsOptional()
  @IsInt()
  @IsPositive()
  ownerId?: number;

  @ApiProperty({ description: '负责人姓名', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ownerName?: string;

  @ApiProperty({ description: '说明', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}

export class UpdateMilestoneDto extends AddMilestoneDto {
  @ApiProperty({ description: '节点 ID' })
  @IsInt()
  @IsPositive()
  id: number;
}

export class CompleteMilestoneDto {
  @ApiProperty({ description: '节点 ID' })
  @IsInt()
  @IsPositive()
  id: number;

  @ApiProperty({ description: '实际完成日期' })
  @IsDateString()
  actualDate: string;

  @ApiProperty({ description: '完成说明', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  completeRemark?: string;
}

export class AddPaymentPlanDto {
  @ApiProperty({ description: '合同 ID' })
  @IsInt()
  @IsPositive()
  contractId: number;

  @ApiProperty({ description: '收付方向', enum: CONTRACT_PAYMENT_DIRECTIONS })
  @IsIn(CONTRACT_PAYMENT_DIRECTIONS)
  direction: string;

  @ApiProperty({ description: '计划金额' })
  @IsNumber()
  @Min(0)
  planAmount: number;

  @ApiProperty({ description: '计划日期' })
  @IsDateString()
  planDate: string;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}

export class UpdatePaymentPlanDto extends AddPaymentPlanDto {
  @ApiProperty({ description: '计划 ID' })
  @IsInt()
  @IsPositive()
  id: number;
}

export class RegisterPaymentPlanDto {
  @ApiProperty({ description: '计划 ID' })
  @IsInt()
  @IsPositive()
  id: number;

  @ApiProperty({ description: '实际金额' })
  @IsNumber()
  @Min(0.01)
  actualAmount: number;

  @ApiProperty({ description: '实际日期' })
  @IsDateString()
  actualDate: string;
}
