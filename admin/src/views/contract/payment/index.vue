<template>
  <div class="contract-payment">
    <div class="metric-grid">
      <ElCard v-for="item in metrics" :key="item.label" shadow="never" class="metric-card">
        <span>{{ item.label }}</span>
        <strong>{{ amountText(item.value) }}</strong>
      </ElCard>
    </div>

    <ElCard shadow="never" class="filter-card">
      <ElForm :model="query" :inline="true" class="filter-form">
        <ElFormItem label="合同名称"><ElInput v-model="query.contractName" clearable placeholder="请输入" /></ElFormItem>
        <ElFormItem label="方向"><ElSelect v-model="query.direction" clearable placeholder="请选择" class="filter-select"><ElOption label="收款" value="收款" /><ElOption label="付款" value="付款" /></ElSelect></ElFormItem>
        <ElFormItem label="状态"><ElSelect v-model="query.status" clearable placeholder="请选择" class="filter-select"><ElOption label="待处理" value="待处理" /><ElOption label="已完成" value="已完成" /><ElOption label="逾期" value="逾期" /></ElSelect></ElFormItem>
        <ElFormItem label="相对方"><ElInput v-model="query.counterparty" clearable placeholder="请输入" /></ElFormItem>
        <ElFormItem><ElButton type="primary" :icon="Search" @click="search">搜索</ElButton><ElButton @click="reset">重置</ElButton><ElButton :icon="Download" @click="exportList">导出</ElButton></ElFormItem>
      </ElForm>
    </ElCard>

    <ElCard shadow="never" class="table-card">
      <ElTable v-loading="loading" :data="tableData">
        <ElTableColumn label="合同名称" min-width="180" show-overflow-tooltip><template #default="{ row }">{{ row.contract?.name || '-' }}</template></ElTableColumn>
        <ElTableColumn label="相对方" min-width="150" show-overflow-tooltip><template #default="{ row }">{{ row.contract?.counterparty || '-' }}</template></ElTableColumn>
        <ElTableColumn prop="direction" label="方向" width="90" />
        <ElTableColumn label="计划金额" width="130" align="right"><template #default="{ row }">{{ amountText(row.planAmount) }}</template></ElTableColumn>
        <ElTableColumn prop="planDate" label="计划日期" width="120"><template #default="{ row }">{{ dateText(row.planDate) }}</template></ElTableColumn>
        <ElTableColumn label="实际金额" width="130" align="right"><template #default="{ row }">{{ row.actualAmount ? amountText(row.actualAmount) : '-' }}</template></ElTableColumn>
        <ElTableColumn label="剩余金额" width="130" align="right"><template #default="{ row }">{{ row.status === '已完成' ? '-' : amountText(row.remainingAmount ?? row.planAmount) }}</template></ElTableColumn>
        <ElTableColumn label="状态" width="100"><template #default="{ row }"><ElTag :type="tagType(row.status)">{{ row.status }}</ElTag></template></ElTableColumn>
        <ElTableColumn label="操作" width="130" fixed="right"><template #default="{ row }"><ElButton v-if="canRegister(row)" link type="success" @click="openRegister(row)">登记</ElButton></template></ElTableColumn>
      </ElTable>
      <div class="pager"><ElPagination v-model:current-page="query.page" v-model:page-size="query.pageSize" :total="total" layout="total, sizes, prev, pager, next" @current-change="loadList" @size-change="search" /></div>
    </ElCard>

    <ElDialog v-model="registerDialog" title="登记实际收付款" width="460px">
      <ElForm :model="registerForm" label-width="100px">
        <ElFormItem label="实际金额" required><ElInputNumber v-model="registerForm.actualAmount" :min="0" :max="registerForm.maxAmount" :precision="2" /><span class="hint">可登记上限：{{ amountText(registerForm.maxAmount) }}</span></ElFormItem>
        <ElFormItem label="实际日期" required><ElDatePicker v-model="registerForm.actualDate" value-format="YYYY-MM-DD" type="date" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="registerDialog = false">取消</ElButton><ElButton type="primary" @click="submitRegister">保存</ElButton></template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { Download, Search } from '@element-plus/icons-vue'
  import { saveAs } from 'file-saver'
  import { exportPaymentManage, getPaymentManageList, getPaymentManageStat, registerPaymentManage, type PaymentManageItem, type PaymentStat } from '@/api/contract'

  defineOptions({ name: 'ContractPaymentManage' })

  const loading = ref(false)
  const tableData = ref<PaymentManageItem[]>([])
  const total = ref(0)
  const stat = ref<PaymentStat>({ receivableTotal: 0, payableTotal: 0, pendingReceive: 0, pendingPay: 0, overdueTotal: 0 })
  const query = reactive({ contractName: '', direction: '', status: '', counterparty: '', page: 1, pageSize: 10 })
  const registerDialog = ref(false)
  const registerForm = reactive({ id: 0, actualAmount: 0, actualDate: '', maxAmount: 0 })
  const metrics = computed(() => [
    { label: '应收金额', value: stat.value.receivableTotal },
    { label: '应付金额', value: stat.value.payableTotal },
    { label: '待收金额', value: stat.value.pendingReceive },
    { label: '待付金额', value: stat.value.pendingPay },
    { label: '逾期金额', value: stat.value.overdueTotal }
  ])

  async function loadList() {
    loading.value = true
    try {
      const [listRes, statRes] = await Promise.all([getPaymentManageList(query), getPaymentManageStat(query)])
      tableData.value = listRes.data?.list || []
      total.value = listRes.data?.pagination?.total || 0
      stat.value = statRes.data || stat.value
    } finally {
      loading.value = false
    }
  }

  function search() {
    query.page = 1
    loadList()
  }

  function reset() {
    Object.assign(query, { contractName: '', direction: '', status: '', counterparty: '', page: 1 })
    loadList()
  }

  function openRegister(row: any) {
    const payment = row as PaymentManageItem
    const remaining = row.remainingAmount != null ? Number(row.remainingAmount) : Number(payment.planAmount || 0)
    Object.assign(registerForm, { id: payment.id, actualAmount: 0, actualDate: dateText(new Date().toISOString()), maxAmount: remaining })
    registerDialog.value = true
  }

  async function submitRegister() {
    if (registerForm.actualAmount <= 0) {
      ElMessage.warning('登记金额必须大于 0')
      return
    }
    if (registerForm.actualAmount > registerForm.maxAmount) {
      ElMessage.warning(`登记金额不能超过剩余金额 ${amountText(registerForm.maxAmount)}`)
      return
    }
    try {
      const { maxAmount: _, ...payload } = registerForm
      await registerPaymentManage(payload)
      ElMessage.success('保存成功')
      registerDialog.value = false
      loadList()
    } catch {
      ElMessage.error('保存失败，请重试')
    }
  }

  async function exportList() {
    const data = await exportPaymentManage(query)
    saveAs(data instanceof Blob ? data : new Blob([data]), `收付款计划-${Date.now()}.csv`)
    ElMessage.success('导出成功')
  }

  function dateText(value?: string) {
    return value ? String(value).slice(0, 10) : ''
  }

  function amountText(value: string | number | null | undefined) {
    const num = Number(value)
    return (isNaN(num) ? 0 : num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function canRegister(row: PaymentManageItem | any): boolean {
    return (row.remainingAmount != null ? Number(row.remainingAmount) : (row.status !== '已完成' ? Number(row.planAmount || 0) : 0)) > 0
  }

  function tagType(status: string) {
    const map: Record<string, 'success' | 'warning' | 'danger'> = { 已完成: 'success', 待处理: 'warning', 逾期: 'danger' }
    return map[status] || 'warning'
  }

  onMounted(loadList)
</script>

<style scoped lang="scss">
  .contract-payment {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }

    .metric-card,
    .filter-card,
    .table-card {
      border: none !important;
      border-radius: 8px;
      box-shadow: none !important;
    }

    .metric-card :deep(.el-card__body) {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    strong {
      font-size: 22px;
    }

    .filter-form {
      @include responsiveFilterForm();
    }

    .hint {
      margin-left: 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .pager {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  }
</style>
