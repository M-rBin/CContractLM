<template>
  <div class="contract-analysis">
    <ElCard shadow="never" class="filter-card">
      <ElForm :model="query" :inline="true" class="filter-form">
        <ElFormItem label="签订日期"><ElDatePicker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" /></ElFormItem>
        <ElFormItem label="合同类型"><ElSelect v-model="query.type" clearable placeholder="请选择" class="filter-select"><ElOption v-for="item in CONTRACT_TYPES" :key="item" :label="item" :value="item" /></ElSelect></ElFormItem>
        <ElFormItem label="合同状态"><ElSelect v-model="query.status" clearable placeholder="请选择" class="filter-select"><ElOption v-for="item in CONTRACT_STATUS" :key="item" :label="item" :value="item" /></ElSelect></ElFormItem>
        <ElFormItem><ElButton type="primary" :icon="Search" @click="loadData">搜索</ElButton><ElButton @click="reset">重置</ElButton></ElFormItem>
      </ElForm>
    </ElCard>

    <div class="metric-grid">
      <ElCard v-for="item in metrics" :key="item.label" shadow="never" class="metric-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </ElCard>
    </div>

    <div class="chart-grid">
      <ElCard shadow="never">
        <template #header>合同类型分布</template>
        <ArtRingChart :data="pieTypeData" :show-legend="true" :show-label="true" legend-position="right" height="220px" />
      </ElCard>
      <ElCard shadow="never">
        <template #header>合同状态分布</template>
        <ArtRingChart :data="pieStatusData" :show-legend="true" :show-label="true" legend-position="right" height="220px" />
      </ElCard>
      <ElCard shadow="never">
        <template #header>月度签约金额</template>
        <ArtLineChart :data="lineAmountData" :x-axis-data="lineMonths" :show-label="true" height="220px" />
      </ElCard>
      <ElCard shadow="never">
        <template #header>收付款完成情况</template>
        <ArtBarChart :data="barAmountData" :x-axis-data="barStatuses" :show-label="true" height="220px" />
      </ElCard>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { Search } from '@element-plus/icons-vue'
  import { CONTRACT_STATUS, CONTRACT_TYPES, getAnalysisOverview } from '@/api/contract'

  defineOptions({ name: 'ContractAnalysis' })

  interface DistItem { name: string; count: number }
  interface TrendItem { month: string; amount: number }
  interface PaymentItem { status: string; count: number; amount: number }
  interface AnalysisMetrics {
    totalCount: number; totalAmount: number
    receivableTotal: number; payableTotal: number
    pendingReceive: number; pendingPay: number; overdueTotal: number
  }
  interface AnalysisData {
    metrics: AnalysisMetrics
    typeDist: DistItem[]
    statusDist: DistItem[]
    monthlyTrend: TrendItem[]
    paymentProgress: PaymentItem[]
  }

  const data = ref<AnalysisData>()
  const dateRange = ref<string[]>([])
  const query = reactive({ type: '', status: '' })

  const metrics = computed(() => {
    const m = data.value?.metrics
    return [
      { label: '合同总数', value: m?.totalCount ?? 0 },
      { label: '合同总金额', value: amountText(m?.totalAmount ?? 0) },
      { label: '应收金额', value: amountText(m?.receivableTotal ?? 0) },
      { label: '应付金额', value: amountText(m?.payableTotal ?? 0) },
      { label: '待收金额', value: amountText(m?.pendingReceive ?? 0) },
      { label: '待付金额', value: amountText(m?.pendingPay ?? 0) },
      { label: '逾期金额', value: amountText(m?.overdueTotal ?? 0) }
    ]
  })

  const pieTypeData = computed(() =>
    (data.value?.typeDist || []).map((item) => ({ name: item.name, value: item.count }))
  )

  const pieStatusData = computed(() =>
    (data.value?.statusDist || []).map((item) => ({ name: item.name, value: item.count }))
  )

  const lineMonths = computed(() =>
    (data.value?.monthlyTrend || []).map((item) => item.month)
  )

  const lineAmountData = computed(() =>
    (data.value?.monthlyTrend || []).map((item) => item.amount)
  )

  const barStatuses = computed(() =>
    (data.value?.paymentProgress || []).map((item) => item.status)
  )

  const barAmountData = computed(() =>
    (data.value?.paymentProgress || []).map((item) => item.amount)
  )

  async function loadData() {
    const { data: result } = await getAnalysisOverview({
      ...query,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1]
    })
    data.value = result
  }

  function reset() {
    dateRange.value = []
    Object.assign(query, { type: '', status: '' })
    loadData()
  }

  function amountText(value: string | number) {
    return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  onMounted(loadData)
</script>

<style scoped lang="scss">
  .contract-analysis {
    display: flex;
    flex-direction: column;
    gap: 16px;

    :deep(.el-card) {
      border: none;
      border-radius: 8px;
      box-shadow: none;
    }

    .filter-form {
      @include responsiveFilterForm();
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 12px;
    }

    .metric-card :deep(.el-card__body) {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    strong {
      font-size: 22px;
    }

    .chart-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
  }
</style>
