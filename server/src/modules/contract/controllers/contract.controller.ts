import { Body, Delete, Get, Header, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CrudController, CrudControllerFactory, PageOptions } from '@/common/crud';
import { Admin, ApiOkVoid, ApiPageResult, ApiResult, Perms } from '@/common/decorators';
import { ContractService } from '../services/contract.service';
import { AddContractDto, UpdateContractDto } from '../dto/contract.dto';
import { ContractVo } from '../vo/contract.vo';

/**
 * 合同台账控制器
 */
@ApiTags('合同台账')
@CrudController({
  prefix: 'admin/contract/info',
  pageQueryOp: {
    keyWordLikeFields: ['code', 'name', 'counterparty', 'signSubject'],
    fieldEq: ['type', 'status', 'ownerId'],
  },
})
export class ContractController extends CrudControllerFactory(ContractVo) {
  constructor(private readonly contractService: ContractService) {
    super(contractService);
  }

  @Get('list')
  @Perms('list')
  @ApiOperation({ summary: '分页查询合同台账' })
  @ApiPageResult(ContractVo)
  async list(@Query() query: PageOptions & Record<string, any>, @Admin() admin: any) {
    const tenantId = admin?.username === 'admin' ? undefined : (admin?.tenantId || undefined);
    return this.ok(await this.contractService.pageContracts(query, tenantId));
  }

  @Post('add')
  @Perms('add')
  @ApiOperation({ summary: '新增合同' })
  @ApiResult(ContractVo)
  async add(@Body() dto: AddContractDto, @Admin() admin?: any) {
    const tenantId = admin?.username === 'admin' ? undefined : (admin?.tenantId || undefined);
    return this.ok(await this.contractService.createContract(dto, tenantId));
  }

  @Put('update')
  @Perms('update')
  @ApiOperation({ summary: '更新合同' })
  @ApiResult(ContractVo)
  async update(@Body() dto: UpdateContractDto, @Admin() admin?: any) {
    const tenantId = admin?.username === 'admin' ? undefined : (admin?.tenantId || undefined);
    return this.ok(await this.contractService.updateContract(dto, tenantId));
  }

  @Get('detail/:id')
  @Perms('detail')
  @ApiOperation({ summary: '合同详情' })
  @ApiResult(ContractVo)
  async detail(@Param('id', ParseIntPipe) id: number, @Admin() admin?: any) {
    const tenantId = admin?.username === 'admin' ? undefined : (admin?.tenantId || undefined);
    await this.contractService.verifyTenantAccess(id, tenantId);
    return this.ok(await this.contractService.info(id));
  }

  @Get('export')
  @Perms('export')
  @ApiOperation({ summary: '导出合同台账' })
  @ApiOkVoid()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="contracts.csv"')
  async export(@Query() query: Record<string, any>, @Admin() admin: any) {
    const tenantId = admin?.username === 'admin' ? undefined : (admin?.tenantId || undefined);
    const rows = await this.contractService.listForExport(query, tenantId);
    const header = ['合同编号', '合同名称', '合同类型', '签约主体', '相对方', '合同金额', '币种', '签订日期', '生效日期', '到期日期', '负责人', '合同状态'];
    const body = rows.map((row) => [
      row.code,
      row.name,
      row.type,
      row.signSubject,
      row.counterparty,
      row.amount.toString(),
      row.currency,
      row.signDate.toISOString().slice(0, 10),
      row.effectiveDate.toISOString().slice(0, 10),
      row.expireDate.toISOString().slice(0, 10),
      row.ownerName || '',
      row.status,
    ]);
    return `\uFEFF${[header, ...body].map((line) => line.map(csvCell).join(',')).join('\n')}`;
  }

  @Delete('delete/:id')
  @Perms('delete')
  @ApiOperation({ summary: '删除合同并级联清理从属数据' })
  @ApiOkVoid()
  async delete(@Param('id', ParseIntPipe) id: number, @Admin() admin?: any) {
    const tenantId = admin?.username === 'admin' ? undefined : (admin?.tenantId || undefined);
    await this.contractService.verifyTenantAccess(id, tenantId);
    await this.contractService.deleteContractCascade(id);
    return this.ok();
  }
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
