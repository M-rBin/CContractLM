import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from '@/common/crud';
import { Perms } from '@/common/decorators';
import { ContractAggregateService } from '../services/contract-aggregate.service';

@ApiTags('经营分析')
@Controller('admin/contract/analysis')
export class ContractAnalysisController extends BaseController {
  constructor(private readonly aggregateService: ContractAggregateService) {
    super();
  }

  @Get('overview')
  @Perms('overview')
  @ApiOperation({ summary: '经营分析汇总' })
  async overview(@Query() query: Record<string, any>) {
    return this.ok(await this.aggregateService.analysisOverview(query));
  }
}
