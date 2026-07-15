import { Body, Controller, Get, Header, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController, PageOptions } from '@/common/crud';
import { Admin, Perms } from '@/common/decorators';
import { RegisterPaymentPlanDto } from '../dto/contract.dto';
import { ContractAggregateService } from '../services/contract-aggregate.service';

@ApiTags('收付款管理')
@Controller('admin/contract/payment/manage')
export class ContractPaymentManageController extends BaseController {
  constructor(private readonly aggregateService: ContractAggregateService) {
    super();
  }

  @Get('list')
  @Perms('list')
  @ApiOperation({ summary: '分页查询收付款计划' })
  async list(@Query() query: PageOptions & Record<string, any>) {
    return this.ok(await this.aggregateService.pagePayments(query));
  }

  @Put('register')
  @Perms('register')
  @ApiOperation({ summary: '登记实际收付款' })
  async register(@Body() dto: RegisterPaymentPlanDto, @Admin('userId') userId?: number) {
    return this.ok(await this.aggregateService.registerPayment(dto, userId));
  }

  @Get('stat')
  @Perms('stat')
  @ApiOperation({ summary: '查询收付款统计' })
  async stat(@Query() query: Record<string, any>) {
    return this.ok(await this.aggregateService.paymentStat(query));
  }

  @Get('export')
  @Perms('export')
  @ApiOperation({ summary: '导出收付款计划' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="payments.csv"')
  async export(@Query() query: Record<string, any>) {
    const rows = await this.aggregateService.listPaymentsForExport(query);
    const header = ['合同名称', '相对方', '方向', '计划金额', '计划日期', '实际金额', '实际日期', '状态'];
    const body = rows.map((row: any) => [
      row.contract?.name || '',
      row.contract?.counterparty || '',
      row.direction,
      row.planAmount.toString(),
      row.planDate.toISOString().slice(0, 10),
      row.actualAmount?.toString() || '',
      row.actualDate ? row.actualDate.toISOString().slice(0, 10) : '',
      row.status,
    ]);
    return `\uFEFF${[header, ...body].map((line) => line.map(csvCell).join(',')).join('\n')}`;
  }
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
