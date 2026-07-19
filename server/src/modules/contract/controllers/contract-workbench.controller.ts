import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from '@/common/crud';
import { Admin, Perms } from '@/common/decorators';
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
  async overview(@Admin() admin: any) {
    const tenantId = admin?.username === 'admin' ? undefined : (admin?.tenantId as number | undefined);
    return this.ok(await this.aggregateService.workbenchOverview(tenantId));
  }

  @Get('todos')
  @Perms('todos')
  @ApiOperation({ summary: '获取工作台待办提醒' })
  async todos(@Query('type') type: string | undefined, @Admin() admin: any) {
    const tenantId = admin?.username === 'admin' ? undefined : (admin?.tenantId as number | undefined);
    return this.ok(await this.aggregateService.workbenchTodos(type, tenantId));
  }

  @Get('recent')
  @Perms('recent')
  @ApiOperation({ summary: '获取工作台最近动态' })
  async recent(@Admin() admin: any) {
    const tenantId = admin?.username === 'admin' ? undefined : (admin?.tenantId as number | undefined);
    return this.ok(await this.aggregateService.workbenchRecent(tenantId));
  }
}
