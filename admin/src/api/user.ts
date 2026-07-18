/**
 * 用户管理 API — 桥接 organization.ts
 */

import {
  getUserList,
  addUser,
  updateUser,
  deleteUser,
  batchDeleteUsers,
  updateUserStatus
} from './organization'
import request from '@/utils/http'

export interface AdminUserRole {
  role: {
    id: number
    name: string
    label?: string | null
  }
}

export interface AdminUser {
  id: number
  username: string
  workId?: string | null
  name?: string | null
  nickName?: string | null
  headImg?: string | null
  phone?: string | null
  email?: string | null
  remark?: string | null
  status: number
  departmentId?: number | null
  positionId?: number | null
  createTime: string
  updateTime: string
  department?: { id: number; name: string } | null
  position?: { id: number; name: string } | null
  userRoles?: AdminUserRole[]
}

export interface ImportUserRow {
  username: string
  password: string
  name?: string
  phone?: string
  email?: string
  departmentId?: number
  positionId?: number
  roleIds?: number[]
}

export function batchSetUserPosition(ids: number[], positionId: number) {
  return request.post({
    url: '/admin/sys/user/batch-set-position',
    data: { ids, positionId }
  })
}

export function batchSetUserRoles(ids: number[], roleIds: number[]) {
  return request.post({
    url: '/admin/sys/user/batch-set-roles',
    data: { ids, roleIds }
  })
}

export function importUsers(rows: ImportUserRow[]) {
  return request.post<{ count: number }>({
    url: '/admin/sys/user/import',
    data: { rows }
  })
}

export function exportUsers(params?: {
  keyword?: string
  status?: number
  departmentId?: number
}) {
  return request.get<Blob | string>({
    url: '/admin/sys/user/export',
    params,
    responseType: 'blob',
    skipResponseValidation: true
  })
}

export const userApi = {
  getList: getUserList,
  add: addUser,
  update: updateUser,
  delete: deleteUser,
  batchDelete: batchDeleteUsers,
  updateStatus: updateUserStatus,
  batchSetPosition: batchSetUserPosition,
  batchSetRoles: batchSetUserRoles,
  import: importUsers,
  export: exportUsers
}
