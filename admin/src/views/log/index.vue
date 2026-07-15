<template>
  <div class="oper-log-page">
    <ElCard shadow="never" class="filter-card">
      <ElForm :inline="true" :model="filterForm" class="filter-form">
        <ElFormItem label="操作动作">
          <ElInput
            v-model="filterForm.keyword"
            placeholder="输入操作动作"
            clearable
            class="filter-input"
            @keyup.enter="handleSearch"
          />
        </ElFormItem>
        <ElFormItem label="操作人ID">
          <ElInputNumber
            v-model="filterForm.userId"
            :min="1"
            :controls="false"
            placeholder="输入操作人ID"
            class="filter-number"
          />
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" :icon="Search" @click="handleSearch">搜索</ElButton>
          <ElButton :icon="Refresh" @click="handleReset">重置</ElButton>
        </ElFormItem>
      </ElForm>
    </ElCard>

    <ElCard shadow="never" class="table-card">
      <div class="table-header">
        <div>
          <div class="panel-title">操作日志</div>
          <div class="panel-subtitle">共 {{ pagination.total }} 条记录</div>
        </div>
        <ElButton :icon="Refresh" :loading="loading" @click="loadList">刷新</ElButton>
      </div>

      <div class="table-container">
        <ElTable
          v-loading="loading"
          :data="tableData"
          height="100%"
          style="width: 100%"
          empty-text="暂无操作日志数据"
        >
          <ElTableColumn prop="id" label="日志ID" width="90" align="center" />
          <ElTableColumn prop="userId" label="操作人ID" width="110" align="center">
            <template #default="{ row }">
              {{ row.userId || '-' }}
            </template>
          </ElTableColumn>
          <ElTableColumn prop="action" label="操作动作" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <ElTag v-if="row.action" type="primary" effect="plain">{{ row.action }}</ElTag>
              <span v-else>-</span>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="ip" label="请求IP" width="150" />
          <ElTableColumn prop="ipAddr" label="归属地" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.ipAddr || '-' }}
            </template>
          </ElTableColumn>
          <ElTableColumn prop="createTime" label="操作时间" width="180" />
          <ElTableColumn label="操作" width="100" align="center" fixed="right">
            <template #default="{ row }">
              <ElButton link type="primary" @click="handleView(row)">详情</ElButton>
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
          @size-change="loadList"
          @current-change="loadList"
        />
      </div>
    </ElCard>

    <ElDrawer v-model="drawerVisible" title="日志详情" size="520px">
      <ElDescriptions v-if="currentLog" :column="1" border>
        <ElDescriptionsItem label="日志ID">{{ currentLog.id }}</ElDescriptionsItem>
        <ElDescriptionsItem label="操作人ID">{{ currentLog.userId || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="操作动作">{{ currentLog.action || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="请求IP">{{ currentLog.ip || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="归属地">{{ currentLog.ipAddr || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="操作时间">{{ currentLog.createTime }}</ElDescriptionsItem>
      </ElDescriptions>
      <div class="params-block">
        <div class="params-title">请求参数</div>
        <pre>{{ formatParams(currentLog?.params) }}</pre>
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { Refresh, Search } from '@element-plus/icons-vue'
  import { getOperLogList, type OperLogItem } from '@/api/log'

  defineOptions({ name: 'OperLog' })

  const filterForm = reactive({
    keyword: '',
    userId: undefined as number | undefined
  })
  const loading = ref(false)
  const tableData = ref<OperLogItem[]>([])
  const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
  const drawerVisible = ref(false)
  const currentLog = ref<OperLogItem | null>(null)

  async function loadList() {
    loading.value = true
    try {
      const { data } = await getOperLogList({
        keyword: filterForm.keyword || undefined,
        userId: filterForm.userId,
        page: pagination.page,
        pageSize: pagination.pageSize,
        order: 'createTime',
        sort: 'desc'
      })
      tableData.value = data?.list || []
      pagination.total = data?.pagination?.total || 0
    } catch {
      ElMessage.error('加载操作日志失败')
    } finally {
      loading.value = false
    }
  }

  function handleSearch() {
    pagination.page = 1
    loadList()
  }

  function handleReset() {
    filterForm.keyword = ''
    filterForm.userId = undefined
    pagination.page = 1
    loadList()
  }

  function handleView(row: any) {
    currentLog.value = row as OperLogItem
    drawerVisible.value = true
  }

  function formatParams(params?: string | null) {
    if (!params) return '-'
    try {
      return JSON.stringify(JSON.parse(params), null, 2)
    } catch {
      return params
    }
  }

  onMounted(() => loadList())
</script>

<style lang="scss" scoped src="./index.scss"></style>
