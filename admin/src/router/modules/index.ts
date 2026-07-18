import { AppRouteRecord } from '@/types/router'
import { dictTemplateRoutes } from './dict-template'
import { organizationTemplateRoutes } from './organization-template'
import { permissionTemplateRoutes } from './permission-template'
export const routeModules: AppRouteRecord[] = [
  organizationTemplateRoutes,
  permissionTemplateRoutes,
  dictTemplateRoutes,
]
