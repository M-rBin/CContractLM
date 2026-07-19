import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/common/prisma.service';
import { RedisService } from '@/common/redis.service';

/**
 * 认证授权服务
 * 负责后台用户的登录、token 签发与刷新、登出，以及权限（perms）的缓存维护。
 * token 与权限均以 Redis 缓存，并通过 passwordVersion 实现改密后旧 token 失效。
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 用户登录
   * 校验用户名密码（bcrypt 比对），校验公司归属，签发含 tenantId 的 access/refresh token。
   * @param username 用户名
   * @param password 明文密码
   * @param tenantId 登录时选择的公司 ID（超级管理员传 0 表示不限制）
   */
  async login(username: string, password: string, tenantId?: number) {
    const user = await this.prisma.sysUser.findUnique({
      where: { username },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw new BadRequestException('用户名或密码错误');
    }

    if (user.status === 0) {
      throw new BadRequestException('用户已被禁用');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new BadRequestException('用户名或密码错误');
    }

    // 超级管理员不校验公司归属，tenantId 固定为 0
    const isSuperAdmin = username === 'admin';
    let resolvedTenantId = 0;

    if (!isSuperAdmin) {
      if (!tenantId) {
        throw new BadRequestException('请选择登录公司');
      }
      // 校验用户与公司的关联关系，且公司必须为启用状态
      const userTenant = await this.prisma.sysUserTenant.findFirst({
        where: { userId: user.id, tenantId },
        include: { tenant: { select: { status: true } } },
      });
      if (!userTenant || userTenant.tenant.status !== 1) {
        throw new BadRequestException('无权访问该公司');
      }
      resolvedTenantId = tenantId;
    }

    const roleIds = user.userRoles.map((ur) => ur.roleId);
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      roleIds,
      tenantId: resolvedTenantId,
      passwordVersion: user.passwordV,
    };

    const accessExpire = Number(this.configService.get<number>('JWT_ACCESS_EXPIRE', 7200));
    const refreshExpire = Number(this.configService.get<number>('JWT_REFRESH_EXPIRE', 1296000));

    const accessToken = this.jwtService.sign(tokenPayload, {
      expiresIn: accessExpire,
    });
    const refreshToken = this.jwtService.sign(
      { ...tokenPayload, isRefresh: true },
      { expiresIn: refreshExpire },
    );
    await this.redis.set(`admin:token:${user.id}`, accessToken, accessExpire);
    await this.redis.set(`admin:refreshToken:${user.id}`, refreshToken, refreshExpire);
    await this.redis.set(`admin:passwordVersion:${user.id}`, String(user.passwordV), refreshExpire);
    await this.cachePerms(user.id, roleIds);

    return {
      token: accessToken,
      refreshToken,
      expire: accessExpire,
    };
  }

  /**
   * 获取用户可登录的公司列表
   * 用户名输入框失焦时调用，返回该账号关联且状态为启用的公司列表。
   * 超级管理员返回所有启用公司。
   * @param username 用户名
   */
  async getTenantList(username: string) {
    if (username === 'admin') {
      return this.prisma.sysTenant.findMany({
        where: { status: 1 },
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
      });
    }

    const user = await this.prisma.sysUser.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!user) return [];

    const relations = await this.prisma.sysUserTenant.findMany({
      where: { userId: user.id, tenant: { status: 1 } },
      include: { tenant: { select: { id: true, name: true } } },
    });
    return relations.map((r) => ({ id: r.tenant.id, name: r.tenant.name }));
  }

  /**
   * 刷新 access token
   * 校验 refresh token 的有效性，通过后签发新的 access token（含 tenantId）。
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      if (!payload.isRefresh) {
        throw new BadRequestException('token 无效');
      }

      const cached = await this.redis.get(`admin:refreshToken:${payload.userId}`);
      if (!cached || cached !== refreshToken) {
        throw new BadRequestException('token 已失效');
      }

      const user = await this.prisma.sysUser.findUnique({
        where: { id: payload.userId },
      });
      if (!user || user.passwordV !== payload.passwordVersion) {
        throw new BadRequestException('token 已失效');
      }

      const accessExpire = Number(this.configService.get<number>('JWT_ACCESS_EXPIRE', 7200));
      const newToken = this.jwtService.sign(
        {
          userId: user.id,
          username: user.username,
          roleIds: payload.roleIds,
          tenantId: payload.tenantId ?? 0,
          passwordVersion: user.passwordV,
        },
        { expiresIn: accessExpire },
      );

      await this.redis.set(`admin:token:${user.id}`, newToken, accessExpire);

      return { token: newToken, expire: accessExpire };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('token 无效');
    }
  }

  /**
   * 获取用户权限标识列表
   */
  async getPerms(userId: number) {
    const permsStr = await this.redis.get(`admin:perms:${userId}`);
    if (permsStr) {
      try {
        return JSON.parse(permsStr);
      } catch {
        // fall through to rebuild
      }
    }

    const user = await this.prisma.sysUser.findUnique({
      where: { id: userId },
      include: { userRoles: true },
    });
    if (!user) return [];

    const roleIds = user.userRoles.map((ur) => ur.roleId);
    return this.cachePerms(userId, roleIds);
  }

  /**
   * 获取当前登录用户的资料信息
   */
  async getAdminInfo(userId: number) {
    const user = await this.prisma.sysUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        nickName: true,
        headImg: true,
        phone: true,
        email: true,
        remark: true,
        status: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        userRoles: { include: { role: { select: { id: true, name: true, label: true } } } },
      },
    });

    return user;
  }

  /**
   * 用户登出
   */
  async logout(userId: number) {
    await this.redis.del(`admin:token:${userId}`);
    await this.redis.del(`admin:refreshToken:${userId}`);
    await this.redis.del(`admin:perms:${userId}`);
  }

  /**
   * 生成密码哈希
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  private async cachePerms(userId: number, roleIds: number[]): Promise<string[]> {
    if (!roleIds.length) return [];

    const roleMenus = await this.prisma.sysRoleMenu.findMany({
      where: { roleId: { in: roleIds } },
      include: { menu: { select: { perms: true } } },
    });

    const perms = roleMenus
      .map((rm) => rm.menu.perms)
      .filter((p): p is string => !!p);

    const uniquePerms = [...new Set(perms)];
    const accessExpire = Number(this.configService.get<number>('JWT_ACCESS_EXPIRE', 7200));
    await this.redis.set(`admin:perms:${userId}`, JSON.stringify(uniquePerms), accessExpire);

    return uniquePerms;
  }
}
