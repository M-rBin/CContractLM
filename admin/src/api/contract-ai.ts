import request from '@/utils/http'

/** 识别出的收付款计划项 */
export interface RecognizedPaymentPlan {
  direction: string | null
  planAmount: number | null
  planDate: string | null
  remark: string | null
}

/** 识别出的合同基础信息 */
export interface RecognizedContract {
  name: string | null
  type: string | null
  signSubject: string | null
  counterparty: string | null
  amount: number | null
  currency: string | null
  signDate: string | null
  effectiveDate: string | null
  expireDate: string | null
  remark: string | null
}

/** 合同识别结果 */
export interface RecognizeResult {
  contract: RecognizedContract
  paymentPlans: RecognizedPaymentPlan[]
  confidence: number
}

/**
 * 上传合同 PDF 进行智能识别
 * @param data 含 file 字段的 FormData
 */
export function recognizeContract(data: FormData) {
  return request.post<RecognizeResult>({
    url: '/admin/contract/ai/recognize',
    data
  })
}
