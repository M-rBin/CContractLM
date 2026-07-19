<template>
  <div class="tenant-page">
    <!-- 搜索栏 -->
    <ElCard shadow="never" class="filter-card">
      <ElForm :model="query" :inline="true" class="filter-form">
        <ElFormItem label="公司名称">
          <ElInput v-model="query.name" placeholder="请输入公司名称" clearable />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElSelect v-model="query.status" placeholder="全部" clearable class="filter-select">
            <ElOption label="启用" :value="1" />
            <ElOption label="停用" :value="0" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" :icon="Search" @click="loadData">搜索</ElButton>
          <ElButton @click="handleReset">重置</ElButton>
        </ElFormItem>
      </ElForm>
    </ElCard>

    <!-- 操作栏 -->
    <ElCard shadow="never">
      <div class="table-toolbar">
        <ElButton type="primary" :icon="Plus" @click="handleAdd">新增公司</ElButton>
      </div>

      <ElTable :data="(list as TenantItem[])" border stripe v-loading="loading" row-key="id">
        <ElTableColumn prop="name" label="公司名称" min-width="160" show-overflow-tooltip />
        <ElTableColumn prop="code" label="公司编码" width="140" />
        <ElTableColumn prop="status" label="状态" width="90" align="center">
          <template #default="scope">
            <ElTag :type="(scope.row as TenantItem).status === 1 ? 'success' : 'danger'">
              {{ (scope.row as TenantItem).status === 1 ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <ElTableColumn prop="userCount" label="关联用户" width="100" align="center" />
        <ElTableColumn prop="createTime" label="创建时间" width="160">
          <template #default="scope">{{ formatTime((scope.row as TenantItem).createTime) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="280" fixed="right">
          <template #default="scope">
            <ElButton type="primary" link @click="handleEdit(scope.row as TenantItem)">编辑</ElButton>
            <ElButton type="info" link @click="openUserDrawer(scope.row as TenantItem)">关联用户</ElButton>
            <ElButton v-if="(scope.row as TenantItem).status === 1" type="warning" link @click="handleToggle(scope.row as TenantItem, 0)">停用</ElButton>
            <ElButton v-else type="success" link @click="handleToggle(scope.row as TenantItem, 1)">启用</ElButton>
            <ElPopconfirm title="确定删除该公司吗？" @confirm="handleDelete((scope.row as TenantItem).id)">
              <template #reference>
                <ElButton type="danger" link>删除</ElButton>
              </template>
            </ElPopconfirm>
          </template>
        </ElTableColumn>
      </ElTable>

      <div class="pagination-wrap">
        <ElPagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @change="loadData"
        />
      </div>
    </ElCard>

    <!-- 新增/编辑弹窗 -->
    <ElDialog v-model="dialogVisible" :title="editId ? '编辑公司' : '新增公司'" width="480px" @closed="handleDialogClosed">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem label="公司名称" prop="name">
          <ElInput v-model="form.name" placeholder="请填写公司名称" maxlength="100" show-word-limit />
        </ElFormItem>
        <ElFormItem label="公司编码" prop="code">
          <ElInput v-model="form.code" placeholder="请填写公司编码" maxlength="50" show-word-limit />
        </ElFormItem>
        <ElFormItem label="状态" prop="status">
          <ElRadioGroup v-model="form.status">
            <ElRadio :value="1">启用</ElRadio>
            <ElRadio :value="0">停用</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="备注" prop="remark">
          <ElInput v-model="form.remark" type="textarea" :rows="3" placeholder="选填" maxlength="200" show-word-limit />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
      </template>
    </ElDialog>
    <!-- 关联用户抽屉 -->
    <ElDrawer v-model="userDrawerVisible" :title="`关联用户 - ${currentTenant?.name}`" size="480px" @closed="handleUserDrawerClosed">
      <!-- 已关联用户列表 -->
      <div class="drawer-section">
        <div class="drawer-section-title">已关联用户</div>
        <ElInput v-model="linkedKeyword" placeholder="搜索用户名/姓名" clearable class="drawer-search" @input="loadLinkedUsers" />
        <div v-if="linkedLoading" class="drawer-loading"><ElIcon class="is-loading"><Loading /></ElIcon></div>
        <ElEmpty v-else-if="linkedUsers.length === 0" description="暂无关联用户" :image-size="60" />
        <div v-else class="user-list">
          <div v-for="u in linkedUsers" :key="u.id" class="user-item">
            <div class="user-info">
              <span class="user-name">{{ u.name || u.username }}</span>
              <span class="user-meta">{{ u.username }} · {{ u.department?.name || '无部门' }}</span>
            </div>
            <ElButton type="danger" link :loading="removingId === u.id" @click="handleRemoveUser(u.id)">移除</ElButton>
          </div>
        </div>
      </div>

      <!-- 添加用户 -->
      <div class="drawer-section">
        <div class="drawer-section-title">添加用户</div>
        <div class="add-user-row">
          <ElSelect
            v-model="selectedUserIds"
            multiple
            filterable
            remote
            reserve-keyword
            placeholder="搜索并选择用户"
            :remote-method="searchAvailable"
            :loading="availableLoading"
            class="add-user-select"
          >
            <ElOption v-for="u in availableUsers" :key="u.id" :label="`${u.name || u.username} (${u.username})`" :value="u.id">
              <span>{{ u.name || u.username }}</span>
              <span class="option-meta"> · {{ u.username }} · {{ u.department?.name || '无部门' }}</span>
            </ElOption>
          </ElSelect>
          <ElButton type="primary" :disabled="selectedUserIds.length === 0" :loading="addingUsers" @click="handleAddUsers">添加</ElButton>
        </div>
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import { Plus, Search, Loading } from '@element-plus/icons-vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import {
    getTenantPage, createTenant, updateTenant, deleteTenant,
    enableTenant, disableTenant, getTenantUsers, getAvailableTenantUsers,
    addTenantUsers, removeTenantUser, type TenantItem, type TenantUser
  } from '@/api/tenant'

  defineOptions({ name: 'TenantManage' })

  const loading = ref(false)
  const submitting = ref(false)
  const list = ref<TenantItem[]>([])
  const total = ref(0)

  const query = reactive({ name: '', status: undefined as number | undefined, page: 1, pageSize: 10 })

  const dialogVisible = ref(false)
  const editId = ref<number | null>(null)
  const formRef = ref<FormInstance>()
  const form = reactive({ name: '', code: '', status: 1, remark: '' })

  const rules: FormRules = {
    name: [{ required: true, message: '请填写公司名称', trigger: 'blur' }],
    code: [{ required: true, message: '请填写公司编码', trigger: 'blur' }]
  }

  async function loadData() {
    loading.value = true
    try {
      const { data } = await getTenantPage({ ...query, name: query.name || undefined })
      list.value = data.list
      total.value = data.pagination.total
    } finally {
      loading.value = false
    }
  }

  function handleReset() {
    Object.assign(query, { name: '', status: undefined, page: 1 })
    loadData()
  }

  function handleAdd() {
    editId.value = null
    Object.assign(form, { name: '', code: '', status: 1, remark: '' })
    dialogVisible.value = true
  }

  function handleEdit(row: TenantItem) {
    editId.value = row.id
    Object.assign(form, { name: row.name, code: row.code, status: row.status, remark: row.remark ?? '' })
    dialogVisible.value = true
  }

  async function handleSubmit() {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
    submitting.value = true
    try {
      if (editId.value) {
        await updateTenant(editId.value, { name: form.name, code: form.code, status: form.status, remark: form.remark || undefined })
        ElMessage.success('编辑成功')
      } else {
        await createTenant({ name: form.name, code: form.code, status: form.status, remark: form.remark || undefined })
        ElMessage.success('新增成功')
      }
      dialogVisible.value = false
      loadData()
    } catch {
      // 错误消息由 http 拦截器统一弹出
    } finally {
      submitting.value = false
    }
  }

  async function handleToggle(row: TenantItem, status: 0 | 1) {
    try {
      await (status === 1 ? enableTenant(row.id) : disableTenant(row.id))
      ElMessage.success(status === 1 ? '启用成功' : '停用成功')
      loadData()
    } catch {
      // 错误消息由 http 拦截器统一弹出
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteTenant(id)
      ElMessage.success('删除成功')
      loadData()
    } catch {
      // 错误消息由 http 拦截器统一弹出
    }
  }

  function handleDialogClosed() {
    formRef.value?.clearValidate()
  }

  // ---- 关联用户抽屉 ----
  const userDrawerVisible = ref(false)
  const currentTenant = ref<TenantItem | null>(null)
  const linkedUsers = ref<TenantUser[]>([])
  const linkedLoading = ref(false)
  const linkedKeyword = ref('')
  const removingId = ref<number | null>(null)
  const availableUsers = ref<TenantUser[]>([])
  const availableLoading = ref(false)
  const selectedUserIds = ref<number[]>([])
  const addingUsers = ref(false)

  async function openUserDrawer(row: TenantItem) {
    currentTenant.value = row
    linkedKeyword.value = ''
    selectedUserIds.value = []
    availableUsers.value = []
    userDrawerVisible.value = true
    await loadLinkedUsers()
  }

  async function loadLinkedUsers() {
    if (!currentTenant.value) return
    linkedLoading.value = true
    try {
      const { data } = await getTenantUsers(currentTenant.value.id, linkedKeyword.value || undefined)
      linkedUsers.value = data
    } finally {
      linkedLoading.value = false
    }
  }

  async function searchAvailable(keyword: string) {
    if (!currentTenant.value) return
    availableLoading.value = true
    try {
      const { data } = await getAvailableTenantUsers(currentTenant.value.id, keyword || undefined)
      availableUsers.value = data
    } finally {
      availableLoading.value = false
    }
  }

  async function handleAddUsers() {
    if (!currentTenant.value || selectedUserIds.value.length === 0) return
    addingUsers.value = true
    try {
      await addTenantUsers(currentTenant.value.id, selectedUserIds.value)
      ElMessage.success('添加成功')
      selectedUserIds.value = []
      availableUsers.value = []
      await loadLinkedUsers()
    } catch {
      // http 拦截器统一提示
    } finally {
      addingUsers.value = false
    }
  }

  async function handleRemoveUser(userId: number) {
    if (!currentTenant.value) return
    removingId.value = userId
    try {
      await removeTenantUser(currentTenant.value.id, userId)
      ElMessage.success('已移除')
      linkedUsers.value = linkedUsers.value.filter(u => u.id !== userId)
    } catch {
      // http 拦截器统一提示
    } finally {
      removingId.value = null
    }
  }

  function handleUserDrawerClosed() {
    currentTenant.value = null
    linkedUsers.value = []
    availableUsers.value = []
  }

  function formatTime(val: string) {
    return val ? val.replace('T', ' ').slice(0, 19) : '-'
  }

  onMounted(loadData)
</script>

<style scoped lang="scss">
  .tenant-page {
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

    .filter-select {
      width: 120px;
    }

    .table-toolbar {
      margin-bottom: 12px;
    }

    .pagination-wrap {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  }

  .drawer-section {
    margin-bottom: 24px;

    .drawer-section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 12px;
    }

    .drawer-search {
      margin-bottom: 12px;
    }

    .drawer-loading {
      text-align: center;
      padding: 20px 0;
      color: var(--el-text-color-secondary);
    }

    .user-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .user-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: 6px;
      background: var(--el-fill-color-light);

      .user-info {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .user-name {
          font-size: 14px;
          color: var(--el-text-color-primary);
        }

        .user-meta {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
      }
    }

    .add-user-row {
      display: flex;
      gap: 8px;

      .add-user-select {
        flex: 1;
      }
    }

    .option-meta {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
