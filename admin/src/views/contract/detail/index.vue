<template>
  <div class="contract-detail">
    <ElCard shadow="never" class="summary-card">
      <div class="summary-header">
        <div>
          <h2>{{ detail?.name || '合同详情' }}</h2>
          <p>{{ detail?.code || '-' }}</p>
        </div>
        <ElButton @click="router.back()">返回</ElButton>
      </div>
      <ElDescriptions v-if="detail" :column="4" border>
        <ElDescriptionsItem label="合同类型">{{ detail.type }}</ElDescriptionsItem>
        <ElDescriptionsItem label="合同状态">{{ detail.status }}</ElDescriptionsItem>
        <ElDescriptionsItem label="相对方">{{ detail.counterparty }}</ElDescriptionsItem>
        <ElDescriptionsItem label="负责人">{{ detail.ownerName || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="合同金额">{{ amountText(detail.amount) }} {{ detail.currency }}</ElDescriptionsItem>
        <ElDescriptionsItem label="签订日期">{{ dateText(detail.signDate) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="生效日期">{{ dateText(detail.effectiveDate) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="到期日期">{{ dateText(detail.expireDate) }}</ElDescriptionsItem>
      </ElDescriptions>
    </ElCard>

    <ElCard shadow="never" class="content-card">
      <ElTabs v-model="activeTab">
        <ElTabPane label="履约节点" name="milestones">
          <div class="toolbar">
            <ElButton type="primary" :icon="Plus" @click="openMilestone()">新增节点</ElButton>
          </div>
          <ElTable :data="detail?.milestones || []">
            <ElTableColumn prop="name" label="节点名称" min-width="160" />
            <ElTableColumn prop="planDate" label="计划日期" width="120">
              <template #default="{ row }">{{ dateText(row.planDate) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="ownerName" label="负责人" width="120" />
            <ElTableColumn label="状态" width="100">
              <template #default="{ row }"><ElTag :type="pendingTag(row.status)">{{ row.status }}</ElTag></template>
            </ElTableColumn>
            <ElTableColumn prop="remark" label="说明" min-width="180" show-overflow-tooltip />
            <ElTableColumn label="操作" width="210" align="center">
              <template #default="{ row }">
                <ElButton link type="primary" @click="openMilestone(row)">编辑</ElButton>
                <ElButton v-if="row.status !== '已完成'" link type="success" @click="openComplete(row)">完成</ElButton>
                <ElButton link type="danger" @click="removeMilestone(row)">删除</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>

        <ElTabPane label="收付款计划" name="payments">
          <div class="toolbar">
            <ElButton type="primary" :icon="Plus" @click="openPayment()">新增计划</ElButton>
          </div>
          <ElTable :data="detail?.payments || []">
            <ElTableColumn prop="direction" label="方向" width="90" />
            <ElTableColumn label="计划金额" width="130" align="right">
              <template #default="{ row }">{{ amountText(row.planAmount) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="planDate" label="计划日期" width="120">
              <template #default="{ row }">{{ dateText(row.planDate) }}</template>
            </ElTableColumn>
            <ElTableColumn label="实际金额" width="130" align="right">
              <template #default="{ row }">{{ row.actualAmount ? amountText(row.actualAmount) : '-' }}</template>
            </ElTableColumn>
            <ElTableColumn label="剩余金额" width="130" align="right">
              <template #default="{ row }">{{ row.status === '已完成' ? '-' : amountText(row.remainingAmount ?? row.planAmount) }}</template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="100">
              <template #default="{ row }"><ElTag :type="pendingTag(row.status)">{{ row.status }}</ElTag></template>
            </ElTableColumn>
            <ElTableColumn prop="remark" label="备注" min-width="180" show-overflow-tooltip />
            <ElTableColumn label="操作" width="220" align="center">
              <template #default="{ row }">
                <ElButton link type="primary" @click="openPayment(row)">编辑</ElButton>
                <ElButton v-if="canRegister(row)" link type="success" @click="openRegister(row)">登记</ElButton>
                <ElButton link type="danger" @click="removePayment(row)">删除</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>

        <ElTabPane label="操作记录" name="records">
          <ElTable :data="detail?.operRecords || []">
            <ElTableColumn prop="operType" label="操作类型" width="130" />
            <ElTableColumn prop="operTarget" label="操作对象" min-width="160" />
            <ElTableColumn prop="operatorName" label="操作人" width="120" />
            <ElTableColumn prop="createTime" label="操作时间" width="170" />
          </ElTable>
        </ElTabPane>

        <ElTabPane label="附件归档" name="attachments">
          <div class="toolbar">
            <ElSelect v-model="attachmentCategory" placeholder="附件分类" class="toolbar-select">
              <ElOption v-for="item in CONTRACT_ATTACHMENT_CATEGORIES" :key="item" :label="item" :value="item" />
            </ElSelect>
            <ElUpload :show-file-list="false" :http-request="uploadFile">
              <ElButton type="primary" :icon="Upload">上传附件</ElButton>
            </ElUpload>
          </div>
          <ElTable :data="detail?.attachments || []">
            <ElTableColumn prop="category" label="分类" width="120" />
            <ElTableColumn prop="fileName" label="文件名称" min-width="220" show-overflow-tooltip />
            <ElTableColumn label="文件大小" width="120">
              <template #default="{ row }">{{ fileSizeText(row.fileSize) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="createTime" label="上传时间" width="170" />
            <ElTableColumn label="操作" width="150" align="center">
              <template #default="{ row }">
                <ElButton link type="primary" @click="downloadFile(row)">下载</ElButton>
                <ElButton link type="danger" @click="removeAttachment(row)">删除</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <ElDialog v-model="milestoneDialog" :title="milestoneForm.id ? '编辑履约节点' : '新增履约节点'" width="520px">
      <ElForm :model="milestoneForm" label-width="100px">
        <ElFormItem label="节点名称" required><ElInput v-model="milestoneForm.name" maxlength="50" /></ElFormItem>
        <ElFormItem label="计划日期" required><ElDatePicker v-model="milestoneForm.planDate" value-format="YYYY-MM-DD" type="date" /></ElFormItem>
        <ElFormItem label="负责人"><ElInput v-model="milestoneForm.ownerName" maxlength="50" /></ElFormItem>
        <ElFormItem label="说明"><ElInput v-model="milestoneForm.remark" type="textarea" maxlength="200" /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="milestoneDialog = false">取消</ElButton>
        <ElButton type="primary" @click="saveMilestone">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="completeDialog" title="标记完成" width="460px">
      <ElForm :model="completeForm" label-width="100px">
        <ElFormItem label="完成日期" required><ElDatePicker v-model="completeForm.actualDate" value-format="YYYY-MM-DD" type="date" /></ElFormItem>
        <ElFormItem label="完成说明"><ElInput v-model="completeForm.completeRemark" type="textarea" maxlength="200" /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="completeDialog = false">取消</ElButton>
        <ElButton type="primary" @click="saveComplete">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="paymentDialog" :title="paymentForm.id ? '编辑收付款计划' : '新增收付款计划'" width="520px">
      <ElForm :model="paymentForm" label-width="100px">
        <ElFormItem label="方向" required>
          <ElSelect v-model="paymentForm.direction">
            <ElOption v-for="item in CONTRACT_PAYMENT_DIRECTIONS" :key="item" :label="item" :value="item" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="计划金额" required>
          <ElInputNumber v-model="paymentForm.planAmount" :min="0" :precision="2" />
          <span class="available-hint">可用金额：{{ amountText(availableAmount) }}</span>
        </ElFormItem>
        <ElFormItem label="计划日期" required><ElDatePicker v-model="paymentForm.planDate" value-format="YYYY-MM-DD" type="date" /></ElFormItem>
        <ElFormItem label="备注"><ElInput v-model="paymentForm.remark" type="textarea" maxlength="200" /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="paymentDialog = false">取消</ElButton>
        <ElButton type="primary" @click="savePayment">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="registerDialog" title="登记实际收付款" width="460px">
      <ElForm :model="registerForm" label-width="100px">
        <ElFormItem label="实际金额" required><ElInputNumber v-model="registerForm.actualAmount" :min="0" :max="registerForm.maxAmount" :precision="2" /><span class="register-hint">可登记上限：{{ amountText(registerForm.maxAmount) }}</span></ElFormItem>
        <ElFormItem label="实际日期" required><ElDatePicker v-model="registerForm.actualDate" value-format="YYYY-MM-DD" type="date" /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="registerDialog = false">取消</ElButton>
        <ElButton type="primary" @click="saveRegister">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus, Upload } from '@element-plus/icons-vue'
  import { saveAs } from 'file-saver'
  import {
    CONTRACT_ATTACHMENT_CATEGORIES,
    CONTRACT_PAYMENT_DIRECTIONS,
    addContractMilestone,
    addContractPayment,
    completeContractMilestone,
    deleteContractAttachment,
    deleteContractMilestone,
    deleteContractPayment,
    downloadContractAttachment,
    getContractDetail,
    registerContractPayment,
    updateContractMilestone,
    updateContractPayment,
    uploadContractAttachment,
    type ContractDetailData,
    type ContractPaymentPlan
  } from '@/api/contract'

  defineOptions({ name: 'ContractDetail' })

  const route = useRoute()
  const router = useRouter()
  const contractId = Number(route.query.id)
  const detail = ref<ContractDetailData>()
  const activeTab = ref('milestones')
  const attachmentCategory = ref('合同正文')
  const milestoneDialog = ref(false)
  const completeDialog = ref(false)
  const paymentDialog = ref(false)
  const registerDialog = ref(false)
  const milestoneForm = reactive({ id: 0, name: '', planDate: '', ownerName: '', remark: '' })
  const completeForm = reactive({ id: 0, actualDate: '', completeRemark: '' })
  const paymentForm = reactive({ id: 0, direction: '收款', planAmount: 0, planDate: '', remark: '' })
  const registerForm = reactive({ id: 0, actualAmount: 0, actualDate: '', maxAmount: 0 })

  async function loadDetail() {
    if (!contractId) return
    const { data } = await getContractDetail(contractId)
    detail.value = data
  }

  async function uploadFile(option: any) {
    const form = new FormData()
    form.append('contractId', String(contractId))
    form.append('category', attachmentCategory.value)
    form.append('file', option.file)
    await uploadContractAttachment(form)
    ElMessage.success('新增成功')
    loadDetail()
  }

  async function downloadFile(row: any) {
    const data = await downloadContractAttachment(row.id)
    saveAs(data instanceof Blob ? data : new Blob([data]), row.fileName)
  }

  async function removeAttachment(row: any) {
    await ElMessageBox.confirm(`确认删除附件"${row.fileName}"吗？`, '提示', { type: 'warning' })
    await deleteContractAttachment(row.id)
    ElMessage.success('删除成功')
    loadDetail()
  }

  function openMilestone(row?: any) {
    Object.assign(milestoneForm, row ? { ...row, planDate: dateText(row.planDate) } : { id: 0, name: '', planDate: '', ownerName: '', remark: '' })
    milestoneDialog.value = true
  }

  async function saveMilestone() {
    const payload = { contractId, name: milestoneForm.name, planDate: milestoneForm.planDate, ownerName: milestoneForm.ownerName, remark: milestoneForm.remark }
    if (milestoneForm.id) await updateContractMilestone({ id: milestoneForm.id, ...payload })
    else await addContractMilestone(payload)
    ElMessage.success('保存成功')
    milestoneDialog.value = false
    loadDetail()
  }

  function openComplete(row: any) {
    Object.assign(completeForm, { id: row.id, actualDate: dateText(new Date().toISOString()), completeRemark: '' })
    completeDialog.value = true
  }

  async function saveComplete() {
    await completeContractMilestone(completeForm)
    ElMessage.success('保存成功')
    completeDialog.value = false
    loadDetail()
  }

  async function removeMilestone(row: any) {
    await ElMessageBox.confirm(`确认删除节点"${row.name}"吗？`, '提示', { type: 'warning' })
    await deleteContractMilestone(row.id)
    ElMessage.success('删除成功')
    loadDetail()
  }

  // 可用金额 = 合同金额 - 同方向下其他计划金额之和（编辑时排除自身），收款/付款额度互不影响
  const availableAmount = computed(() => {
    const contractAmount = Number(detail.value?.amount || 0)
    const usedAmount = (detail.value?.payments || [])
      .filter((item) => item.direction === paymentForm.direction && item.id !== paymentForm.id)
      .reduce((total, item) => total + Number(item.planAmount), 0)
    return Math.max(contractAmount - usedAmount, 0)
  })

  function openPayment(row?: any) {
    Object.assign(paymentForm, row ? { ...row, planAmount: Number(row.planAmount), planDate: dateText(row.planDate) } : { id: 0, direction: '收款', planAmount: 0, planDate: '', remark: '' })
    paymentDialog.value = true
  }

  async function savePayment() {
    if (paymentForm.planAmount > availableAmount.value) {
      ElMessage.warning(`计划金额不能超过可用金额 ${amountText(availableAmount.value)}`)
      return
    }
    const payload = { contractId, direction: paymentForm.direction, planAmount: paymentForm.planAmount, planDate: paymentForm.planDate, remark: paymentForm.remark }
    if (paymentForm.id) await updateContractPayment({ id: paymentForm.id, ...payload })
    else await addContractPayment(payload)
    ElMessage.success('保存成功')
    paymentDialog.value = false
    loadDetail()
  }

  function canRegister(row: ContractPaymentPlan | any): boolean {
    return (row.remainingAmount != null ? Number(row.remainingAmount) : (row.status !== '已完成' ? Number(row.planAmount || 0) : 0)) > 0
  }

  function openRegister(row: any) {
    const remaining = row.remainingAmount != null
      ? Number(row.remainingAmount)
      : (row.status !== '已完成' ? Number(row.planAmount || 0) : 0)
    Object.assign(registerForm, { id: row.id, actualAmount: 0, actualDate: dateText(new Date().toISOString()), maxAmount: remaining })
    registerDialog.value = true
  }

  async function saveRegister() {
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
      await registerContractPayment(payload)
      ElMessage.success('保存成功')
      registerDialog.value = false
      loadDetail()
    } catch {
      ElMessage.error('保存失败，请重试')
    }
  }

  async function removePayment(row: any) {
    await ElMessageBox.confirm('确认删除该收付款计划吗？', '提示', { type: 'warning' })
    await deleteContractPayment(row.id)
    ElMessage.success('删除成功')
    loadDetail()
  }

  function dateText(value?: string) {
    return value ? String(value).slice(0, 10) : ''
  }

  function amountText(value: string | number | null | undefined) {
    const num = Number(value)
    return (isNaN(num) ? 0 : num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function fileSizeText(size: number) {
    return size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : `${(size / 1024).toFixed(1)} KB`
  }

  function pendingTag(status: string) {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = { 已完成: 'success', 逾期: 'danger', 待处理: 'warning' }
    return map[status] || 'info'
  }

  onMounted(loadDetail)
</script>

<style scoped lang="scss">
  .contract-detail {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .summary-card,
    .content-card {
      border: none !important;
      border-radius: 8px;
      box-shadow: none !important;
    }

    .summary-header,
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }

    h2 {
      margin: 0 0 6px;
      font-size: 20px;
      font-weight: 600;
    }

    p {
      margin: 0;
      color: #7a8499;
    }

    .toolbar-select {
      width: 180px;
    }

    .available-hint {
      margin-left: 12px;
      color: #7a8499;
      font-size: 13px;
    }

    .register-hint {
      margin-left: 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
