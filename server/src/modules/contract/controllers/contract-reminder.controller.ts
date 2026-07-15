import { Body, Controller, Get, Param, ParseIntPipe, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController, PageOptions } from '@/common/crud';
import { Admin, Perms } from '@/common/decorators';
import { ContractAggregateService } from '../services/contract-aggregate.service';

@ApiTags('履约提醒')
@Controller('admin/contract/reminder')
export class ContractReminderController extends BaseController {
  constructor(private readonly aggregateService: ContractAggregateService) {
    super();
  }

  @Get('list')
  @Perms('list')
  @ApiOperation({ summary: '分页查询履约提醒' })
  async list(@Query() query: PageOptions & Record<string, any>) {
    return this.ok(await this.aggregateService.pageReminders(query));
  }

  @Get('source/:id')
  @Perms('source')
  @ApiOperation({ summary: '查看提醒来源' })
  async source(@Param('id', ParseIntPipe) id: number) {
    return this.ok(await this.aggregateService.getReminderSource(id));
  }

  @Put('handle')
  @Perms('handle')
  @ApiOperation({ summary: '完成处理履约提醒' })
  async handle(@Body() dto: { id: number; actualDate: string }, @Admin('userId') userId?: number) {
    return this.ok(await this.aggregateService.handleReminder(dto.id, dto.actualDate, userId));
  }
}
