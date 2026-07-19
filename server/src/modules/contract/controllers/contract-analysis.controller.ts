import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from '@/common/crud';
import { Admin, Perms } from '@/common/decorators';
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
  async overview(@Query() query: Record<string, any>, @Admin() admin: any) {
    // 超级管理员可通过 query.tenantId 指定公司；普通用户强制使用 JWT 中的 tenantId，不允许覆盖
    const isSuperAdmin = admin?.username === 'admin';
    let tenantId: number | undefined;
    if (isSuperAdmin) {
      // 超管不传 tenantId 时查全库（tenantId=undefined），传了则按指定公司过滤
      const parsed = query.tenantId !== undefined ? Number(query.tenantId) : undefined;
      tenantId = Number.isFinite(parsed) && (parsed as number) > 0 ? parsed : undefined;
    } else {
      // 普通用户：tenantId 来自 JWT，为 0（未绑定公司）时仍传入让 service 决策
      tenantId = admin?.tenantId;
    }
    return this.ok(await this.aggregateService.analysisOverview(query, tenantId));
  }
}
