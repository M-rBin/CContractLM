import request from '@/utils/http'

/** 支持的 AI 提供商 */
export const AI_PROVIDERS = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: '通义千问', value: 'qwen' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'OpenAI 兼容', value: 'openai-compatible' }
] as const

/** 模型类型 */
export const AI_MODEL_TYPES = [
  { label: '文本模型', value: 'text' },
  { label: '视觉模型（图片型PDF）', value: 'vision' }
] as const

/** AI 配置项 */
export interface AiConfigItem {
  id: number
  name: string
  provider: string
  model: string
  /** 脱敏后的密钥 */
  apiKey: string
  baseUrl: string | null
  modelType: string
  isDefault: number
  isEnabled: number
  createTime: string
  updateTime: string
}

/** 新增 AI 配置入参 */
export interface AddAiConfigParams {
  name: string
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  modelType?: string
  isDefault?: number
  isEnabled?: number
}

/** 更新 AI 配置入参（apiKey 留空则保留原密钥） */
export interface UpdateAiConfigParams extends Omit<AddAiConfigParams, 'apiKey'> {
  id: number
  apiKey?: string
}

/** 连接测试入参 */
export interface TestAiConfigParams {
  id?: number
  provider?: string
  model?: string
  apiKey?: string
  baseUrl?: string
}

/** 获取 AI 配置列表 */
export function getAiConfigList() {
  return request.get<AiConfigItem[]>({
    url: '/admin/ai/config/list'
  })
}

/** 新增 AI 配置 */
export function addAiConfig(data: AddAiConfigParams) {
  return request.post({
    url: '/admin/ai/config/add',
    data
  })
}

/** 更新 AI 配置 */
export function updateAiConfig(data: UpdateAiConfigParams) {
  return request.put({
    url: '/admin/ai/config/update',
    data
  })
}

/** 删除 AI 配置 */
export function deleteAiConfig(id: number) {
  return request.del({
    url: `/admin/ai/config/delete/${id}`
  })
}

/** 设为默认配置 */
export function setDefaultAiConfig(id: number) {
  return request.put({
    url: `/admin/ai/config/set-default/${id}`
  })
}

/** 启用/停用配置 */
export function toggleAiConfigEnabled(id: number, isEnabled: number) {
  return request.put({
    url: `/admin/ai/config/toggle-enabled/${id}/${isEnabled}`
  })
}

/** 连接测试 */
export function testAiConfig(data: TestAiConfigParams) {
  return request.post<{ ok: boolean; message: string }>({
    url: '/admin/ai/config/test',
    data
  })
}
