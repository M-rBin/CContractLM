import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from '@/common/crud';
import { Perms } from '@/common/decorators';
import { ContractDetailService } from '../services/contract-detail.service';

@ApiTags('合同详情')
@Controller('admin/contract/detail')
export class ContractDetailController extends BaseController {
  constructor(private readonly contractDetailService: ContractDetailService) {
    super();
  }

  @Get(':contractId')
  @Perms('detail')
  @ApiOperation({ summary: '获取合同详情聚合数据' })
  async detail(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.ok(await this.contractDetailService.detail(contractId));
  }
}
