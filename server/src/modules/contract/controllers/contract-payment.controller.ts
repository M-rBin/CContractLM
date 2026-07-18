import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from '@/common/crud';
import { Admin, Perms } from '@/common/decorators';
import { AddPaymentPlanDto, RegisterPaymentPlanDto, UpdatePaymentPlanDto } from '../dto/contract.dto';
import { ContractDetailService } from '../services/contract-detail.service';

@ApiTags('合同收付款计划')
@Controller('admin/contract/payment')
export class ContractPaymentController extends BaseController {
  constructor(private readonly contractDetailService: ContractDetailService) {
    super();
  }

  @Get('list/:contractId')
  @Perms('list')
  @ApiOperation({ summary: '查询合同收付款计划列表' })
  async list(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.ok(await this.contractDetailService.listPayments(contractId));
  }

  @Post('add')
  @Perms('add')
  @ApiOperation({ summary: '新增收付款计划' })
  async add(@Body() dto: AddPaymentPlanDto) {
    return this.ok(await this.contractDetailService.addPayment(dto));
  }

  @Put('update')
  @Perms('update')
  @ApiOperation({ summary: '更新收付款计划' })
  async update(@Body() dto: UpdatePaymentPlanDto) {
    return this.ok(await this.contractDetailService.updatePayment(dto));
  }

  @Put('register')
  @Perms('register')
  @ApiOperation({ summary: '登记实际收付款' })
  async register(@Body() dto: RegisterPaymentPlanDto, @Admin('userId') userId?: number) {
    return this.ok(await this.contractDetailService.registerPayment(dto, userId));
  }

  @Delete('delete/:id')
  @Perms('delete')
  @ApiOperation({ summary: '删除收付款计划' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.contractDetailService.deletePayment(id);
    return this.ok();
  }
}
