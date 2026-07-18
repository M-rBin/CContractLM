import request from '@/utils/http'

export interface DictTypeItem {
  id: number
  name: string
  key: string
  createTime: string
  updateTime: string
}

export interface DictInfoItem {
  id: number
  typeId: number
  name: string
  value: string
  orderNum: number
  remark: string | null
  createTime: string
  updateTime: string
}

export interface PageResult<T> {
  list: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

/**
 * 获取字典类型列表（分页）
 */
export function getDictTypeList(params?: {
  keyword?: string
  page?: number
  pageSize?: number
}) {
  return request.get<PageResult<DictTypeItem>>({
    url: '/admin/dict/type/list',
    params
  })
}

/**
 * 新增字典类型
 */
export function addDictType(data: {
  name: string
  key: string
}) {
  return request.post({
    url: '/admin/dict/type/add',
    data
  })
}

/**
 * 更新字典类型
 */
export function updateDictType(data: {
  id: number
  name?: string
  key?: string
}) {
  return request.put({
    url: '/admin/dict/type/update',
    data
  })
}

/**
 * 删除字典类型
 */
export function deleteDictType(id: number) {
  return request.del({
    url: `/admin/dict/type/delete/${id}`
  })
}

/**
 * 获取字典项列表（分页）
 */
export function getDictInfoList(params?: {
  keyword?: string
  typeId?: number
  page?: number
  pageSize?: number
}) {
  return request.get<PageResult<DictInfoItem>>({
    url: '/admin/dict/info/list',
    params
  })
}

/**
 * 新增字典项
 */
export function addDictInfo(data: {
  typeId: number
  name: string
  value: string
  orderNum?: number
  remark?: string
}) {
  return request.post({
    url: '/admin/dict/info/add',
    data
  })
}

/**
 * 更新字典项
 */
export function updateDictInfo(data: {
  id: number
  typeId?: number
  name?: string
  value?: string
  orderNum?: number
  remark?: string
}) {
  return request.put({
    url: '/admin/dict/info/update',
    data
  })
}

/**
 * 删除字典项
 */
export function deleteDictInfo(id: number) {
  return request.del({
    url: `/admin/dict/info/delete/${id}`
  })
}
