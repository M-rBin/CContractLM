import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BaseController } from '@/common/crud';
import { ApiArrayResult, ApiOkVoid, ApiResult, Perms } from '@/common/decorators';
import { AiConfigService } from '../services/ai-config.service';
import { AiConfigVo } from '../vo/ai-config.vo';
import {
  AddAiConfigDto,
  UpdateAiConfigDto,
  TestAiConfigDto,
} from '../dto/ai-config.dto';

/**
 * AI 配置管理控制器
 *
 * 前缀 admin/ai/config 派生权限点 ai:config:*，与菜单 ai:config:list 对齐。
 * 密钥在服务层加密存储、脱敏返回，控制器不接触明文。
 */
@ApiTags('AI 配置管理')
@Controller('admin/ai/config')
export class AiConfigController extends BaseController {
  constructor(private readonly service: AiConfigService) {
    super();
  }

  @Get('list')
  @Perms('list')
  @ApiOperation({ summary: '查询 AI 配置列表' })
  @ApiArrayResult(AiConfigVo)
  async list() {
    return this.ok(await this.service.list());
  }

  @Get('detail/:id')
  @Perms('detail')
  @ApiOperation({ summary: '查询 AI 配置详情' })
  @ApiResult(AiConfigVo)
  async detail(@Param('id', ParseIntPipe) id: number) {
    return this.ok(await this.service.detail(id));
  }

  @Post('add')
  @Perms('add')
  @ApiOperation({ summary: '新增 AI 配置' })
  @ApiResult(AiConfigVo)
  async add(@Body() dto: AddAiConfigDto) {
    return this.ok(await this.service.create(dto));
  }

  @Put('update')
  @Perms('update')
  @ApiOperation({ summary: '更新 AI 配置' })
  @ApiResult(AiConfigVo)
  async update(@Body() dto: UpdateAiConfigDto) {
    return this.ok(await this.service.update(dto));
  }

  @Delete('delete/:id')
  @Perms('delete')
  @ApiOperation({ summary: '删除 AI 配置（默认配置不可删除）' })
  @ApiOkVoid()
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return this.ok();
  }

  @Put('set-default/:id')
  @Perms('update')
  @ApiOperation({ summary: '设为默认配置' })
  @ApiOkVoid()
  async setDefault(@Param('id', ParseIntPipe) id: number) {
    await this.service.setDefault(id);
    return this.ok();
  }

  @Put('toggle-enabled/:id/:isEnabled')
  @Perms('update')
  @ApiOperation({ summary: '启用/停用配置' })
  @ApiOkVoid()
  async toggleEnabled(
    @Param('id', ParseIntPipe) id: number,
    @Param('isEnabled', ParseIntPipe) isEnabled: number,
  ) {
    await this.service.toggleEnabled(id, isEnabled);
    return this.ok();
  }

  @Post('test')
  @Perms('update')
  @ApiOperation({ summary: '连接测试' })
  @ApiOkVoid()
  async test(@Body() dto: TestAiConfigDto) {
    return this.ok(await this.service.testConnection(dto));
  }
}
