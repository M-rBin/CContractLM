import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { BaseService, PageOptions, PageResult } from '@/common/crud';

/**
 * 系统操作日志服务
 * 负责记录用户操作行为并提供日志清理能力。
 */
@Injectable()
export class LogService extends BaseService {
  constructor(protected prisma: PrismaService) {
    super(prisma, 'sysLog');
  }

  /**
   * 记录一条用户操作日志
   */
  async record(userId: number, action: string, ip: string, params?: string, description?: string) {
    await this.prisma.sysLog.create({
      data: { userId, action, ip, params, description },
    });
  }

  /** 分页查询，支持按操作人姓名过滤并自动拼接操作人名称 */
  async page(options: PageOptions, where?: any, select?: any, include?: any): Promise<PageResult<any>> {
    // buildWhere 的数字转换逻辑可能把纯数字用户名从 string 转为 number，
    // 此处强制转回 string，防止 Prisma contains 查询收到 number 类型报错
    const usernameFilter: string | undefined =
      where?.username != null ? String(where.username) : undefined;
    let finalWhere = where;
    if (usernameFilter) {
      const { username: _, ...restWhere } = where;
      const matchedUsers = await this.prisma.sysUser.findMany({
        where: { OR: [{ name: { contains: usernameFilter } }, { username: { contains: usernameFilter } }] },
        select: { id: true },
      });
      finalWhere = { ...restWhere, userId: { in: matchedUsers.map((u) => u.id) } };
    }

    const result = await super.page(options, finalWhere, select, include);

    const userIds = [...new Set(
      result.list.map((item: any) => item.userId).filter((id: any) => id != null),
    )] as number[];

    let usernameMap: Record<number, string> = {};
    if (userIds.length > 0) {
      const users = await this.prisma.sysUser.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, username: true },
      });
      usernameMap = Object.fromEntries(
        users.map((u) => [u.id, u.name || u.username]),
      );
    }

    return {
      ...result,
      list: result.list.map((item: any) => ({
        ...item,
        username: item.userId != null ? (usernameMap[item.userId] ?? null) : null,
      })),
    };
  }

  /** 清空全部操作日志 */
  async clear() {
    await this.prisma.sysLog.deleteMany({});
  }
}
