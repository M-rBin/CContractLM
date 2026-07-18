import request from '@/utils/http'

export const CONTRACT_TYPES = ['采购合同', '销售合同', '服务合同', '租赁合同', '框架协议', '其他合同']
export const CONTRACT_STATUS = ['草稿', '履行中', '已到期', '已终止', '已归档']
export const CONTRACT_CURRENCIES = ['人民币', '美元', '欧元', '其他']
export const CONTRACT_ATTACHMENT_CATEGORIES = ['合同正文', '补充协议', '验收材料', '发票', '付款凭证', '其他附件']
export const CONTRACT_PENDING_STATUS = ['待处理', '已完成', '逾期']
export const CONTRACT_PAYMENT_DIRECTIONS = ['收款', '付款']

export interface ContractItem {
  id: number
  code: string
  name: string
  type: string
  signSubject: string
  counterparty: string
  amount: string | number
  currency: string
  signDate: string
  effectiveDate: string
  expireDate: string
  ownerId?: number | null
  ownerName?: string | null
  status: string
  remark?: string | null
  createTime: string
  updateTime: string
  /** 已完成实付金额汇总（含收付两个方向） */
  receivedAmount?: number
  /** 待执行金额 = 合同总金额 - 所有实际已支付金额 */
  remainingPerformanceAmount?: number
}

export interface ContractQuery {
  keyword?: string
  type?: string
  status?: string
  counterparty?: string
  ownerId?: number
  signDateStart?: string
  signDateEnd?: string
  effectiveDateStart?: string
  effectiveDateEnd?: string
  expireDateStart?: string
  expireDateEnd?: string
  page?: number
  pageSize?: number
}

export type ContractPayload = Omit<ContractItem, 'id' | 'createTime' | 'updateTime'>

export interface ContractAttachment {
  id: number
  contractId: number
  category: string
  fileName: string
  fileSize: number
  uploaderName?: string | null
  createTime: string
}

export interface ContractMilestone {
  id: number
  contractId: number
  name: string
  planDate: string
  actualDate?: string | null
  ownerId?: number | null
  ownerName?: string | null
  status: string
  remark?: string | null
  completeRemark?: string | null
}

export interface ContractPaymentPlan {
  id: number
  contractId: number
  direction: string
  planAmount: string | number
  planDate: string
  actualAmount?: string | number | null
  actualDate?: string | null
  /** 累计已登记金额 */
  paidAmount?: string | number | null
  /** 剩余未登记金额（planAmount - paidAmount） */
  remainingAmount?: string | number | null
  status: string
  remark?: string | null
}

export interface ContractOperRecord {
  id: number
  contractId?: number | null
  operType: string
  operTarget?: string | null
  operatorName?: string | null
  operDesc?: string | null
  createTime: string
}

export interface ContractDetailData extends ContractItem {
  attachments: ContractAttachment[]
  milestones: ContractMilestone[]
  payments: ContractPaymentPlan[]
  operRecords: ContractOperRecord[]
}

export interface ContractReminder {
  id: number
  type: string
  contractId: number
  contract?: ContractItem
  content: string
  sourceId?: number | null
  sourceType: string
  planDate: string
  overdueStatus: string
  handleStatus: string
}

export interface PaymentManageItem extends ContractPaymentPlan {
  contract?: ContractItem
}

export interface PaymentStat {
  receivableTotal: number
  payableTotal: number
  pendingReceive: number
  pendingPay: number
  overdueTotal: number
}

export function getContractList(params: ContractQuery) {
  return request.get<{ list: ContractItem[]; pagination: { page: number; pageSize: number; total: number } }>({
    url: '/admin/contract/info/list',
    params
  })
}

export function addContract(data: ContractPayload) {
  return request.post<ContractItem>({
    url: '/admin/contract/info/add',
    data
  })
}

export function updateContract(data: ContractPayload & { id: number }) {
  return request.put<ContractItem>({
    url: '/admin/contract/info/update',
    data
  })
}

export function deleteContract(id: number) {
  return request.del({
    url: `/admin/contract/info/delete/${id}`
  })
}

export function exportContracts(params: ContractQuery) {
  return request.get<Blob | string>({
    url: '/admin/contract/info/export',
    params,
    responseType: 'blob',
    skipResponseValidation: true
  })
}

