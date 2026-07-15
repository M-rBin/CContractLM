import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from '@/common/crud';
import { Perms } from '@/common/decorators';
import { ContractDetailService } from '../services/contract-detail.service';

@ApiTags('合同操作记录')
@Controller('admin/contract/oper-record')
export class ContractOperRecordController extends BaseController {
  constructor(private readonly contractDetailService: ContractDetailService) {
    super();
  }

  @Get('list/:contractId')
  @Perms('list')
  @ApiOperation({ summary: '查询合同操作记录' })
  async list(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.ok(await this.contractDetailService.listRecords(contractId));
  }
}
