<template>
  <div class="dict-page">
    <ElCard shadow="never" class="type-card">
      <div class="panel-header">
        <div class="panel-title">字典类型</div>
        <ElButton type="primary" :icon="Plus" @click="handleAddType">新增</ElButton>
      </div>

      <ElForm :model="typeFilter" class="type-filter" @submit.prevent>
        <ElInput
          v-model="typeFilter.keyword"
          placeholder="搜索类型名称或类型键"
          clearable
          @keyup.enter="handleTypeSearch"
        >
          <template #append>
            <ElButton :icon="Search" @click="handleTypeSearch" />
          </template>
        </ElInput>
      </ElForm>

      <div class="type-list" v-loading="typeLoading">
        <ElEmpty v-if="!typeList.length" description="暂无字典数据" />
        <button
          v-for="item in typeList"
          v-else
          :key="item.id"
          class="type-item"
          :class="{ active: selectedTypeId === item.id }"
          type="button"
          @click="selectType(item)"
        >
          <span class="type-name">{{ item.name }}</span>
          <span class="type-key">{{ item.key }}</span>
        </button>
      </div>

      <div class="type-pagination">
        <ElPagination
          v-model:current-page="typePagination.page"
          v-model:page-size="typePagination.pageSize"
          small
          layout="prev, pager, next"
          :total="typePagination.total"
          @current-change="loadTypeList"
        />
      </div>
    </ElCard>

    <ElCard shadow="never" class="info-card">
      <div class="table-header">
        <div>
          <div class="panel-title">字典项</div>
          <div class="panel-subtitle">
            {{ selectedType ? `${selectedType.name}（${selectedType.key}）` : '请选择字典类型' }}
          </div>
        </div>
        <div class="header-actions">
          <ElButton :icon="Edit" :disabled="!selectedType" @click="handleEditType">编辑类型</ElButton>
          <ElButton :icon="Delete" type="danger" :disabled="!selectedType" @click="handleDeleteType">
            删除类型
          </ElButton>
          <ElButton type="primary" :icon="Plus" :disabled="!selectedType" @click="handleAddInfo">
            新增字典项
          </ElButton>
        </div>
      </div>

      <ElForm :inline="true" :model="infoFilter" class="filter-form">
        <ElFormItem label="关键字">
          <ElInput
            v-model="infoFilter.keyword"
            placeholder="搜索字典项名称或值"
            clearable
            class="filter-input"
            :disabled="!selectedType"
            @keyup.enter="handleInfoSearch"
          />
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" :icon="Search" :disabled="!selectedType" @click="handleInfoSearch">
            搜索
          </ElButton>
        </ElFormItem>
      </ElForm>

      <div class="table-container">
        <ElTable
          v-loading="infoLoading"
          :data="infoList"
          height="100%"
          style="width: 100%"
          empty-text="暂无字典数据"
        >
          <ElTableColumn prop="name" label="字典项名称" min-width="160" />
          <ElTableColumn prop="value" label="字典项值" min-width="160" />
          <ElTableColumn prop="orderNum" label="排序" width="100" align="center" />
          <ElTableColumn prop="remark" label="备注" min-width="220" show-overflow-tooltip />
          <ElTableColumn prop="createTime" label="创建时间" width="180" />
          <ElTableColumn label="操作" width="150" align="center" fixed="right">
            <template #default="{ row }">
              <ElButton link type="primary" @click="handleEditInfo(row)">编辑</ElButton>
              <ElButton link type="danger" @click="handleDeleteInfo(row)">删除</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <div class="pagination-container">
        <ElPagination
          v-model:current-page="infoPagination.page"
          v-model:page-size="infoPagination.pageSize"
          :total="infoPagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :disabled="!selectedType"
          @size-change="loadInfoList"
          @current-change="loadInfoList"
        />
      </div>
    </ElCard>

    <ElDialog v-model="typeDialogVisible" :title="typeDialogTitle" width="500px" @closed="resetTypeForm">
      <ElForm ref="typeFormRef" :model="typeForm" :rules="typeRules" label-width="100px">
        <ElFormItem label="类型名称" prop="name">
          <ElInput v-model="typeForm.name" placeholder="请输入类型名称" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="类型键" prop="key">
          <ElInput v-model="typeForm.key" placeholder="例如：contract_type" maxlength="100" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="typeDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitLoading" @click="submitType">确定</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="infoDialogVisible" :title="infoDialogTitle" width="560px" @closed="resetInfoForm">
      <ElForm ref="infoFormRef" :model="infoForm" :rules="infoRules" label-width="100px">
        <ElFormItem label="所属类型">
          <ElInput :model-value="selectedType?.name || ''" disabled />
        </ElFormItem>
        <ElFormItem label="字典项名称" prop="name">
          <ElInput v-model="infoForm.name" placeholder="请输入字典项名称" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="字典项值" prop="value">
          <ElInput v-model="infoForm.value" placeholder="请输入字典项值" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="排序">
          <ElInputNumber v-model="infoForm.orderNum" :min="0" :max="9999" style="width: 100%" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="infoForm.remark" type="textarea" :rows="3" placeholder="请输入备注" maxlength="200" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="infoDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitLoading" @click="submitInfo">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Delete, Edit, Plus, Search } from '@element-plus/icons-vue'
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    addDictInfo,
    addDictType,
    deleteDictInfo,
    deleteDictType,
    getDictInfoList,
    getDictTypeList,
    updateDictInfo,
    updateDictType,
    type DictInfoItem,
    type DictTypeItem
  } from '@/api/dict'

  defineOptions({ name: 'DictManagement' })

  const typeFilter = reactive({ keyword: '' })
  const typeLoading = ref(false)
  const typeList = ref<DictTypeItem[]>([])
  const typePagination = reactive({ page: 1, pageSize: 10, total: 0 })
  const selectedTypeId = ref<number>()

  const infoFilter = reactive({ keyword: '' })
  const infoLoading = ref(false)
  const infoList = ref<DictInfoItem[]>([])
  const infoPagination = reactive({ page: 1, pageSize: 10, total: 0 })

  const submitLoading = ref(false)
  const typeDialogVisible = ref(false)
  const infoDialogVisible = ref(false)
  const typeFormRef = ref<FormInstance>()
  const infoFormRef = ref<FormInstance>()

  const typeForm = reactive({
    id: undefined as number | undefined,
    name: '',
    key: ''
  })

  const infoForm = reactive({
    id: undefined as number | undefined,
    name: '',
    value: '',
    orderNum: 0,
    remark: ''
  })

  const selectedType = computed(() => typeList.value.find((item) => item.id === selectedTypeId.value))
  const typeDialogTitle = computed(() => (typeForm.id ? '编辑字典类型' : '新增字典类型'))
  const infoDialogTitle = computed(() => (infoForm.id ? '编辑字典项' : '新增字典项'))

  const typeRules: FormRules = {
    name: [{ required: true, message: '请输入类型名称', trigger: 'blur' }],
    key: [
      { required: true, message: '请输入类型键', trigger: 'blur' },
      { pattern: /^[a-z][a-z0-9_]*$/, message: '类型键需为小写英文、数字或下划线', trigger: 'blur' }
    ]
  }

  const infoRules: FormRules = {
    name: [{ required: true, message: '请输入字典项名称', trigger: 'blur' }],
    value: [{ required: true, message: '请输入字典项值', trigger: 'blur' }]
  }

  async function loadTypeList() {
    typeLoading.value = true
    try {
      const { data } = await getDictTypeList({
        keyword: typeFilter.keyword || undefined,
        page: typePagination.page,
        pageSize: typePagination.pageSize
      })
      typeList.value = data?.list || []
      typePagination.total = data?.pagination?.total || 0
      syncSelectedType()
    } catch {
      ElMessage.error('加载字典类型失败')
    } finally {
      typeLoading.value = false
    }
  }

  function syncSelectedType() {
    if (selectedTypeId.value && typeList.value.some((item) => item.id === selectedTypeId.value)) {
      loadInfoList()
      return
    }
    selectedTypeId.value = typeList.value[0]?.id
    resetInfoQuery()
    if (selectedTypeId.value) {
      loadInfoList()
    } else {
      infoList.value = []
      infoPagination.total = 0
    }
  }

  async function loadInfoList() {
    if (!selectedTypeId.value) return
    infoLoading.value = true
    try {
      const { data } = await getDictInfoList({
        keyword: infoFilter.keyword || undefined,
        typeId: selectedTypeId.value,
        page: infoPagination.page,
        pageSize: infoPagination.pageSize
      })
      infoList.value = data?.list || []
      infoPagination.total = data?.pagination?.total || 0
    } catch {
      ElMessage.error('加载字典项失败')
    } finally {
      infoLoading.value = false
    }
  }

  function handleTypeSearch() {
    typePagination.page = 1
    loadTypeList()
  }

  function handleInfoSearch() {
    infoPagination.page = 1
    loadInfoList()
  }

  function selectType(row: DictTypeItem) {
    selectedTypeId.value = row.id
    resetInfoQuery()
    loadInfoList()
  }

  function handleAddType() {
    typeDialogVisible.value = true
  }

  function handleEditType() {
    if (!selectedType.value) return
    Object.assign(typeForm, {
      id: selectedType.value.id,
      name: selectedType.value.name,
      key: selectedType.value.key
    })
    typeDialogVisible.value = true
  }

  async function handleDeleteType() {
    if (!selectedType.value) return
    try {
      await ElMessageBox.confirm(`确定要删除字典类型"${selectedType.value.name}"及其字典项吗？`, '提示', {
        type: 'warning'
      })
      await deleteDictType(selectedType.value.id)
      ElMessage.success('删除成功')
      selectedTypeId.value = undefined
      loadTypeList()
    } catch (error: any) {
      if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
    }
  }

  async function submitType() {
    try {
      await typeFormRef.value?.validate()
      submitLoading.value = true
      const data = { name: typeForm.name, key: typeForm.key }
      if (typeForm.id) {
        await updateDictType({ id: typeForm.id, ...data })
        selectedTypeId.value = typeForm.id
      } else {
        await addDictType(data)
      }
      ElMessage.success(typeForm.id ? '更新成功' : '新增成功')
      typeDialogVisible.value = false
      loadTypeList()
    } catch (error: any) {
      if (error !== false) ElMessage.error(error.message || '操作失败')
    } finally {
      submitLoading.value = false
    }
  }

  function handleAddInfo() {
    if (!selectedType.value) return
    infoDialogVisible.value = true
  }

  function handleEditInfo(row: any) {
    const item = row as DictInfoItem
    Object.assign(infoForm, {
      id: item.id,
      name: item.name,
      value: item.value,
      orderNum: item.orderNum,
      remark: item.remark || ''
    })
    infoDialogVisible.value = true
  }

  async function handleDeleteInfo(row: any) {
    const item = row as DictInfoItem
    try {
      await ElMessageBox.confirm(`确定要删除字典项"${item.name}"吗？`, '提示', { type: 'warning' })
      await deleteDictInfo(item.id)
      ElMessage.success('删除成功')
      loadInfoList()
    } catch (error: any) {
      if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
    }
  }

  async function submitInfo() {
    if (!selectedTypeId.value) return
    try {
      await infoFormRef.value?.validate()
      submitLoading.value = true
      const data = {
        typeId: selectedTypeId.value,
        name: infoForm.name,
        value: infoForm.value,
        orderNum: infoForm.orderNum,
        remark: infoForm.remark || undefined
      }
      if (infoForm.id) {
        await updateDictInfo({ id: infoForm.id, ...data })
      } else {
        await addDictInfo(data)
      }
      ElMessage.success(infoForm.id ? '更新成功' : '新增成功')
      infoDialogVisible.value = false
      loadInfoList()
    } catch (error: any) {
      if (error !== false) ElMessage.error(error.message || '操作失败')
    } finally {
      submitLoading.value = false
    }
  }

  function resetInfoQuery() {
    infoFilter.keyword = ''
    infoPagination.page = 1
  }

  function resetTypeForm() {
    typeFormRef.value?.resetFields()
    Object.assign(typeForm, { id: undefined, name: '', key: '' })
  }

  function resetInfoForm() {
    infoFormRef.value?.resetFields()
    Object.assign(infoForm, { id: undefined, name: '', value: '', orderNum: 0, remark: '' })
  }

  onMounted(() => loadTypeList())
</script>

<style lang="scss" scoped src="./index.scss"></style>
