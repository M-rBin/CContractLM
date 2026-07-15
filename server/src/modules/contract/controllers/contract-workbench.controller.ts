import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from '@/common/crud';
import { Perms } from '@/common/decorators';
import { ContractAggregateService } from '../services/contract-aggregate.service';

@ApiTags('合同工作台')
@Controller('admin/contract/workbench')
export class ContractWorkbenchController extends BaseController {
  constructor(private readonly aggregateService: ContractAggregateService) {
    super();
  }

  @Get('overview')
  @Perms('overview')
  @ApiOperation({ summary: '获取工作台汇总数据' })
  async overview() {
    return this.ok(await this.aggregateService.workbenchOverview());
  }

  @Get('todos')
  @Perms('todos')
  @ApiOperation({ summary: '获取工作台待办提醒' })
  async todos(@Query('type') type?: string) {
    return this.ok(await this.aggregateService.workbenchTodos(type));
  }

  @Get('recent')
  @Perms('recent')
  @ApiOperation({ summary: '获取工作台最近动态' })
  async recent() {
    return this.ok(await this.aggregateService.workbenchRecent());
  }
}
