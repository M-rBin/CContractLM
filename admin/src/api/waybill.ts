import request from '@/utils/http'

export type WaybillStatus = 'pending' | 'transit' | 'arrived' | 'unloading' | 'completed'

export const STATUS_LABELS: Record<WaybillStatus, string> = {
  pending: '待发运',
  transit: '在途',
  arrived: '到库',
  unloading: '待接卸',
  completed: '已完成'
}

export interface WaybillStatusLog {
  id: number
  remark: string
  operatedBy: string
  operatedAt: string
}

export interface Waybill {
  id: number
  waybillNo: string
  status: WaybillStatus
  refineryName: string
  depotName: string
  oilType: string
  planWeight: number
  carrierName: string
  driverName: string
  plateNo: string
  createdBy: string
  planDepartTime?: string | null
  departTime?: string | null
  loadConfirmWeight?: number | null
  outboundWeight?: number | null
  inboundWeight?: number | null
  actualWeight?: number | null
  createdAt: string
  statusLogs?: WaybillStatusLog[]
}

/**
 * 获取运单详情
 */
export function getWaybillDetail(id: number) {
  return request.get<Waybill & { statusLogs: WaybillStatusLog[] }>({
    url: `/admin/waybill/detail/${id}`
  })
}
