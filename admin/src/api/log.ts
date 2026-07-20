import request from '@/utils/http'

export interface OperLogItem {
  id: number
  userId: number | null
  username: string | null
  action: string | null
  description: string | null
  ip: string | null
  ipAddr: string | null
  params: string | null
  createTime: string
  updateTime: string
}

export interface OperLogPageResult {
  list: OperLogItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

/**
 * 获取操作日志列表（分页）
 */
export function getOperLogList(params?: {
  keyword?: string
  username?: string
  page?: number
  pageSize?: number
  order?: string
  sort?: 'asc' | 'desc'
}) {
  return request.get<OperLogPageResult>({
    url: '/admin/sys/log/list',
    params
  })
}
