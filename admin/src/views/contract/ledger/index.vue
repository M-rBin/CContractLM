<template>
  <div class="contract-ledger">
    <ElCard shadow="never" class="filter-card">
      <ElForm :model="query" :inline="true" class="filter-form">
        <ElFormItem label="关键字">
          <ElInput v-model="query.keyword" clearable placeholder="编号/名称/相对方" class="filter-input" />
        </ElFormItem>
        <ElFormItem label="合同类型">
          <ElSelect v-model="query.type" clearable placeholder="请选择" class="filter-select">
            <ElOption v-for="item in CONTRACT_TYPES" :key="item" :label="item" :value="item" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="合同状态">
          <ElSelect v-model="query.status" clearable placeholder="请选择" class="filter-select">
            <ElOption v-for="item in CONTRACT_STATUS" :key="item" :label="item" :value="item" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="到期日期">
          <ElDatePicker
            v-model="expireRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" :icon="Search" @click="handleSearch">搜索</ElButton>
          <ElButton @click="handleReset">重置</ElButton>
        </ElFormItem>
      </ElForm>
    </ElCard>

    <ElCard shadow="never" class="table-card">
      <div class="table-header">
        <ElButton type="primary" :icon="Plus" @click="handleAdd">新增</ElButton>
        <ElButton plain :icon="Download" @click="handleExport">导出</ElButton>
      </div>

      <div class="table-container">
        <ElTable v-loading="loading" :data="tableData" height="100%">
          <ElTableColumn prop="code" label="合同编号" width="150" fixed="left" />
          <ElTableColumn prop="name" label="合同名称" min-width="180" show-overflow-tooltip />
          <ElTableColumn prop="type" label="合同类型" width="110" />
          <ElTableColumn prop="signSubject" label="签约主体" min-width="150" show-overflow-tooltip />
          <ElTableColumn prop="counterparty" label="相对方" min-width="150" show-overflow-tooltip />
          <ElTableColumn label="合同金额" width="200" align="right">
            <template #default="{ row }">
              <span style="white-space: nowrap">{{ formatAmount(row.amount) }} {{ row.currency }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="待执行金额" width="160" align="right">
            <template #default="{ row }">
              <span style="white-space: nowrap">{{ formatAmount(row.remainingPerformanceAmount ?? row.amount) }} {{ row.currency }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="signDate" label="签订日期" width="120">
            <template #default="{ row }">{{ dateText(row.signDate) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="expireDate" label="到期日期" width="120">
            <template #default="{ row }">{{ dateText(row.expireDate) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="ownerName" label="负责人" width="120" />
          <ElTableColumn label="状态" width="100" align="center">
            <template #default="{ row }">
              <ElTag :type="statusTag(row.status)" disable-transitions>{{ row.status }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="150" align="center" fixed="right">
            <template #default="{ row }">
              <ElButton link type="primary" @click="handleView(row)">管理</ElButton>
              <ElButton link type="primary" @click="handleEdit(row)">编辑</ElButton>
              <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <div class="pagination-container">
        <ElPagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageSizeChange"
          @current-change="loadList"
        />
      </div>
    </ElCard>

    <ElDialog v-model="dialogVisible" :title="dialogTitle" width="720px" @closed="resetForm">
      <ElAlert
        v-if="aiPrefilled"
        type="warning"
        :closable="false"
        show-icon
        title="以下信息由 AI 识别自动填入，请核对后保存"
        style="margin-bottom: 16px"
      />
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="100px">
        <div class="form-grid">
          <ElFormItem label="合同编号" prop="code">
            <ElInput v-model="form.code" maxlength="50" placeholder="请输入合同编号" />
          </ElFormItem>
          <ElFormItem label="合同名称" prop="name">
            <ElInput v-model="form.name" maxlength="100" placeholder="请输入合同名称" />
          </ElFormItem>
          <ElFormItem label="合同类型" prop="type">
            <ElSelect v-model="form.type" placeholder="请选择合同类型">
              <ElOption v-for="item in CONTRACT_TYPES" :key="item" :label="item" :value="item" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="合同状态" prop="status">
            <ElSelect v-model="form.status" placeholder="请选择状态">
              <ElOption v-for="item in CONTRACT_STATUS" :key="item" :label="item" :value="item" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="签约主体" prop="signSubject">
            <ElInput v-model="form.signSubject" maxlength="100" placeholder="请输入签约主体" />
          </ElFormItem>
          <ElFormItem label="相对方" prop="counterparty">
            <ElInput v-model="form.counterparty" maxlength="100" placeholder="请输入相对方" />
          </ElFormItem>
          <ElFormItem label="合同金额" prop="amount">
            <ElInputNumber v-model="form.amount" :min="0" :precision="2" style="width: 100%" />
          </ElFormItem>
          <ElFormItem label="币种" prop="currency">
            <ElSelect v-model="form.currency" placeholder="请选择币种">
              <ElOption v-for="item in CONTRACT_CURRENCIES" :key="item" :label="item" :value="item" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="签订日期" prop="signDate">
            <ElDatePicker v-model="form.signDate" value-format="YYYY-MM-DD" type="date" placeholder="请选择" />
          </ElFormItem>
          <ElFormItem label="生效日期" prop="effectiveDate">
            <ElDatePicker v-model="form.effectiveDate" value-format="YYYY-MM-DD" type="date" placeholder="请选择" />
          </ElFormItem>
          <ElFormItem label="到期日期" prop="expireDate">
            <ElDatePicker v-model="form.expireDate" value-format="YYYY-MM-DD" type="date" placeholder="请选择" />
          </ElFormItem>
          <ElFormItem label="负责人">
            <ElSelect v-model="form.ownerId" clearable filterable placeholder="请选择负责人" @change="syncOwnerName">
              <ElOption v-for="user in userOptions" :key="user.id" :label="user.name || user.username" :value="user.id" />
            </ElSelect>
          </ElFormItem>
        </div>
        <ElFormItem label="备注">
          <ElInput v-model="form.remark" type="textarea" maxlength="500" :rows="3" placeholder="请输入备注" />
        </ElFormItem>

        <!-- 收付款计划（新增时可选填，AI 带入时自动预填） -->
        <template v-if="!form.id">
          <ElDivider content-position="left" style="margin: 16px 0 12px">收付款计划</ElDivider>
          <div class="payment-section">
            <ElTable v-if="paymentPlans.length" :data="paymentPlans" size="small" style="margin-bottom:8px">
              <ElTableColumn label="方向" width="110">
                <template #default="{ row }">
                  <ElSelect v-model="row.direction" placeholder="请选择" size="small">
                    <ElOption v-for="d in CONTRACT_PAYMENT_DIRECTIONS" :key="d" :label="d" :value="d" />
                  </ElSelect>
                </template>
              </ElTableColumn>
              <ElTableColumn label="计划金额">
                <template #default="{ row }">
                  <ElInputNumber v-model="row.planAmount" :min="0" :precision="2" size="small" style="width:100%" />
                </template>
              </ElTableColumn>
              <ElTableColumn label="计划日期" width="155">
                <template #default="{ row }">
                  <ElDatePicker v-model="row.planDate" value-format="YYYY-MM-DD" type="date" size="small" placeholder="请选择" style="width:100%" />
                </template>
              </ElTableColumn>
              <ElTableColumn label="备注">
                <template #default="{ row }">
                  <ElInput v-model="row.remark" maxlength="100" size="small" placeholder="备注" />
                </template>
              </ElTableColumn>
              <ElTableColumn width="56" align="center">
                <template #default="{ $index }">
                  <ElButton type="danger" link size="small" @click="paymentPlans.splice($index, 1)">删除</ElButton>
                </template>
              </ElTableColumn>
            </ElTable>
            <ElButton size="small" plain @click="addPlanRow">+ 添加收付款计划</ElButton>
          </div>

          <!-- 合同附件（AI 导入时自动带入原始 PDF） -->
          <ElDivider content-position="left" style="margin: 16px 0 12px">合同附件</ElDivider>
          <div class="attachment-section">
            <div v-if="pendingAttachment" class="attachment-item">
              <ElIcon style="color:var(--el-color-primary)"><Document /></ElIcon>
              <span class="attachment-name">{{ pendingAttachment.name }}</span>
              <ElButton type="danger" link size="small" @click="pendingAttachment = null">移除</ElButton>
            </div>
            <span v-else class="attachment-tip">无附件，保存后可在详情页上传</span>
          </div>
        </template>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitLoading" @click="handleSubmit">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onActivated, onMounted, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import { Document, Download, Plus, Search } from '@element-plus/icons-vue'
  import { saveAs } from 'file-saver'
  import {
    CONTRACT_CURRENCIES,
    CONTRACT_PAYMENT_DIRECTIONS,
    CONTRACT_STATUS,
    CONTRACT_TYPES,
    addContract,
    addContractPayment,
    deleteContract,
    exportContracts,
    getContractList,
    updateContract,
    uploadContractAttachment,
    type ContractItem,
    type ContractQuery
  } from '@/api/contract'
  import { fetchUserOptions, type SimpleUser } from '@/api/auth'
  import { useAiImportStore } from '@/store/modules/ai-import'

  defineOptions({ name: 'ContractLedger' })

  const router = useRouter()
  const aiImportStore = useAiImportStore()
  const loading = ref(false)
  const tableData = ref<ContractItem[]>([])
  const userOptions = ref<SimpleUser[]>([])
  const expireRange = ref<string[]>([])
  const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
  const query = reactive<ContractQuery>({ keyword: '', type: '', status: '' })

  const dialogVisible = ref(false)
  const submitLoading = ref(false)
  const aiPrefilled = ref(false)
  const formRef = ref<FormInstance>()
  const form = reactive({
    id: undefined as number | undefined,
    code: '',
    name: '',
    type: '',
    signSubject: '',
    counterparty: '',
    amount: 0,
    currency: '人民币',
    signDate: '',
    effectiveDate: '',
    expireDate: '',
    ownerId: undefined as number | undefined,
    ownerName: '',
    status: '草稿',
    remark: ''
  })

  /** 收付款计划列表（仅新增时使用） */
  interface PlanRow { direction: string; planAmount: number; planDate: string; remark: string }
  const paymentPlans = ref<PlanRow[]>([])

  /** 待上传的合同原始 PDF（来自 AI 识别流程） */
  const pendingAttachment = ref<File | null>(null)
  const dialogTitle = computed(() => (form.id ? '编辑合同' : '新增合同'))
  const rules: FormRules = {
    code: [{ required: true, message: '请输入合同编号', trigger: 'blur' }],
    name: [{ required: true, message: '请输入合同名称', trigger: 'blur' }],
    type: [{ required: true, message: '请选择合同类型', trigger: 'change' }],
    signSubject: [{ required: true, message: '请输入签约主体', trigger: 'blur' }],
    counterparty: [{ required: true, message: '请输入相对方', trigger: 'blur' }],
    amount: [{ required: true, message: '请输入合同金额', trigger: 'change' }],
    currency: [{ required: true, message: '请选择币种', trigger: 'change' }],
    signDate: [{ required: true, message: '请选择签订日期', trigger: 'change' }],
    effectiveDate: [{ required: true, message: '请选择生效日期', trigger: 'change' }],
    expireDate: [{ required: true, message: '请选择到期日期', trigger: 'change' }],
    status: [{ required: true, message: '请选择合同状态', trigger: 'change' }]
  }

  function buildParams(): ContractQuery {
    return {
      ...query,
      expireDateStart: expireRange.value?.[0],
      expireDateEnd: expireRange.value?.[1],
      page: pagination.page,
      pageSize: pagination.pageSize
    }
  }

  async function loadList() {
    loading.value = true
    try {
      const { data } = await getContractList(buildParams())
      tableData.value = data?.list || []
      pagination.total = data?.pagination?.total || 0
    } finally {
      loading.value = false
    }
  }

  function handleSearch() {
    pagination.page = 1
    loadList()
  }

  function handleReset() {
    Object.assign(query, { keyword: '', type: '', status: '' })
    expireRange.value = []
    pagination.page = 1
    loadList()
  }

  function handlePageSizeChange() {
    pagination.page = 1
    loadList()
  }

  function handleAdd() {
    dialogVisible.value = true
  }

  /** 读取 AI 智能录入带入的识别结果并预填新增表单 */
  function applyAiRecognizedData() {
    const state = window.history.state
    const data = state?.aiRecognizedData
    if (!data?.contract) return
    const c = data.contract
    Object.assign(form, {
      id: undefined,
      code: '',
      name: c.name || '',
      type: c.type || '',
      signSubject: c.signSubject || '',
      counterparty: c.counterparty || '',
      amount: c.amount ?? 0,
      currency: c.currency || '人民币',
      signDate: c.signDate || '',
      effectiveDate: c.effectiveDate || '',
      expireDate: c.expireDate || '',
      status: '草稿',
      remark: c.remark || ''
    })
    // 预填收付款计划（与提交过滤条件保持一致：direction、金额、日期均需有效）
    if (Array.isArray(data.paymentPlans)) {
      paymentPlans.value = data.paymentPlans
        .filter((p: any) => p.direction && p.planAmount > 0 && p.planDate)
        .map((p: any) => ({
          direction: p.direction as string,
          planAmount: Number(p.planAmount),
          planDate: p.planDate || '',
          remark: p.remark || ''
        }))
    }
    // 读取待上传的原始 PDF
    pendingAttachment.value = aiImportStore.pendingFile
    aiPrefilled.value = true
    dialogVisible.value = true
    // 清除 state，避免刷新或返回时重复预填
    window.history.replaceState({ ...state, aiRecognizedData: undefined }, '')
  }

  function handleEdit(row: any) {
    const contract = row as ContractItem
    Object.assign(form, {
      ...contract,
      amount: Number(contract.amount),
      signDate: dateText(contract.signDate),
      effectiveDate: dateText(contract.effectiveDate),
      expireDate: dateText(contract.expireDate)
    })
    dialogVisible.value = true
  }

  function handleView(row: any) {
    const contract = row as ContractItem
    router.push({ path: '/contract/detail', query: { id: contract.id } })
  }

  async function handleDelete(row: any) {
    const contract = row as ContractItem
    try {
      await ElMessageBox.confirm(`确认删除合同"${contract.name}"吗？`, '提示', { type: 'warning' })
      await deleteContract(contract.id)
      ElMessage.success('删除成功')
      loadList()
    } catch {
      // 取消确认无需提示；请求失败由拦截器统一处理
    }
  }

  async function handleSubmit() {
    await formRef.value?.validate()
    try {
      validateDateOrder()
    } catch (e: any) {
      ElMessage.error(e.message)
      return
    }
    submitLoading.value = true
    try {
      const payload = {
        code: form.code,
        name: form.name,
        type: form.type,
        signSubject: form.signSubject,
        counterparty: form.counterparty,
        amount: form.amount,
        currency: form.currency,
        signDate: form.signDate,
        effectiveDate: form.effectiveDate,
        expireDate: form.expireDate,
        ownerId: form.ownerId,
        ownerName: form.ownerName || undefined,
        status: form.status,
        remark: form.remark || undefined
      }
      if (form.id) {
        await updateContract({ id: form.id, ...payload })
        ElMessage.success('保存成功')
      } else {
        const { data: newContract } = await addContract(payload)
        const contractId = newContract.id

    // 保存收付款计划（有 direction、金额 > 0、日期已填的行）
        const validPlans = paymentPlans.value.filter(
          (p) => p.direction && p.planAmount > 0 && p.planDate
        )
        await Promise.all(
          validPlans.map((plan) =>
            addContractPayment({
              contractId,
              direction: plan.direction,
              planAmount: plan.planAmount,
              planDate: plan.planDate,
              remark: plan.remark || undefined
            })
          )
        )

        // 上传原始合同 PDF 作为附件
        if (pendingAttachment.value) {
          const fd = new FormData()
          fd.append('file', pendingAttachment.value)
          fd.append('contractId', String(contractId))
          fd.append('category', '合同正文')
          await uploadContractAttachment(fd)
        }

        ElMessage.success('新增成功')
      }
      dialogVisible.value = false
      loadList()
    } finally {
      submitLoading.value = false
    }
  }

  async function handleExport() {
    const data = await exportContracts(buildParams())
    if (!data) return
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/csv;charset=utf-8' })
    saveAs(blob, `合同台账-${Date.now()}.csv`)
    ElMessage.success('导出成功')
  }

  function syncOwnerName() {
    const owner = userOptions.value.find((user) => user.id === form.ownerId)
    form.ownerName = owner ? owner.name || owner.username : ''
  }

  function validateDateOrder() {
    if (form.effectiveDate < form.signDate || form.expireDate < form.effectiveDate) {
      throw new Error('日期填写有误，请检查签订、生效、到期日期的先后顺序')
    }
  }

  function resetForm() {
    aiPrefilled.value = false
    formRef.value?.resetFields()
    Object.assign(form, {
      id: undefined,
      code: '',
      name: '',
      type: '',
      signSubject: '',
      counterparty: '',
      amount: 0,
      currency: '人民币',
      signDate: '',
      effectiveDate: '',
      expireDate: '',
      ownerId: undefined,
      ownerName: '',
      status: '草稿',
      remark: ''
    })
    paymentPlans.value = []
    pendingAttachment.value = null
    aiImportStore.clear()
  }

  function addPlanRow() {
    paymentPlans.value.push({ direction: '', planAmount: 0, planDate: '', remark: '' })
  }

  function dateText(value?: string) {
    return value ? String(value).slice(0, 10) : ''
  }

  function formatAmount(value: string | number | null | undefined) {
    const num = Number(value)
    return (isNaN(num) ? 0 : num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function statusTag(status: string) {
    const map: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
      草稿: 'info',
      履行中: 'success',
      已到期: 'warning',
      已终止: 'danger',
      已归档: 'primary'
    }
    return map[status] || 'info'
  }

  async function loadUsers() {
    const { data } = await fetchUserOptions()
    userOptions.value = data || []
  }

  onMounted(() => {
    loadList()
    loadUsers()
    applyAiRecognizedData()
  })

  // keep-alive 激活时重新检查 AI 识别数据（标签页已打开时 onMounted 不会再触发）
  onActivated(() => {
    applyAiRecognizedData()
  })
</script>

<style scoped lang="scss">
  .contract-ledger {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;

    .filter-card,
    .table-card {
      border: none !important;
      box-shadow: none !important;
      border-radius: 8px;
    }

    .filter-card {
      flex-shrink: 0;

      :deep(.el-card__body) {
        padding: 12px 20px;
      }

      .filter-form {
        @include responsiveFilterForm();
      }
    }

    .table-card {
      flex: 1;
      overflow: hidden;

      :deep(.el-card__body) {
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 16px;
      }
    }

    .table-header {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-shrink: 0;
    }

    .table-container {
      flex: 1;
      overflow: hidden;
    }

    .pagination-container {
      flex-shrink: 0;
      display: flex;
      justify-content: flex-end;
      padding-top: 16px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 16px;
    }

    .payment-section {
      padding: 0 0 4px;
    }

    .attachment-section {
      padding: 4px 0 8px;

      .attachment-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }

      .attachment-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--el-text-color-primary);
      }

      .attachment-tip {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
</style>
