import request from '@/utils/http'

export interface TenantItem {
  id: number
  name: string
  code: string
  status: number
  remark?: string | null
  createTime: string
  updateTime: string
  userCount?: number
}

export interface TenantQuery {
  name?: string
  status?: number
  page?: number
  pageSize?: number
}

/**
 * 分页查询公司列表
 */
export function getTenantPage(params?: TenantQuery) {
  return request.get<{ list: TenantItem[]; pagination: { page: number; pageSize: number; total: number } }>({
    url: '/admin/tenant/page',
    params
  })
}

/**
 * 新增公司
 */
export function createTenant(data: { name: string; code: string; status?: number; remark?: string }) {
  return request.post<TenantItem>({
    url: '/admin/tenant',
    data
  })
}

/**
 * 更新公司
 */
export function updateTenant(id: number, data: { name?: string; code?: string; status?: number; remark?: string }) {
  return request.put<TenantItem>({
    url: `/admin/tenant/${id}`,
    data
  })
}

/**
 * 删除公司
 */
export function deleteTenant(id: number) {
  return request.del({
    url: `/admin/tenant/${id}`
  })
}

/**
 * 启用公司
 */
export function enableTenant(id: number) {
  return request.put({
    url: `/admin/tenant/${id}/enable`
  })
}

/**
 * 停用公司
 */
export function disableTenant(id: number) {
  return request.put({
    url: `/admin/tenant/${id}/disable`
  })
}

export interface TenantUser {
  id: number
  username: string
  name: string | null
  status: number
  department: { name: string } | null
}

/**
 * 查询公司关联用户
 */
export function getTenantUsers(tenantId: number, keyword?: string) {
  return request.get<TenantUser[]>({
    url: `/admin/tenant/${tenantId}/users`,
    params: keyword ? { keyword } : undefined
  })
}

/**
 * 查询可添加用户（未关联该公司）
 */
export function getAvailableTenantUsers(tenantId: number, keyword?: string) {
  return request.get<TenantUser[]>({
    url: `/admin/tenant/${tenantId}/available-users`,
    params: keyword ? { keyword } : undefined
  })
}

/**
 * 批量添加关联用户
 */
export function addTenantUsers(tenantId: number, userIds: number[]) {
  return request.post({
    url: `/admin/tenant/${tenantId}/users`,
    data: { userIds }
  })
}

/**
 * 移除关联用户
 */
export function removeTenantUser(tenantId: number, userId: number) {
  return request.del({
    url: `/admin/tenant/${tenantId}/users/${userId}`
  })
}
