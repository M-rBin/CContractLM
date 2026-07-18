import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma.service';
import { BaseService } from '@/common/crud';
import { ImportUserRowDto } from '../dto/base.dto';

/**
 * 用户管理服务
 * 在基础增删改查之上，提供部门迁移、用户-角色关联维护等能力。
 */
@Injectable()
export class UserService extends BaseService {
  constructor(protected prisma: PrismaService) {
    super(prisma, 'sysUser');
  }

  /**
   * 校验待删除用户中是否包含超级管理员（username='admin'）
   * 超级管理员为系统内置账号，禁止删除；命中则抛出 400 异常
   * @param ids 待删除的用户 ID 列表
   */
  async ensureNoSuperAdmin(ids: number[]) {
    const superAdmin = await this.prisma.sysUser.findFirst({
      where: { id: { in: ids }, username: 'admin' },
      select: { id: true },
    });
    if (superAdmin) {
      throw new BadRequestException('超级管理员不允许删除');
    }
  }

  /**
   * 将用户迁移到指定部门
   * @param userId 用户 ID
   * @param departmentId 目标部门 ID
   */
  async move(userId: number, departmentId: number) {
    await this.prisma.sysUser.update({
      where: { id: userId },
      data: { departmentId },
    });
  }

  /**
   * 更新用户主表信息，并在同一事务内同步角色关联
   * @param roleIds undefined=不修改角色；[]=清空所有角色；[...]=替换为指定角色
   */
  async updateWithRoles(
    userId: number,
    data: Prisma.SysUserUncheckedUpdateInput,
    roleIds?: number[],
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.sysUser.update({ where: { id: userId }, data });
      if (roleIds !== undefined) {
        await tx.sysUserRole.deleteMany({ where: { userId } });
        if (roleIds.length) {
          await tx.sysUserRole.createMany({
            data: roleIds.map((roleId) => ({ userId, roleId })),
          });
        }
      }
    });
  }

  /**
   * 设置用户的角色（全量覆盖）
   * 在同一事务中先清空用户原有角色关联，再批量写入新角色，保证替换的原子性。
   * @param userId 用户 ID
   * @param roleIds 该用户最终应拥有的角色 ID 列表
   */
  async setRoles(userId: number, roleIds: number[]) {
    await this.prisma.$transaction([
      this.prisma.sysUserRole.deleteMany({ where: { userId } }),
      this.prisma.sysUserRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
      }),
    ]);
  }

  /**
   * 批量设置用户岗位
   * @param ids 用户 ID 列表
   * @param positionId 岗位 ID
   */
  async batchSetPosition(ids: number[], positionId: number) {
    await this.prisma.sysUser.updateMany({
      where: { id: { in: ids } },
      data: { positionId },
    });
  }

  /**
   * 批量设置用户角色（全量覆盖）
   * @param ids 用户 ID 列表
   * @param roleIds 角色 ID 列表
   */
  async batchSetRoles(ids: number[], roleIds: number[]) {
    await this.prisma.$transaction(async (tx) => {
      await tx.sysUserRole.deleteMany({ where: { userId: { in: ids } } });
      if (roleIds.length) {
        await tx.sysUserRole.createMany({
          data: ids.flatMap((userId) => roleIds.map((roleId) => ({ userId, roleId }))),
        });
      }
    });
  }

  /**
   * 导入用户
   * @param rows 已完成密码哈希处理的导入行
   */
  async importUsers(rows: ImportUserRowDto[]) {
    const usernames = rows.map((row) => row.username.trim()).filter(Boolean);
    const duplicatedInFile = usernames.find((username, index) => usernames.indexOf(username) !== index);
    if (duplicatedInFile) {
      throw new BadRequestException(`导入文件中账号【${duplicatedInFile}】重复，请检查`);
    }

    const exists = await this.prisma.sysUser.findFirst({
      where: { username: { in: usernames } },
      select: { username: true },
    });
    if (exists) {
      throw new BadRequestException(`账号【${exists.username}】已存在，请更换`);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const { roleIds, ...userData } = row;
        const user = await tx.sysUser.create({
          data: {
            ...userData,
            username: row.username.trim(),
            name: row.name?.trim() || undefined,
            phone: row.phone?.trim() || undefined,
            email: row.email?.trim() || undefined,
          },
          select: { id: true },
        });
        if (roleIds?.length) {
          await tx.sysUserRole.createMany({
            data: roleIds.map((roleId) => ({ userId: user.id, roleId })),
          });
        }
      }
    });

    return { count: rows.length };
  }

  /**
   * 导出用户数据
   */
  async listForExport(query: { keyword?: string; status?: string | number; departmentId?: string | number }) {
    const where: Prisma.SysUserWhereInput = {};
    if (query.keyword) {
      where.OR = ['name', 'username', 'phone'].map((field) => ({
        [field]: { contains: query.keyword },
      }));
    }
    if (query.status !== undefined && query.status !== '') {
      where.status = Number(query.status);
    }
    if (query.departmentId !== undefined && query.departmentId !== '') {
      where.departmentId = Number(query.departmentId);
    }

    return this.prisma.sysUser.findMany({
      where,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
        userRoles: { select: { role: { select: { name: true } } } },
        createTime: true,
      },
    });
  }
}
