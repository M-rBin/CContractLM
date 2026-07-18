<template>
  <div class="organization-user">
    <div class="user-layout">
      <!-- 左侧：部门树卡片 -->
      <ElCard shadow="never" class="dept-tree-card">
        <div class="tree-header">
          <span class="tree-title">部门列表</span>
        </div>
        <ElInput v-model="deptFilterText" placeholder="请输入内容" clearable class="tree-search" />
        <ElScrollbar class="tree-container">
          <ElTree
            ref="treeRef"
            :data="departmentTree"
            :props="{ label: 'name', children: 'children' }"
            :filter-node-method="filterNode"
            node-key="id"
            default-expand-all
            highlight-current
            @node-click="handleDeptClick"
          />
        </ElScrollbar>
      </ElCard>

      <!-- 右侧：筛选 + 表格 -->
      <div class="user-content">
        <!-- 筛选卡片 -->
        <ElCard shadow="never" class="filter-card">
          <ElForm :model="filterForm" :inline="true" class="filter-form">
            <ElFormItem label="员工查询">
              <ElInput
                v-model="filterForm.keyword"
                placeholder="输入姓名/账号/手机号"
                clearable
                class="filter-input"
              />
            </ElFormItem>
            <ElFormItem label="员工状态">
              <ElSelect
                v-model="filterForm.status"
                placeholder="请选择"
                clearable
                class="filter-select"
              >
                <ElOption label="启用" :value="1" />
                <ElOption label="禁用" :value="0" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem class="filter-actions">
              <ElButton type="primary" @click="handleSearch">搜索</ElButton>
              <ElButton @click="handleReset">重置</ElButton>
            </ElFormItem>
          </ElForm>
        </ElCard>

        <!-- 表格卡片 -->
        <ElCard shadow="never" class="table-card">
          <div class="table-header">
            <ElButton type="primary" @click="handleAdd">新增</ElButton>
            <ElButton type="primary" plain @click="handleImport">导入</ElButton>
            <ElButton type="primary" plain @click="handleExport">导出</ElButton>
            <ElButton type="primary" plain :disabled="selectedRows.length === 0" @click="handleBatchSetPosition">设置岗位</ElButton>
            <ElButton type="primary" plain :disabled="selectedRows.length === 0" @click="handleBatchSetRole">设置角色</ElButton>
            <ElButton type="danger" plain :disabled="selectedRows.length === 0" @click="handleBatchDelete">批量删除</ElButton>
          </div>

          <div class="table-container">
            <ElTable
              ref="tableRef"
              v-loading="loading"
              :data="tableData"
              height="100%"
              @selection-change="handleSelectionChange"
            >
              <ElTableColumn type="selection" width="55" fixed="left" />
              <ElTableColumn prop="name" label="姓名" width="120" fixed="left" />
              <ElTableColumn prop="username" label="账号" width="120" />
              <ElTableColumn label="所属部门" min-width="160">
                <template #default="{ row }">{{ row.department?.name || '-' }}</template>
              </ElTableColumn>
              <ElTableColumn label="岗位" width="120">
                <template #default="{ row }">{{ row.position?.name || '-' }}</template>
              </ElTableColumn>
              <ElTableColumn label="角色" width="140">
                <template #default="{ row }">
                  {{ row.userRoles?.map((ur: any) => ur.role?.name).join(', ') || '-' }}
                </template>
              </ElTableColumn>
              <ElTableColumn label="手机号" width="130">
                <template #default="{ row }">{{ maskPhone(row.phone) }}</template>
              </ElTableColumn>
              <ElTableColumn label="状态" width="100" align="center">
                <template #default="{ row }">
                  <ElSwitch
                    v-model="row.status"
                    :active-value="1"
                    :inactive-value="0"
                    @change="handleStatusChange(row)"
                  />
                </template>
              </ElTableColumn>
              <ElTableColumn label="操作" width="150" align="center" fixed="right">
                <template #default="{ row }">
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
              @size-change="
                () => {
                  pagination.page = 1
                  loadUserList()
                }
              "
              @current-change="loadUserList"
            />
          </div>
        </ElCard>
      </div>
    </div>

    <!-- 新增/编辑对话框 -->
    <ElDialog v-model="dialogVisible" :title="dialogTitle" width="600px" @closed="resetForm">
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <ElFormItem label="姓名" prop="name">
          <ElInput v-model="form.name" placeholder="请输入姓名" maxlength="20" />
        </ElFormItem>
        <ElFormItem label="账号" prop="username">
          <ElInput v-model="form.username" :disabled="isEditing" placeholder="请输入账号" />
        </ElFormItem>
        <ElFormItem v-if="!isEditing" label="密码" prop="password">
          <ElInput v-model="form.password" type="password" show-password placeholder="请输入密码" />
        </ElFormItem>
        <ElFormItem label="手机号" prop="phone">
          <ElInput v-model="form.phone" placeholder="请输入手机号" maxlength="11" />
        </ElFormItem>
        <ElFormItem label="所属部门" prop="departmentId">
          <ElTreeSelect
            v-model="form.departmentId"
            :data="departmentTree.filter((d: any) => d.id !== 0)"
            :props="{ label: 'name' }"
            node-key="id"
            placeholder="请选择部门"
            clearable
            check-strictly
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem label="岗位">
          <ElSelect v-model="form.positionId" placeholder="请选择岗位" clearable style="width: 100%">
            <ElOption v-for="pos in positionList" :key="pos.id" :label="pos.name" :value="pos.id" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="角色">
          <ElSelect v-model="form.roleIds" multiple placeholder="请选择角色" clearable style="width: 100%">
            <ElOption v-for="role in roleList" :key="role.id" :label="role.name" :value="role.id" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="邮箱" prop="email">
          <ElInput v-model="form.email" placeholder="请输入邮箱" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitLoading" @click="handleSubmit">确定</ElButton>
      </template>
    </ElDialog>

    <!-- 批量设置岗位对话框 -->
    <ElDialog v-model="positionDialogVisible" title="设置岗位" width="400px">
      <ElForm :model="positionForm" label-width="80px">
        <ElFormItem label="岗位">
          <ElSelect v-model="positionForm.positionId" placeholder="请选择岗位" clearable style="width: 100%">
            <ElOption v-for="pos in positionList" :key="pos.id" :label="pos.name" :value="pos.id" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="positionDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="handleConfirmSetPosition">确定</ElButton>
      </template>
    </ElDialog>

    <!-- 批量设置角色对话框 -->
    <ElDialog v-model="roleDialogVisible" title="设置角色" width="400px">
      <ElForm :model="roleForm" label-width="80px">
        <ElFormItem label="角色">
          <ElSelect
            v-model="roleForm.roleIds"
            multiple
            placeholder="请选择角色，不选择则清空"
            clearable
            style="width: 100%"
          >
            <ElOption v-for="role in roleList" :key="role.id" :label="role.name" :value="role.id" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="roleDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="handleConfirmSetRole">确定</ElButton>
      </template>
    </ElDialog>

    <!-- 导入用户对话框 -->
    <ElDialog v-model="importDialogVisible" title="导入用户" width="520px" @closed="resetImport">
      <ElAlert
        title="请上传 Excel 文件，表头支持：账号、密码、姓名、手机号、邮箱、部门ID、岗位ID、角色ID。角色ID多个时用逗号分隔。"
        type="info"
        show-icon
        :closable="false"
        class="import-tip"
      />
      <ElUpload
        drag
        accept=".xlsx,.xls"
        :limit="1"
        :auto-upload="false"
        :on-change="handleImportFileChange"
        :on-remove="resetImportRows"
      >
        <div class="upload-text">点击或拖拽文件到此处</div>
      </ElUpload>
      <div v-if="importRows.length" class="import-summary">已解析 {{ importRows.length }} 条用户数据</div>
      <template #footer>
        <ElButton @click="importDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="importLoading" @click="handleConfirmImport">确定导入</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch, onMounted, onActivated, nextTick } from 'vue'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
  import { saveAs } from 'file-saver'
  import * as XLSX from 'xlsx'
  import { userApi, type AdminUser, type ImportUserRow } from '@/api/user'
  import { departmentApi, type Department } from '@/api/department'
  import { getPositionList } from '@/api/organization'
  import { getRoleList } from '@/api/permission'
  import { maskPhone } from '@/utils/dataprocess/format'

  defineOptions({ name: 'OrganizationUser' })

  // 部门树
  const treeRef = ref()
  const deptFilterText = ref('')
  const departmentTree = ref<Department[]>([])
  const selectedDeptId = ref<number>()

  // 表格
  const tableRef = ref()
  const loading = ref(false)
  const tableData = ref<AdminUser[]>([])
  const selectedRows = ref<AdminUser[]>([])

  const filterForm = reactive({ keyword: '', status: '' as any })

  const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

  // 对话框
  const dialogVisible = ref(false)
  const isEditing = ref(false)
  const dialogTitle = computed(() => (isEditing.value ? '编辑用户' : '新增用户'))
  const submitLoading = ref(false)

  const formRef = ref<FormInstance>()
  const form = reactive({
    id: undefined as number | undefined,
    name: '',
    username: '',
    password: '',
    departmentId: undefined as number | undefined,
    positionId: undefined as number | undefined,
    roleIds: [] as number[],
    phone: '',
    email: ''
  })

  const formRules: FormRules = {
    name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
    username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    // 手机号、邮箱非必填；邮箱填写时才校验格式（留空自动跳过）
    email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
    departmentId: [{ required: true, message: '请选择部门', trigger: 'change' }]
  }

  // 岗位和角色列表
  const positionList = ref<{ id: number; name: string }[]>([])
  const roleList = ref<{ id: number; name: string }[]>([])

  const positionDialogVisible = ref(false)
  const positionForm = reactive({ positionId: undefined as number | undefined })

  const roleDialogVisible = ref(false)
  const roleForm = reactive({ roleIds: [] as number[] })

  const importDialogVisible = ref(false)
  const importLoading = ref(false)
  const importRows = ref<ImportUserRow[]>([])

  // 部门树加载
  async function loadDepartmentList() {
    try {
      const { data } = await departmentApi.getTree()
      const deptList = data || []
      departmentTree.value = [
        { id: 0, name: '全部', children: [], parentId: null } as Department,
        ...deptList
      ]
    } catch {
      // 请求错误由 http 拦截器统一提示，此处不重复弹出
    }
  }

  watch(deptFilterText, (val) => treeRef.value?.filter(val))

  const filterNode = (value: string, data: any) => !value || data.name.includes(value)

  function handleDeptClick(data: Department) {
    selectedDeptId.value = data.id === 0 ? undefined : data.id
    pagination.page = 1
    loadUserList()
  }

  // 用户列表加载
  async function loadUserList() {
    loading.value = true
    try {
      const { data } = await userApi.getList({
        keyword: filterForm.keyword || undefined,
        departmentId: selectedDeptId.value || undefined,
        status: filterForm.status !== '' ? filterForm.status : undefined,
        page: pagination.page,
        pageSize: pagination.pageSize
      })
      tableData.value = data?.list || []
      pagination.total = data?.pagination?.total || 0
    } catch {
      // 请求错误由 http 拦截器统一提示，此处不重复弹出
    } finally {
      loading.value = false
    }
  }

  function handleSearch() {
    pagination.page = 1
    loadUserList()
  }

  function handleReset() {
    filterForm.keyword = ''
    filterForm.status = ''
    pagination.page = 1
    loadUserList()
  }

  function handleSelectionChange(selection: AdminUser[]) {
    selectedRows.value = selection
  }

  function handleAdd() {
    isEditing.value = false
    dialogVisible.value = true
  }

  function handleEdit(row: any) {
    isEditing.value = true
    dialogVisible.value = true
    Object.assign(form, {
      id: row.id,
      name: row.name || '',
      username: row.username,
      password: '',
      departmentId: row.departmentId,
      positionId: row.positionId,
      roleIds: row.userRoles?.map((ur: any) => ur.role?.id) || [],
      phone: row.phone || '',
      email: row.email || ''
    })
  }

  async function handleDelete(row: any) {
    try {
      await ElMessageBox.confirm(`确定要删除用户"${row.name || row.username}"吗？`, '提示', { type: 'warning' })
      await userApi.delete(row.id)
      ElMessage.success('删除成功')
      loadUserList()
    } catch {
      // 取消确认无需提示；请求失败由 http 拦截器统一提示
    }
  }

  async function handleStatusChange(row: AdminUser | any) {
    try {
      await userApi.updateStatus(row.id, row.status!)
      ElMessage.success('状态更新成功')
    } catch {
      // 请求失败由 http 拦截器统一提示，此处仅回滚开关状态
      row.status = row.status === 1 ? 0 : 1
    }
  }

  async function handleSubmit() {
    try {
      await formRef.value?.validate()
      submitLoading.value = true
      if (isEditing.value && form.id) {
        await userApi.update({
          id: form.id,
          name: form.name,
          phone: form.phone,
          email: form.email,
          departmentId: form.departmentId,
          positionId: form.positionId,
          roleIds: form.roleIds
        })
        ElMessage.success('更新成功')
      } else {
        await userApi.add({
          username: form.username,
          password: form.password,
          name: form.name,
          phone: form.phone,
          email: form.email,
          departmentId: form.departmentId,
          positionId: form.positionId,
          roleIds: form.roleIds
        })
        ElMessage.success('新增成功')
      }
      dialogVisible.value = false
      loadUserList()
    } catch {
      // 表单校验失败由表单内联提示，请求错误由 http 拦截器统一提示，此处无需处理
    } finally {
      submitLoading.value = false
    }
  }

  function resetForm() {
    formRef.value?.resetFields()
    Object.assign(form, {
      id: undefined,
      name: '',
      username: '',
      password: '',
      departmentId: undefined,
      positionId: undefined,
      roleIds: [],
      phone: '',
      email: ''
    })
  }

  async function handleBatchDelete() {
    try {
      await ElMessageBox.confirm(
        `确定要删除选中的 ${selectedRows.value.length} 个用户吗？`,
        '提示',
        { type: 'warning' }
      )
      const ids = selectedRows.value.map((row) => row.id)
      await userApi.batchDelete(ids)
      ElMessage.success('批量删除成功')
      loadUserList()
    } catch {
      // 取消确认无需提示；请求失败由 http 拦截器统一提示
    }
  }

  function handleBatchSetPosition() {
    positionDialogVisible.value = true
  }

  async function handleConfirmSetPosition() {
    if (!positionForm.positionId) {
      ElMessage.warning('请选择岗位')
      return
    }
    await userApi.batchSetPosition(
      selectedRows.value.map((row) => row.id),
      positionForm.positionId
    )
    ElMessage.success('岗位设置成功')
    positionDialogVisible.value = false
    positionForm.positionId = undefined
    selectedRows.value = []
    loadUserList()
  }

  function handleBatchSetRole() {
    roleDialogVisible.value = true
  }

  async function handleConfirmSetRole() {
    await userApi.batchSetRoles(
      selectedRows.value.map((row) => row.id),
      roleForm.roleIds
    )
    ElMessage.success('角色设置成功')
    roleDialogVisible.value = false
    roleForm.roleIds = []
    selectedRows.value = []
    loadUserList()
  }

  function handleImport() {
    importDialogVisible.value = true
  }

  async function handleExport() {
    const data = await userApi.export({
      keyword: filterForm.keyword || undefined,
      departmentId: selectedDeptId.value || undefined,
      status: filterForm.status !== '' ? filterForm.status : undefined
    })
    const blob =
      data instanceof Blob ? data : new Blob([data], { type: 'text/csv;charset=utf-8' })
    saveAs(blob, `用户列表-${Date.now()}.csv`)
    ElMessage.success('导出成功')
  }

  async function handleImportFileChange(file: UploadFile) {
    const raw = file.raw
    if (!raw) return
    try {
      const workbook = XLSX.read(await raw.arrayBuffer(), { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      importRows.value = rows.map(parseImportRow).filter((row) => row.username && row.password)
      if (!importRows.value.length) {
        ElMessage.warning('未解析到有效用户数据')
        return
      }
      ElMessage.success(`已解析 ${importRows.value.length} 条用户数据`)
    } catch {
      importRows.value = []
      ElMessage.error('文件解析失败，请检查模板格式')
    }
  }

  async function handleConfirmImport() {
    if (!importRows.value.length) {
      ElMessage.warning('请先上传有效文件')
      return
    }
    try {
      importLoading.value = true
      const { data } = await userApi.import(importRows.value)
      ElMessage.success(`成功导入 ${data?.count || importRows.value.length} 条用户数据`)
      importDialogVisible.value = false
      loadUserList()
    } finally {
      importLoading.value = false
    }
  }

  function resetImportRows() {
    importRows.value = []
  }

  function resetImport() {
    resetImportRows()
  }

  function parseImportRow(row: Record<string, unknown>): ImportUserRow {
    const roleText = textValue(row['角色ID'] ?? row['roleIds'])
    return {
      username: textValue(row['账号'] ?? row['用户名'] ?? row['username']),
      password: textValue(row['密码'] ?? row['password']),
      name: textValue(row['姓名'] ?? row['name']) || undefined,
      phone: textValue(row['手机号'] ?? row['phone']) || undefined,
      email: textValue(row['邮箱'] ?? row['email']) || undefined,
      departmentId: numberValue(row['部门ID'] ?? row['departmentId']),
      positionId: numberValue(row['岗位ID'] ?? row['positionId']),
      roleIds: roleText
        ? roleText
            .split(/[,，;；]/)
            .map((id) => Number(id.trim()))
            .filter((id) => Number.isInteger(id) && id > 0)
        : undefined
    }
  }

  function textValue(value: unknown) {
    return String(value ?? '').trim()
  }

  function numberValue(value: unknown) {
    const num = Number(value)
    return Number.isInteger(num) && num > 0 ? num : undefined
  }

  async function loadPositionAndRoleList() {
    try {
      const [posRes, roleRes] = await Promise.all([
        getPositionList({ pageSize: 100 }),
        getRoleList({ pageSize: 100 })
      ])
      positionList.value = posRes.data?.list || []
      roleList.value = roleRes.data?.list || []
    } catch {
      // 静默失败，不阻塞页面
    }
  }

  let isMounted = false
  onMounted(async () => {
    isMounted = true
    await loadDepartmentList()
    await nextTick()
    treeRef.value?.setCurrentKey(0)
    loadUserList()
    loadPositionAndRoleList()
  })

  onActivated(() => {
    if (!isMounted) return
    loadDepartmentList()
    loadUserList()
    loadPositionAndRoleList()
  })
</script>

<style lang="scss" scoped>
  .organization-user {
    height: 100%;
    display: flex;
    flex-direction: column;

    .user-layout {
      display: flex;
      gap: 16px;
      height: 100%;
      overflow: hidden;

      .dept-tree-card {
        width: 280px;
        flex-shrink: 0;
        border-radius: 12px;
        border: none !important;
        box-shadow: none !important;
        display: flex;
        flex-direction: column;
        overflow: hidden;

        :deep(.el-card__body) {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 20px;
        }

        .tree-header {
          margin-bottom: 16px;

          .tree-title {
            font-size: 16px;
            font-weight: 500;
          }
        }

        .tree-search {
          margin-bottom: 16px;
        }

        .tree-container {
          flex: 1;
          overflow: hidden;
        }
      }

      .user-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow: hidden;

        .filter-card {
          flex-shrink: 0;
          border: none !important;
          box-shadow: none !important;
          border-radius: 12px;

          :deep(.el-card__body) {
            padding: 12px 20px;
          }

          // 筛选表单：宽屏行内、窄屏堆叠（公共 mixin）
          .filter-form {
            @include responsiveFilterForm();
          }
        }

        .table-card {
          flex: 1;
          border: none !important;
          box-shadow: none !important;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;

          :deep(.el-card__body) {
            padding: 20px;
            height: 100%;
            display: flex;
            flex-direction: column;
          }

          .table-header {
            flex-shrink: 0;
            margin-bottom: 16px;
            display: flex;
            gap: 12px;
          }

          .table-container {
            flex: 1;
            overflow: hidden;
          }

          .pagination-container {
            flex-shrink: 0;
            display: flex;
            justify-content: flex-end;
            margin-top: 16px;
          }
        }
      }
    }

    .import-tip {
      margin-bottom: 16px;
    }

    .upload-text {
      color: var(--el-text-color-regular);
    }

    .import-summary {
      margin-top: 12px;
      color: var(--el-color-success);
    }
  }
</style>
