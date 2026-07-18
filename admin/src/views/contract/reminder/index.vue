<template>
  <div class="contract-reminder">
    <ElCard shadow="never" class="filter-card">
      <ElForm :model="query" :inline="true" class="filter-form">
        <ElFormItem label="合同名称"><ElInput v-model="query.contractName" clearable placeholder="请输入" /></ElFormItem>
        <ElFormItem label="提醒类型"><ElSelect v-model="query.type" clearable placeholder="请选择" class="filter-select"><ElOption v-for="item in reminderTypes" :key="item" :label="item" :value="item" /></ElSelect></ElFormItem>
        <ElFormItem label="逾期状态"><ElSelect v-model="query.overdueStatus" clearable placeholder="请选择" class="filter-select"><ElOption label="未逾期" value="未逾期" /><ElOption label="已逾期" value="已逾期" /></ElSelect></ElFormItem>
        <ElFormItem label="处理状态"><ElSelect v-model="query.handleStatus" clearable placeholder="请选择" class="filter-select"><ElOption label="待处理" value="待处理" /><ElOption label="已处理" value="已处理" /></ElSelect></ElFormItem>
        <ElFormItem><ElButton type="primary" :icon="Search" @click="search">搜索</ElButton><ElButton @click="reset">重置</ElButton></ElFormItem>
      </ElForm>
    </ElCard>

    <ElCard shadow="never" class="table-card">
      <ElTable v-loading="loading" :data="tableData">
        <ElTableColumn prop="type" label="提醒类型" width="130" />
        <ElTableColumn label="来源合同" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.contract?.name || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="content" label="提醒内容" min-width="260" show-overflow-tooltip />
        <ElTableColumn prop="planDate" label="计划日期" width="120"><template #default="{ row }">{{ dateText(row.planDate) }}</template></ElTableColumn>
        <ElTableColumn label="逾期状态" width="110"><template #default="{ row }"><ElTag :type="row.overdueStatus === '已逾期' ? 'danger' : 'success'">{{ row.overdueStatus }}</ElTag></template></ElTableColumn>
        <ElTableColumn label="处理状态" width="110"><template #default="{ row }"><ElTag :type="row.handleStatus === '已处理' ? 'success' : 'warning'">{{ row.handleStatus }}</ElTag></template></ElTableColumn>
        <ElTableColumn label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="viewSource(row)">查看来源</ElButton>
            <ElButton v-if="row.handleStatus !== '已处理'" link type="success" @click="openHandle(row)">完成处理</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <div class="pager"><ElPagination v-model:current-page="query.page" v-model:page-size="query.pageSize" :total="total" layout="total, sizes, prev, pager, next" @current-change="loadList" @size-change="search" /></div>
    </ElCard>

    <ElDialog v-model="handleDialog" title="完成处理" width="420px">
      <ElForm :model="handleForm" label-width="100px">
        <ElFormItem label="完成日期" required><ElDatePicker v-model="handleForm.actualDate" value-format="YYYY-MM-DD" type="date" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="handleDialog = false">取消</ElButton><ElButton type="primary" @click="submitHandle">确定</ElButton></template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { Search } from '@element-plus/icons-vue'
  import { getReminderList, getReminderSource, handleReminder, type ContractReminder } from '@/api/contract'

  defineOptions({ name: 'ContractReminder' })

  const router = useRouter()
  const loading = ref(false)
  const total = ref(0)
  const tableData = ref<ContractReminder[]>([])
  const reminderTypes = ['合同到期提醒', '履约节点提醒', '逾期提醒']
  const query = reactive({ contractName: '', type: '', overdueStatus: '', handleStatus: '', page: 1, pageSize: 10 })
  const handleDialog = ref(false)
  const handleForm = reactive({ id: 0, actualDate: '' })

  async function loadList() {
    loading.value = true
    try {
      const { data } = await getReminderList(query)
      tableData.value = data?.list || []
      total.value = data?.pagination?.total || 0
    } finally {
      loading.value = false
    }
  }

  function search() {
    query.page = 1
    loadList()
  }

  function reset() {
    Object.assign(query, { contractName: '', type: '', overdueStatus: '', handleStatus: '', page: 1 })
    loadList()
  }

  async function viewSource(row: any) {
    const reminder = row as ContractReminder
    const { data } = await getReminderSource(reminder.id)
    router.push({ path: '/contract/detail', query: { id: data.contractId } })
  }

  function openHandle(row: any) {
    const reminder = row as ContractReminder
    Object.assign(handleForm, { id: reminder.id, actualDate: dateText(new Date().toISOString()) })
    handleDialog.value = true
  }

  async function submitHandle() {
    await handleReminder(handleForm)
    ElMessage.success('处理成功')
    handleDialog.value = false
    loadList()
  }

  function dateText(value?: string) {
    return value ? String(value).slice(0, 10) : ''
  }

  onMounted(loadList)
</script>

<style scoped lang="scss">
  .contract-reminder {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .filter-card,
    .table-card {
      border: none !important;
      border-radius: 8px;
      box-shadow: none !important;
    }

    .filter-form {
      @include responsiveFilterForm();
    }

    .pager {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  }
</style>
