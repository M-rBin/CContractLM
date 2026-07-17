<template>
  <div class="ai-config-page">
    <ElCard shadow="never">
      <div class="table-header">
        <div>
          <div class="panel-title">AI 配置管理</div>
          <div class="panel-subtitle">维护多套 AI 服务配置，供合同智能识别与合同智能助手统一调用</div>
        </div>
        <ElButton type="primary" :icon="Plus" @click="handleAdd">新增配置</ElButton>
      </div>

      <div class="table-container">
        <ElTable v-loading="loading" :data="list" style="width: 100%" empty-text="暂无 AI 配置，请点击右上角新增">
          <ElTableColumn prop="name" label="配置名称" min-width="140">
            <template #default="{ row }">
              <span>{{ row.name }}</span>
              <ElTag v-if="row.isDefault === 1" type="success" size="small" class="default-tag">默认</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="provider" label="提供商" min-width="120">
            <template #default="{ row }">{{ providerLabel(row.provider) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="model" label="模型" min-width="150" show-overflow-tooltip />
          <ElTableColumn prop="apiKey" label="密钥" min-width="140" show-overflow-tooltip />
          <ElTableColumn prop="baseUrl" label="服务地址" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.baseUrl || '-' }}</template>
          </ElTableColumn>
          <ElTableColumn label="状态" width="100" align="center">
            <template #default="{ row }">
              <ElTag :type="row.isEnabled === 1 ? 'success' : 'info'" size="small">
                {{ row.isEnabled === 1 ? '启用' : '停用' }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="320" align="center" fixed="right">
            <template #default="{ row }">
              <ElButton link type="primary" @click="handleTest(row)">连接测试</ElButton>
              <ElButton link type="primary" :disabled="row.isDefault === 1" @click="handleSetDefault(row)">
                设为默认
              </ElButton>
              <ElButton
                link
                :type="row.isEnabled === 1 ? 'warning' : 'success'"
                :disabled="row.isDefault === 1"
                @click="handleToggle(row)"
              >
                {{ row.isEnabled === 1 ? '停用' : '启用' }}
              </ElButton>
              <ElButton link type="primary" @click="handleEdit(row)">编辑</ElButton>
              <ElButton link type="danger" :disabled="row.isDefault === 1" @click="handleDelete(row)">
                删除
              </ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </ElCard>

    <ElDialog v-model="dialogVisible" :title="dialogTitle" width="560px" @closed="resetForm">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="100px">
        <ElFormItem label="配置名称" prop="name">
          <ElInput v-model="form.name" placeholder="请输入配置名称" maxlength="50" />
        </ElFormItem>
        <ElFormItem label="提供商" prop="provider">
          <ElSelect v-model="form.provider" placeholder="请选择提供商" style="width: 100%">
            <ElOption
              v-for="p in AI_PROVIDERS"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="模型" prop="model">
          <ElInput v-model="form.model" placeholder="如 gpt-4o、claude-sonnet-4-6、qwen-long" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="服务地址" prop="baseUrl">
          <ElInput
            v-model="form.baseUrl"
            :placeholder="baseUrlPlaceholder"
            maxlength="200"
          />
        </ElFormItem>
        <ElFormItem label="访问密钥" prop="apiKey">
          <ElInput
            v-model="form.apiKey"
            type="password"
            show-password
            :placeholder="form.id ? '留空则保留原密钥' : '请输入访问密钥'"
            maxlength="500"
          />
        </ElFormItem>
        <ElFormItem label="设为默认">
          <ElSwitch v-model="form.isDefault" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem label="启用">
          <ElSwitch v-model="form.isEnabled" :active-value="1" :inactive-value="0" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :loading="testLoading" @click="handleTestForm">测试连接</ElButton>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitLoading" @click="submitForm">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    AI_PROVIDERS,
    addAiConfig,
    deleteAiConfig,
    getAiConfigList,
    setDefaultAiConfig,
    testAiConfig,
    toggleAiConfigEnabled,
    updateAiConfig,
    type AiConfigItem
  } from '@/api/ai-config'

  defineOptions({ name: 'AiConfigManagement' })

  const loading = ref(false)
  const list = ref<AiConfigItem[]>([])
  const submitLoading = ref(false)
  const testLoading = ref(false)
  const dialogVisible = ref(false)
  const formRef = ref<FormInstance>()

  const form = reactive({
    id: undefined as number | undefined,
    name: '',
    provider: 'openai',
    model: '',
    apiKey: '',
    baseUrl: '',
    isDefault: 0,
    isEnabled: 1
  })

  const dialogTitle = computed(() => (form.id ? '编辑 AI 配置' : '新增 AI 配置'))

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入配置名称', trigger: 'blur' },
      { min: 2, max: 50, message: '名称长度为 2-50 个字符', trigger: 'blur' }
    ],
    provider: [{ required: true, message: '请选择提供商', trigger: 'change' }],
    model: [{ required: true, message: '请输入模型名称', trigger: 'blur' }],
    apiKey: [
      {
        validator: (_r, value, cb) => {
          // 新增时必填；编辑时留空表示保留原密钥
          if (!form.id && !value) return cb(new Error('请输入访问密钥'))
          cb()
        },
        trigger: 'blur'
      }
    ],
    baseUrl: [
      { required: true, message: '请输入 API 调用地址', trigger: 'blur' },
      { pattern: /^https?:\/\/.+/, message: '请输入以 http(s):// 开头的完整地址', trigger: 'blur' }
    ]
  }

  /** 各提供商的默认服务地址，作为占位提示（与后端 defaultBaseUrls 保持一致） */
  const PROVIDER_DEFAULT_BASE_URLS: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    deepseek: 'https://api.deepseek.com/v1',
    'openai-compatible': 'https://your-host/v1'
  }

  const baseUrlPlaceholder = computed(
    () => `如 ${PROVIDER_DEFAULT_BASE_URLS[form.provider] || 'https://your-host/v1'}`
  )

  function providerLabel(value: string) {
    return AI_PROVIDERS.find((p) => p.value === value)?.label || value
  }

  async function loadList() {
    loading.value = true
    try {
      const { data } = await getAiConfigList()
      list.value = data || []
    } catch {
      ElMessage.error('加载 AI 配置失败')
    } finally {
      loading.value = false
    }
  }

  function handleAdd() {
    resetForm()
    dialogVisible.value = true
  }

  function handleEdit(row: any) {
    form.id = row.id
    form.name = row.name
    form.provider = row.provider
    form.model = row.model
    form.apiKey = ''
    form.baseUrl = row.baseUrl || ''
    form.isDefault = row.isDefault
    form.isEnabled = row.isEnabled
    dialogVisible.value = true
  }

  function resetForm() {
    form.id = undefined
    form.name = ''
    form.provider = 'openai'
    form.model = ''
    form.apiKey = ''
    form.baseUrl = ''
    form.isDefault = 0
    form.isEnabled = 1
    formRef.value?.clearValidate()
  }

  function buildPayload() {
    const base = {
      name: form.name,
      provider: form.provider,
      model: form.model,
      baseUrl: form.baseUrl.trim(),
      isDefault: form.isDefault,
      isEnabled: form.isEnabled
    }
    // apiKey 留空且为编辑时不提交，保留原密钥
    return form.apiKey ? { ...base, apiKey: form.apiKey } : base
  }

  async function submitForm() {
    if (!formRef.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      submitLoading.value = true
      try {
        if (form.id) {
          await updateAiConfig({ id: form.id, ...buildPayload() })
          ElMessage.success('更新成功')
        } else {
          await addAiConfig(buildPayload() as any)
          ElMessage.success('新增成功')
        }
        dialogVisible.value = false
        loadList()
      } catch {
        ElMessage.error(form.id ? '更新失败' : '新增失败')
      } finally {
        submitLoading.value = false
      }
    })
  }

  async function handleDelete(row: any) {
    try {
      await ElMessageBox.confirm(`确定删除配置「${row.name}」吗？`, '提示', {
        type: 'warning'
      })
    } catch {
      return
    }
    try {
      await deleteAiConfig(row.id)
      ElMessage.success('删除成功')
      loadList()
    } catch {
      // 错误信息由 http 拦截器统一提示（如默认配置不可删除）
    }
  }

  async function handleSetDefault(row: any) {
    try {
      await setDefaultAiConfig(row.id)
      ElMessage.success('已设为默认配置')
      loadList()
    } catch {
      // 拦截器统一提示
    }
  }

  async function handleToggle(row: any) {
    const next = row.isEnabled === 1 ? 0 : 1
    try {
      await toggleAiConfigEnabled(row.id, next)
      ElMessage.success(next === 1 ? '已启用' : '已停用')
      loadList()
    } catch {
      // 拦截器统一提示
    }
  }

  async function handleTest(row: any) {
    const loadingMsg = ElMessage({ message: '正在测试连接...', type: 'info', duration: 0 })
    try {
      const { data } = await testAiConfig({ id: row.id })
      loadingMsg.close()
      if (data?.ok) {
        ElMessage.success(data.message || '连接成功')
      } else {
        ElMessage.error(data?.message || '连接失败')
      }
    } catch {
      loadingMsg.close()
      ElMessage.error('连接测试失败')
    }
  }

  async function handleTestForm() {
    if (!formRef.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      if (!form.id && !form.apiKey) {
        ElMessage.warning('请先填写访问密钥')
        return
      }
      testLoading.value = true
      try {
        // 编辑态留空密钥时用已存配置测试，否则用表单临时配置测试
        const params =
          form.id && !form.apiKey
            ? { id: form.id }
            : {
                provider: form.provider,
                model: form.model,
                apiKey: form.apiKey,
                baseUrl: form.baseUrl.trim() || undefined
              }
        const { data } = await testAiConfig(params)
        if (data?.ok) {
          ElMessage.success(data.message || '连接成功')
        } else {
          ElMessage.error(data?.message || '连接失败')
        }
      } catch {
        ElMessage.error('连接测试失败')
      } finally {
        testLoading.value = false
      }
    })
  }

  onMounted(loadList)
</script>

<style lang="scss" scoped>
  .ai-config-page {
    height: 100%;

    .table-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .panel-title {
      font-size: 16px;
      font-weight: 600;
    }

    .panel-subtitle {
      margin-top: 4px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .default-tag {
      margin-left: 8px;
    }

    .table-container {
      width: 100%;
    }
  }
</style>
