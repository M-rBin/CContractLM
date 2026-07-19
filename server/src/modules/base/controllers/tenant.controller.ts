import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, ForbiddenException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseController } from '@/common/crud';
import { Admin } from '@/common/decorators';
import { TenantService } from '../services/tenant.service';
import { CreateTenantDto, UpdateTenantDto, TenantQueryDto } from '../dto/tenant.dto';

class AddTenantUsersDto {
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  userIds: number[];
}

class TenantUserQueryDto {
  @IsString()
  @IsOptional()
  keyword?: string;
}

/**
 * 公司管理接口
 * 仅超级管理员可操作，提供公司的增删改查和启用/停用。
 */
@ApiTags('公司管理')
@Controller('admin/tenant')
export class TenantController extends BaseController {
  constructor(private readonly tenantService: TenantService) {
    super();
  }

  private assertSuperAdmin(admin: any) {
    if (admin?.username !== 'admin') {
      throw new ForbiddenException('仅超级管理员可操作');
    }
  }

  /** 分页查询公司列表 */
  @Get('page')
  @ApiOperation({ summary: '分页查询公司列表' })
  async page(@Query() query: TenantQueryDto) {
    return this.ok(await this.tenantService.page(query));
  }

  /** 新增公司 */
  @Post()
  @ApiOperation({ summary: '新增公司' })
  async create(@Body() dto: CreateTenantDto, @Admin() admin: any) {
    this.assertSuperAdmin(admin);
    return this.ok(await this.tenantService.create(dto));
  }

  /** 更新公司 */
  @Put(':id')
  @ApiOperation({ summary: '更新公司' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTenantDto, @Admin() admin: any) {
    this.assertSuperAdmin(admin);
    return this.ok(await this.tenantService.update(id, dto));
  }

  /** 删除公司 */
  @Delete(':id')
  @ApiOperation({ summary: '删除公司' })
  async remove(@Param('id', ParseIntPipe) id: number, @Admin() admin: any) {
    this.assertSuperAdmin(admin);
    return this.ok(await this.tenantService.remove(id));
  }

  /** 启用公司 */
  @Put(':id/enable')
  @ApiOperation({ summary: '启用公司' })
  async enable(@Param('id', ParseIntPipe) id: number, @Admin() admin: any) {
    this.assertSuperAdmin(admin);
    return this.ok(await this.tenantService.toggleStatus(id, 1));
  }

  /** 停用公司 */
  @Put(':id/disable')
  @ApiOperation({ summary: '停用公司' })
  async disable(@Param('id', ParseIntPipe) id: number, @Admin() admin: any) {
    this.assertSuperAdmin(admin);
    return this.ok(await this.tenantService.toggleStatus(id, 0));
  }

  /** 查询公司关联用户列表 */
  @Get(':id/users')
  @ApiOperation({ summary: '查询公司关联用户' })
  async getUsers(@Param('id', ParseIntPipe) id: number, @Query() query: TenantUserQueryDto) {
    return this.ok(await this.tenantService.getUsers(id, query.keyword));
  }

  /** 查询可添加用户（未关联该公司的启用用户） */
  @Get(':id/available-users')
  @ApiOperation({ summary: '查询可添加用户' })
  async getAvailableUsers(@Param('id', ParseIntPipe) id: number, @Query() query: TenantUserQueryDto) {
    return this.ok(await this.tenantService.getAvailableUsers(id, query.keyword));
  }

  /** 批量添加公司关联用户 */
  @Post(':id/users')
  @ApiOperation({ summary: '批量添加关联用户' })
  async addUsers(@Param('id', ParseIntPipe) id: number, @Body() dto: AddTenantUsersDto, @Admin() admin: any) {
    this.assertSuperAdmin(admin);
    return this.ok(await this.tenantService.addUsers(id, dto.userIds));
  }

  /** 移除公司关联用户 */
  @Delete(':id/users/:userId')
  @ApiOperation({ summary: '移除关联用户' })
  async removeUser(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Admin() admin: any,
  ) {
    this.assertSuperAdmin(admin);
    return this.ok(await this.tenantService.removeUser(id, userId));
  }
}
