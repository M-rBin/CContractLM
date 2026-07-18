<template>
  <div class="contract-workbench">
    <div class="metric-grid">
      <ElCard v-for="item in metrics" :key="item.label" shadow="never" class="metric-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </ElCard>
    </div>

    <div class="main-grid">
      <ElCard shadow="never">
        <template #header>待办提醒</template>
        <ElTable :data="todos" height="280">
          <ElTableColumn prop="type" label="类型" width="120" />
          <ElTableColumn prop="content" label="内容" min-width="220" show-overflow-tooltip />
          <ElTableColumn prop="planDate" label="计划日期" width="120"><template #default="{ row }">{{ dateText(row.planDate) }}</template></ElTableColumn>
          <ElTableColumn label="操作" width="90"><template #default="{ row }"><ElButton link type="primary" @click="goDetail(row.contractId)">查看</ElButton></template></ElTableColumn>
        </ElTable>
      </ElCard>

      <ElCard shadow="never">
        <template #header>合同状态分布</template>
        <ArtRingChart :data="pieStatusData" :show-legend="true" :show-label="true" legend-position="right" height="280px" />
      </ElCard>
    </div>

    <div class="main-grid">
      <ElCard shadow="never">
        <template #header>合同类型分布</template>
        <ArtBarChart :data="barTypeData" :x-axis-data="barTypeLabels" :show-label="true" height="280px" />
      </ElCard>

      <ElCard shadow="never">
        <template #header>最近动态</template>
        <ElTimeline>
          <ElTimelineItem v-for="item in recentItems" :key="item.key" :timestamp="item.time">
            {{ item.text }}
          </ElTimelineItem>
        </ElTimeline>
        <ElEmpty v-if="!recentItems.length" description="暂无数据" />
      </ElCard>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { getWorkbenchOverview, getWorkbenchRecent, getWorkbenchTodos, type ContractReminder } from '@/api/contract'

  defineOptions({ name: 'ContractWorkbench' })

  interface DistItem { name: string; count: number }
  interface WorkbenchMetrics {
    totalCount: number; performingCount: number; expiringCount: number
    overdueCount: number; pendingReceive: number; pendingPay: number; overdueTotal: number
  }
  interface WorkbenchOverview {
    metrics: WorkbenchMetrics
    charts: { statusDist: DistItem[]; typeDist: DistItem[] }
  }
  interface RecentBaseItem { id: number; name: string; createTime: string; updateTime: string }
  interface RecentPaymentItem extends RecentBaseItem { direction: string; actualAmount?: number; planAmount: number }
  interface WorkbenchRecent {
    recentContracts: RecentBaseItem[]
    recentMilestones: RecentBaseItem[]
    recentPayments: RecentPaymentItem[]
  }

  const router = useRouter()
  const overview = ref<WorkbenchOverview>()
  const todos = ref<ContractReminder[]>([])
  const recent = ref<WorkbenchRecent>()

  const metrics = computed(() => {
    const data = overview.value?.metrics
    return [
      { label: '合同总数', value: data?.totalCount ?? 0 },
      { label: '履行中', value: data?.performingCount ?? 0 },
      { label: '即将到期', value: data?.expiringCount ?? 0 },
      { label: '逾期合同', value: data?.overdueCount ?? 0 },
      { label: '待收金额', value: amountText(data?.pendingReceive ?? 0) },
      { label: '待付金额', value: amountText(data?.pendingPay ?? 0) },
      { label: '逾期金额', value: amountText(data?.overdueTotal ?? 0) }
    ]
  })

  const pieStatusData = computed(() =>
    (overview.value?.charts?.statusDist || []).map((item) => ({ name: item.name, value: item.count }))
  )

  const barTypeLabels = computed(() =>
    (overview.value?.charts?.typeDist || []).map((item) => item.name)
  )

  const barTypeData = computed(() =>
    (overview.value?.charts?.typeDist || []).map((item) => item.count)
  )

  const recentItems = computed(() => {
    const contracts = (recent.value?.recentContracts || []).map((item) => ({ key: `c-${item.id}`, text: `新增合同：${item.name}`, time: item.createTime }))
    const milestones = (recent.value?.recentMilestones || []).map((item) => ({ key: `m-${item.id}`, text: `完成履约节点：${item.name}`, time: item.updateTime }))
    const payments = (recent.value?.recentPayments || []).map((item) => ({ key: `p-${item.id}`, text: `完成收付款：${item.direction} ${amountText(item.actualAmount || item.planAmount)}`, time: item.updateTime }))
    return [...contracts, ...milestones, ...payments].slice(0, 8)
  })

  async function loadData() {
    const [overviewRes, todosRes, recentRes] = await Promise.all([getWorkbenchOverview(), getWorkbenchTodos(), getWorkbenchRecent()])
    overview.value = overviewRes.data
    todos.value = todosRes.data || []
    recent.value = recentRes.data
  }

  function goDetail(id: number) {
    router.push({ path: '/contract/detail', query: { id } })
  }

  function dateText(value?: string) {
    return value ? String(value).slice(0, 10) : ''
  }

  function amountText(value: string | number) {
    return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  onMounted(loadData)
</script>

<style scoped lang="scss">
  .contract-workbench {
    display: flex;
    flex-direction: column;
    gap: 16px;

    :deep(.el-card) {
      border: none;
      border-radius: 8px;
      box-shadow: none;
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

    .main-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 16px;
    }
  }
</style>
