import { ApiProperty } from '@nestjs/swagger';

/** 识别出的收付款计划项 */
export class RecognizedPaymentPlanVo {
  @ApiProperty({ description: '方向：收款/付款', nullable: true })
  direction: string | null;

  @ApiProperty({ description: '计划金额', nullable: true })
  planAmount: number | null;

  @ApiProperty({ description: '计划日期 YYYY-MM-DD', nullable: true })
  planDate: string | null;

  @ApiProperty({ description: '备注', nullable: true })
  remark: string | null;
}

/** 识别出的合同基础信息 */
export class RecognizedContractVo {
  @ApiProperty({ description: '合同名称', nullable: true })
  name: string | null;

  @ApiProperty({ description: '合同类型（已归一化到系统枚举，未匹配为 null）', nullable: true })
  type: string | null;

  @ApiProperty({ description: '签约主体', nullable: true })
  signSubject: string | null;

  @ApiProperty({ description: '相对方', nullable: true })
  counterparty: string | null;

  @ApiProperty({ description: '合同金额', nullable: true })
  amount: number | null;

  @ApiProperty({ description: '币种（已归一化，未匹配为 null）', nullable: true })
  currency: string | null;

  @ApiProperty({ description: '签订日期 YYYY-MM-DD', nullable: true })
  signDate: string | null;

  @ApiProperty({ description: '生效日期 YYYY-MM-DD', nullable: true })
  effectiveDate: string | null;

  @ApiProperty({ description: '到期日期 YYYY-MM-DD', nullable: true })
  expireDate: string | null;

  @ApiProperty({ description: '备注', nullable: true })
  remark: string | null;
}

/** 合同识别结果 */
export class RecognizeResultVo {
  @ApiProperty({ description: '识别出的合同基础信息', type: RecognizedContractVo })
  contract: RecognizedContractVo;

  @ApiProperty({ description: '识别出的收付款计划', type: [RecognizedPaymentPlanVo] })
  paymentPlans: RecognizedPaymentPlanVo[];

  @ApiProperty({ description: '整体置信度 0-1' })
  confidence: number;
}
