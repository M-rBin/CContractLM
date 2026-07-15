import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from '@/common/crud';
import { Admin, Perms } from '@/common/decorators';
import { AddMilestoneDto, CompleteMilestoneDto, UpdateMilestoneDto } from '../dto/contract.dto';
import { ContractDetailService } from '../services/contract-detail.service';

@ApiTags('合同履约节点')
@Controller('admin/contract/milestone')
export class ContractMilestoneController extends BaseController {
  constructor(private readonly contractDetailService: ContractDetailService) {
    super();
  }

  @Get('list/:contractId')
  @Perms('list')
  @ApiOperation({ summary: '查询合同履约节点列表' })
  async list(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.ok(await this.contractDetailService.listMilestones(contractId));
  }

  @Post('add')
  @Perms('add')
  @ApiOperation({ summary: '新增履约节点' })
  async add(@Body() dto: AddMilestoneDto) {
    return this.ok(await this.contractDetailService.addMilestone(dto));
  }

  @Put('update')
  @Perms('update')
  @ApiOperation({ summary: '更新履约节点' })
  async update(@Body() dto: UpdateMilestoneDto) {
    return this.ok(await this.contractDetailService.updateMilestone(dto));
  }

  @Put('complete')
  @Perms('complete')
  @ApiOperation({ summary: '标记履约节点完成' })
  async complete(@Body() dto: CompleteMilestoneDto, @Admin('userId') userId?: number) {
    return this.ok(await this.contractDetailService.completeMilestone(dto, userId));
  }

  @Delete('delete/:id')
  @Perms('delete')
  @ApiOperation({ summary: '删除履约节点' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.contractDetailService.deleteMilestone(id);
    return this.ok();
  }
}
