import { ApiProperty } from '@nestjs/swagger';

/**
 * 合同主记录响应 VO
 */
export class ContractVo {
  @ApiProperty({ description: '合同 ID' })
  id: number;

  @ApiProperty({ description: '合同编号' })
  code: string;

  @ApiProperty({ description: '合同名称' })
  name: string;

  @ApiProperty({ description: '合同类型' })
  type: string;

  @ApiProperty({ description: '签约主体' })
  signSubject: string;

  @ApiProperty({ description: '相对方' })
  counterparty: string;

  @ApiProperty({ description: '合同金额' })
  amount: string;

  @ApiProperty({ description: '币种' })
  currency: string;

  @ApiProperty({ description: '签订日期' })
  signDate: string;

  @ApiProperty({ description: '生效日期' })
  effectiveDate: string;

  @ApiProperty({ description: '到期日期' })
  expireDate: string;

  @ApiProperty({ description: '负责人用户 ID', nullable: true })
  ownerId: number | null;

  @ApiProperty({ description: '负责人姓名', nullable: true })
  ownerName: string | null;

  @ApiProperty({ description: '合同状态' })
  status: string;

  @ApiProperty({ description: '备注', nullable: true })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  createTime: string;

  @ApiProperty({ description: '更新时间' })
  updateTime: string;
}
