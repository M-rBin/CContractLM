<template>
  <div class="ai-import-page">
    <ElCard shadow="never">
      <div class="panel-title">合同智能录入</div>
      <div class="panel-subtitle">上传文本型合同 PDF，AI 自动识别关键信息并填入登记表单，核对后保存</div>

      <!-- idle：上传区 -->
      <div v-if="status === 'idle'" class="upload-zone">
        <ElUpload
          drag
          :auto-upload="false"
          :show-file-list="false"
          accept="application/pdf"
          :on-change="handleFileChange"
        >
          <ElIcon class="upload-icon"><UploadFilled /></ElIcon>
          <div class="upload-text">将合同 PDF 拖到此处，或<em>点击选择文件</em></div>
          <template #tip>
            <div class="upload-tip">仅支持文本型 PDF，单文件不超过 20MB；扫描件请手动录入</div>
          </template>
        </ElUpload>
      </div>

      <!-- recognizing：识别中 -->
      <div v-else-if="status === 'recognizing'" class="state-zone" v-loading="true" element-loading-text="正在识别合同信息...">
        <div class="state-placeholder" />
      </div>

      <!-- done：结果摘要 -->
      <div v-else-if="status === 'done'" class="state-zone">
        <ElResult icon="success" title="识别完成" :sub-title="`识别置信度 ${Math.round(confidence * 100)}%`">
          <template #extra>
            <div class="summary">
              <div class="summary-row"><span class="label">合同名称</span><span>{{ result?.contract.name || '未识别' }}</span></div>
              <div class="summary-row"><span class="label">合同类型</span><span>{{ result?.contract.type || '未识别' }}</span></div>
              <div class="summary-row"><span class="label">相对方</span><span>{{ result?.contract.counterparty || '未识别' }}</span></div>
              <div class="summary-row"><span class="label">合同金额</span><span>{{ amountText }}</span></div>
              <div class="summary-row"><span class="label">收付款计划</span><span>{{ result?.paymentPlans.length || 0 }} 期</span></div>
            </div>
            <div class="actions">
              <ElButton @click="reset">重新上传</ElButton>
              <ElButton type="primary" @click="fillForm">填入登记表单</ElButton>
            </div>
          </template>
        </ElResult>
      </div>

      <!-- error：失败 -->
      <div v-else-if="status === 'error'" class="state-zone">
        <ElResult icon="error" title="识别失败" :sub-title="errorMsg">
          <template #extra>
            <ElButton @click="reset">重试</ElButton>
            <ElButton type="primary" @click="goManual">手动录入</ElButton>
          </template>
        </ElResult>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { UploadFilled } from '@element-plus/icons-vue'
  import type { UploadFile } from 'element-plus'
  import { recognizeContract, type RecognizeResult } from '@/api/contract-ai'
  import { useAiImportStore } from '@/store/modules/ai-import'

  defineOptions({ name: 'ContractAiImport' })

  const router = useRouter()
  const aiImportStore = useAiImportStore()
  const MAX_SIZE = 20 * 1024 * 1024

  type Status = 'idle' | 'recognizing' | 'done' | 'error'
  const status = ref<Status>('idle')
  const result = ref<RecognizeResult | null>(null)
  const errorMsg = ref('')
  /** 保留原始 File，填入登记表单时一并传过去作为附件 */
  const sourceFile = ref<File | null>(null)

  const confidence = computed(() => result.value?.confidence ?? 0)
  const amountText = computed(() => {
    const c = result.value?.contract
    if (!c || c.amount === null) return '未识别'
    return `${c.amount} ${c.currency || ''}`.trim()
  })

  async function handleFileChange(file: UploadFile) {
    const raw = file.raw
    if (!raw) return
    if (raw.type !== 'application/pdf' && !raw.name.toLowerCase().endsWith('.pdf')) {
      ElMessage.error('仅支持 PDF 格式的合同文件')
      return
    }
    if (raw.size > MAX_SIZE) {
      ElMessage.error('文件大小不能超过 20MB')
      return
    }
    const formData = new FormData()
    formData.append('file', raw)
    status.value = 'recognizing'
    try {
      const { data } = await recognizeContract(formData)
      result.value = data
      sourceFile.value = raw
      status.value = 'done'
    } catch (e: any) {
      errorMsg.value = e?.message || '识别失败，请重试或手动录入'
      status.value = 'error'
    }
  }

  function fillForm() {
    if (!result.value) return
    // 把原始 PDF 存入 store，让 ledger 页建合同后自动上传为附件
    aiImportStore.setPendingFile(sourceFile.value)
    // 通过 history.state 传递识别结果，合同台账新增流程读取后预填
    router.push({
      path: '/contract/ledger',
      state: { aiRecognizedData: JSON.parse(JSON.stringify(result.value)) }
    })
  }

  function goManual() {
    router.push({ path: '/contract/ledger' })
  }

  function reset() {
    status.value = 'idle'
    result.value = null
    errorMsg.value = ''
    sourceFile.value = null
  }

  // 离开页面重置为初始态
  onBeforeUnmount(reset)
</script>

<style lang="scss" scoped>
  .ai-import-page {
    height: 100%;

    .panel-title {
      font-size: 16px;
      font-weight: 600;
    }

    .panel-subtitle {
      margin-top: 4px;
      margin-bottom: 24px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .upload-zone {
      max-width: 640px;
      margin: 40px auto;
    }

    .upload-icon {
      font-size: 48px;
      color: var(--el-color-primary);
    }

    .upload-text {
      margin-top: 12px;
      color: var(--el-text-color-regular);

      em {
        color: var(--el-color-primary);
        font-style: normal;
      }
    }

    .upload-tip {
      margin-top: 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .state-zone {
      min-height: 320px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .state-placeholder {
      height: 200px;
    }

    .summary {
      width: 360px;
      margin: 0 auto 20px;
      text-align: left;

      .summary-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--el-border-color-lighter);

        .label {
          color: var(--el-text-color-secondary);
        }
      }
    }

    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
  }
</style>
