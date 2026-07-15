import { AppRouteRecord } from '@/types/router'

/**
 * 系统配置路由
 * 包含：字典管理、操作日志
 */
export const dictTemplateRoutes: AppRouteRecord = {
  path: '/dict-template',
  name: 'DictTemplate',
  component: () => import('@/views/index/index.vue'),
  meta: {
    title: 'menus.dictTemplate.title',
    icon: 'Setting',
    isFirstLevel: true
  },
  children: [
    {
      path: '',
      name: 'DictTemplateIndex',
      component: () => import('@/views/dict/index.vue'),
      meta: {
        title: 'menus.dictTemplate.title',
        keepAlive: true,
        isHide: true
      }
    },
    {
      path: 'dict',
      name: 'DictTemplateDict',
      component: () => import('@/views/dict/index.vue'),
      meta: {
        title: 'menus.dictTemplate.dict',
        keepAlive: true
      }
    },
    {
      path: 'log',
      name: 'DictTemplateLog',
      component: () => import('@/views/log/index.vue'),
      meta: {
        title: 'menus.dictTemplate.log',
        keepAlive: true
      }
    }
  ]
}
