import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { CreateTenantDto, UpdateTenantDto, TenantQueryDto } from '../dto/tenant.dto';

/**
 * 公司（租户）管理服务
 * 提供公司的 CRUD、分页查询、启用/停用操作。
 */
@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分页查询公司列表 */
  async page(query: TenantQueryDto) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 10), 1), 100);

    const where: any = {};
    if (query.name) where.name = { contains: query.name };
    if (query.status !== undefined) where.status = Number(query.status);

    const [rawList, total] = await Promise.all([
      this.prisma.sysTenant.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: 'desc' },
        include: { _count: { select: { userTenants: true } } },
      }),
      this.prisma.sysTenant.count({ where }),
    ]);

    const list = rawList.map(({ _count, ...item }) => ({
      ...item,
      userCount: _count.userTenants,
    }));

    return { list, pagination: { page, pageSize, total } };
  }

  /** 新增公司 */
  async create(dto: CreateTenantDto) {
    await this.assertCodeUnique(dto.code);
    return this.prisma.sysTenant.create({
      data: {
        name: dto.name,
        code: dto.code,
        status: dto.status ?? 1,
        remark: dto.remark,
      },
    });
  }

  /** 更新公司 */
  async update(id: number, dto: UpdateTenantDto) {
    await this.assertExists(id);
    if (dto.code) await this.assertCodeUnique(dto.code, id);
    return this.prisma.sysTenant.update({ where: { id }, data: dto });
  }

  /** 删除公司（存在关联用户时阻止） */
  async remove(id: number) {
    await this.assertExists(id);
    const userCount = await this.prisma.sysUserTenant.count({ where: { tenantId: id } });
    if (userCount > 0) {
      throw new BadRequestException('该公司下存在关联用户，无法删除，请先解除用户关联后重试');
    }
    return this.prisma.sysTenant.delete({ where: { id } });
  }

  /** 查询公司关联用户列表 */
  async getUsers(tenantId: number, keyword?: string) {
    await this.assertExists(tenantId);
    const where: any = { tenantId };
    if (keyword) {
      where.user = {
        OR: [{ username: { contains: keyword } }, { name: { contains: keyword } }],
      };
    }
    const relations = await this.prisma.sysUserTenant.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            status: true,
            department: { select: { name: true } },
          },
        },
      },
      take: 200,
      orderBy: { userId: 'asc' },
    });
    return relations.map((r) => r.user);
  }

  /** 查询可添加用户（未关联该公司的用户，排除 admin） */
  async getAvailableUsers(tenantId: number, keyword?: string) {
    await this.assertExists(tenantId);
    const linked = await this.prisma.sysUserTenant.findMany({
      where: { tenantId },
      select: { userId: true },
    });
    const linkedIds = linked.map((r) => r.userId);
    const where: any = {
      id: { notIn: linkedIds },
      username: { not: 'admin' },
      status: 1,
    };
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { name: { contains: keyword } },
      ];
    }
    return this.prisma.sysUser.findMany({
      where,
      select: { id: true, username: true, name: true, status: true, department: { select: { name: true } } },
      take: 50,
      orderBy: { id: 'asc' },
    });
  }

  /** 批量添加公司关联用户 */
  async addUsers(tenantId: number, userIds: number[]) {
    await this.assertExists(tenantId);
    await this.prisma.sysUserTenant.createMany({
      data: userIds.map((userId) => ({ userId, tenantId })),
      skipDuplicates: true,
    });
  }

  /** 移除公司关联用户 */
  async removeUser(tenantId: number, userId: number) {
    await this.assertExists(tenantId);
    await this.prisma.sysUserTenant.deleteMany({ where: { tenantId, userId } });
  }

  /** 切换启用/停用状态 */
  async toggleStatus(id: number, status: 0 | 1) {
    await this.assertExists(id);
    return this.prisma.sysTenant.update({ where: { id }, data: { status } });
  }

  private async assertExists(id: number) {
    const tenant = await this.prisma.sysTenant.findUnique({ where: { id } });
    if (!tenant) throw new BadRequestException('公司不存在');
    return tenant;
  }

  private async assertCodeUnique(code: string, excludeId?: number) {
    const existing = await this.prisma.sysTenant.findUnique({ where: { code } });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(`公司编码【${code}】已存在，请更换`);
    }
  }
}
