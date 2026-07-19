<template>
  <div class="login-page">
    <div class="login-card">
      <!-- 左侧品牌区 -->
      <div class="brand-panel">
        <div class="brand-logo">
          <el-icon :size="48" color="#ffffff">
            <Grid />
          </el-icon>
        </div>
        <h2 class="brand-name">{{ systemName }}</h2>
        <p class="brand-desc">产研一体化平台</p>
        <div class="brand-circles">
          <div class="circle circle-1"></div>
          <div class="circle circle-2"></div>
        </div>
      </div>

      <!-- 右侧表单区 -->
      <div class="form-panel">
        <h3 class="form-title">{{ $t('login.title') }}</h3>
        <p class="form-subtitle">{{ $t('login.subTitle') }}</p>

        <ElForm
          ref="formRef"
          :model="formData"
          :rules="rules"
          :key="formKey"
          @keyup.enter="handleSubmit"
          class="login-form"
        >
          <ElFormItem prop="username">
            <ElInput
              :placeholder="$t('login.placeholder.username')"
              v-model.trim="formData.username"
              :prefix-icon="User"
              @blur="handleUsernameBlur"
            />
          </ElFormItem>
          <ElFormItem prop="password">
            <ElInput
              :placeholder="$t('login.placeholder.password')"
              v-model.trim="formData.password"
              type="password"
              autocomplete="off"
              show-password
              :prefix-icon="Lock"
            />
          </ElFormItem>

          <!-- 多公司选择器：仅在有多个可选公司时显示 -->
          <ElFormItem v-if="tenantList.length > 0" prop="tenantId">
            <ElSelect
              v-model="formData.tenantId"
              :placeholder="tenantList.length === 1 ? tenantList[0].name : '请选择登录公司'"
              :disabled="tenantList.length === 1"
              style="width: 100%"
            >
              <ElOption
                v-for="item in tenantList"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>

          <div class="form-options">
            <ElCheckbox v-model="formData.rememberPassword">{{
              $t('login.rememberPwd')
            }}</ElCheckbox>
          </div>

          <ElButton class="login-btn" type="primary" @click="handleSubmit" :loading="loading">
            {{ $t('login.btnText') }}
          </ElButton>

          <p v-if="isDev" class="default-account">默认账号：admin / 123456</p>
        </ElForm>
      </div>
    </div>

    <p class="copyright">© 2026 企业合同管理系统 All Rights Reserved</p>
  </div>
</template>

<script setup lang="ts">
  import AppConfig from '@/config'
  import { useUserStore } from '@/store/modules/user'
  import { useI18n } from 'vue-i18n'
  import { fetchLogin, fetchGetUserInfo, fetchTenantList } from '@/api/auth'
  import { ElNotification, ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { User, Lock, Grid } from '@element-plus/icons-vue'

  defineOptions({ name: 'Login' })

  const { t, locale } = useI18n()
  const formKey = ref(0)

  watch(locale, () => {
    formKey.value++
  })

  const userStore = useUserStore()
  const router = useRouter()

  const systemName = AppConfig.systemInfo.name
  const formRef = ref<FormInstance>()

  const tenantList = ref<Api.Auth.TenantItem[]>([])

  const formData = reactive({
    username: import.meta.env.DEV ? 'admin' : '',
    password: import.meta.env.DEV ? '123456' : '',
    rememberPassword: true,
    tenantId: undefined as number | undefined
  })

  const rules = computed<FormRules>(() => ({
    username: [{ required: true, message: t('login.placeholder.username'), trigger: 'blur' }],
    password: [{ required: true, message: t('login.placeholder.password'), trigger: 'blur' }],
    tenantId: [
      {
        required: tenantList.value.length > 1,
        message: '请选择登录公司',
        trigger: 'change'
      }
    ]
  }))

  const loading = ref(false)
  const isDev = import.meta.env.DEV

  // 用户名失焦时拉取可登录公司列表（admin 跳过）
  const handleUsernameBlur = async () => {
    const username = formData.username.trim()
    if (!username || username === 'admin') {
      tenantList.value = []
      formData.tenantId = undefined
      return
    }
    try {
      const { data } = await fetchTenantList(username)
      tenantList.value = data ?? []
      // 单公司自动选中并置为只读
      if (tenantList.value.length === 1) {
        formData.tenantId = tenantList.value[0].id
      } else {
        formData.tenantId = undefined
      }
    } catch {
      tenantList.value = []
      ElMessage.warning('获取公司列表失败，请重新输入用户名后重试')
    }
  }

  // 登录
  const handleSubmit = async () => {
    if (!formRef.value) return

    try {
      loading.value = true

      // 非 admin 用户：若公司列表未加载（用户跳过了用户名 blur），先拉取一次
      if (formData.username && formData.username !== 'admin' && tenantList.value.length === 0) {
        await handleUsernameBlur()
        // 加载后若仍无公司列表，说明用户无归属公司，阻止登录
        if (tenantList.value.length === 0) {
          ElMessage.error('该账号暂无关联公司，请联系管理员')
          return
        }
      }

      const valid = await formRef.value.validate()
      if (!valid) return

      const { username, password, tenantId } = formData

      const { data } = await fetchLogin({ username, password, tenantId })

      const { token, refreshToken } = data

      if (!token) {
        throw new Error('登录失败 - 未收到 token')
      }

      userStore.setToken(token, refreshToken)
      if (tenantId !== undefined) {
        userStore.setTenantId(tenantId)
      }

      const { data: userInfo } = await fetchGetUserInfo()
      userStore.setUserInfo(userInfo)
      userStore.setLoginStatus(true)

      showLoginSuccessNotice()
      router.push('/')
    } catch {
      // HttpError 由 http 工具统一处理提示，此处无需额外操作
    } finally {
      loading.value = false
    }
  }

  const showLoginSuccessNotice = () => {
    setTimeout(() => {
      ElNotification({
        title: t('login.success.title'),
        type: 'success',
        duration: 2500,
        zIndex: 10000,
        message: `${t('login.success.message')}, ${systemName}!`
      })
    }, 150)
  }
</script>

<style lang="scss" scoped>
  @use './index';
</style>
