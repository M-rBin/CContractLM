import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { PERMS_ACTION_KEY, derivePerm } from '../decorators/perms.decorator';
import { getCrudOptions } from '../crud/crud.decorator';

// 公开接口标记元数据 key（与 @Public 装饰器共用）
export const IS_PUBLIC_KEY = 'isPublic';

// 通过接口 + token 注入，避免直接 import AuthService 产生循环依赖
export interface IAuthPermsService {
  getPerms(userId: number): Promise<string[]>;
}
export const AUTH_PERMS_SERVICE = 'AUTH_PERMS_SERVICE';

/**
 * 权限守卫（声明式 RBAC，对齐 RuoYi/Spring Security 模式）
 *
 * 规则：
 * - @Public 标记 → 放行
 * - 未声明 @Perms 的接口 → 视为仅需登录、无需权限点，放行
 * - 超管（admin）→ 放行所有
 * - 其余 → 派生权限点，命中用户权限列表才放行（缓存 miss 时自动重建并写回）
 */
@Injectable()
export class PermsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(AUTH_PERMS_SERVICE) private authService: IAuthPermsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const action = this.reflector.get<string>(PERMS_ACTION_KEY, context.getHandler());
    if (!action) return true;

    const request = context.switchToHttp().getRequest();
    const admin = request.admin;

    if (!admin) return false;

    if (admin.username === 'admin') return true;

    const cls = context.getClass();
    const prefix =
      getCrudOptions(cls)?.prefix ??
      Reflect.getMetadata(PATH_METADATA, cls) ??
      '';
    const requiredPerm = derivePerm(prefix, action);

    // getPerms 内部先读 Redis 缓存，miss 时查库重建并写回
    const perms = await this.authService.getPerms(admin.userId);

    if (!perms.includes(requiredPerm)) {
      throw new ForbiddenException('无权限访问~');
    }

    return true;
  }
}