export function getContractDetail(contractId: number) {
  return request.get<ContractDetailData>({
    url: `/admin/contract/detail/${contractId}`
  })
}

export function uploadContractAttachment(
  data: FormData,
  onUploadProgress?: (percent: number) => void
) {
  return request.post<ContractAttachment>({
    url: '/admin/contract/attachment/upload',
    data,
    timeout: 0,
    onUploadProgress: onUploadProgress
      ? (e: any) => { onUploadProgress(Math.round((e.loaded * 100) / (e.total && e.total > 0 ? e.total : e.loaded))) }
      : undefined
  })
}

export function deleteContractAttachment(id: number) {
  return request.del({ url: `/admin/contract/attachment/delete/${id}` })
}

export function downloadContractAttachment(id: number) {
  return request.get<Blob | string>({
    url: `/admin/contract/attachment/download/${id}`,
    responseType: 'blob',
    skipResponseValidation: true
  })
}

export function addContractMilestone(data: Omit<ContractMilestone, 'id' | 'status'>) {
  return request.post<ContractMilestone>({ url: '/admin/contract/milestone/add', data })
}

export function updateContractMilestone(data: Omit<ContractMilestone, 'status'>) {
  return request.put<ContractMilestone>({ url: '/admin/contract/milestone/update', data })
}

export function completeContractMilestone(data: { id: number; actualDate: string; completeRemark?: string }) {
  return request.put<ContractMilestone>({ url: '/admin/contract/milestone/complete', data })
}

export function deleteContractMilestone(id: number) {
  return request.del({ url: `/admin/contract/milestone/delete/${id}` })
}

export function addContractPayment(data: Omit<ContractPaymentPlan, 'id' | 'status' | 'actualAmount' | 'actualDate'>) {
  return request.post<ContractPaymentPlan>({ url: '/admin/contract/payment/add', data })
}

export function updateContractPayment(data: Omit<ContractPaymentPlan, 'status' | 'actualAmount' | 'actualDate'>) {
  return request.put<ContractPaymentPlan>({ url: '/admin/contract/payment/update', data })
}

export function registerContractPayment(data: { id: number; actualAmount: number; actualDate: string }) {
  return request.put<ContractPaymentPlan>({ url: '/admin/contract/payment/register', data })
}

export function deleteContractPayment(id: number) {
  return request.del({ url: `/admin/contract/payment/delete/${id}` })
}

export function getReminderList(params: Record<string, any>) {
  return request.get<{ list: ContractReminder[]; pagination: { page: number; pageSize: number; total: number } }>({
    url: '/admin/contract/reminder/list',
    params
  })
}

export function getReminderSource(id: number) {
  return request.get<{ contractId: number; sourceId?: number; sourceType: string }>({
    url: `/admin/contract/reminder/source/${id}`
  })
}

export function handleReminder(data: { id: number; actualDate: string }) {
  return request.put({ url: '/admin/contract/reminder/handle', data })
}

export function getPaymentManageList(params: Record<string, any>) {
  return request.get<{ list: PaymentManageItem[]; pagination: { page: number; pageSize: number; total: number } }>({
    url: '/admin/contract/payment/manage/list',
    params
  })
}

export function getPaymentManageStat(params: Record<string, any>) {
  return request.get<PaymentStat>({ url: '/admin/contract/payment/manage/stat', params })
}

export function registerPaymentManage(data: { id: number; actualAmount: number; actualDate: string }) {
  return request.put({ url: '/admin/contract/payment/manage/register', data })
}

export function exportPaymentManage(params: Record<string, any>) {
  return request.get<Blob | string>({
    url: '/admin/contract/payment/manage/export',
    params,
    responseType: 'blob',
    skipResponseValidation: true
  })
}

export function getWorkbenchOverview() {
  return request.get<any>({ url: '/admin/contract/workbench/overview' })
}

export function getWorkbenchTodos(params?: { type?: string }) {
  return request.get<ContractReminder[]>({ url: '/admin/contract/workbench/todos', params })
}

export function getWorkbenchRecent() {
  return request.get<any>({ url: '/admin/contract/workbench/recent' })
}

export function getAnalysisOverview(params: Record<string, any>) {
  return request.get<any>({ url: '/admin/contract/analysis/overview', params })
}
