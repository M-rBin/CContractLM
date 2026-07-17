<template>
  <div class="contract-agent">
    <!-- 悬浮球 -->
    <div v-if="!panelOpen" class="agent-ball" @click="panelOpen = true">
      <ElIcon :size="24"><ChatDotRound /></ElIcon>
    </div>

    <!-- 对话面板 -->
    <div v-else class="agent-panel">
      <div class="panel-header">
        <div class="panel-title">
          <ElIcon><ChatDotRound /></ElIcon>
          <span>合同智能助手</span>
        </div>
        <div class="panel-actions">
          <ElButton link :icon="Plus" title="新会话" @click="startNewSession" />
          <ElButton link :icon="Close" title="收起" @click="panelOpen = false" />
        </div>
      </div>
      <div ref="bodyRef" class="panel-body">
        <div v-if="!messages.length" class="empty-hint">
          <p>你好，我是合同智能助手。</p>
          <p>可以问我经营数据、识别合同或快速导航，例如：</p>
          <div class="hint-chips">
            <span v-for="s in suggestions" :key="s" class="chip" @click="quickAsk(s)">{{ s }}</span>
          </div>
        </div>

        <div v-for="(msg, idx) in messages" :key="idx" class="msg-row" :class="msg.role">
          <div class="msg-bubble">
            <!-- 用户消息：纯文本 -->
            <template v-if="msg.role === 'user'">{{ msg.text }}</template>

            <!-- 助手消息：按类型渲染 -->
            <template v-else>
              <div v-if="msg.reply?.text" class="msg-text">{{ msg.reply.text }}</div>

              <!-- 表格卡片 -->
              <div v-if="msg.reply?.type === 'table' && msg.reply.table" class="card table-card">
                <ElTable :data="msg.reply.table.rows" size="small" max-height="240" border>
                  <ElTableColumn
                    v-for="col in msg.reply.table.columns"
                    :key="col"
                    :prop="col"
                    :label="col"
                    min-width="100"
                    show-overflow-tooltip
                  />
                </ElTable>
              </div>

              <!-- 导航指令 -->
              <div v-if="msg.reply?.type === 'navigate' && msg.reply.navigate" class="card nav-card">
                <ElButton type="primary" size="small" @click="goNavigate(msg.reply.navigate)">
                  前往{{ msg.reply.navigate.label }}
                </ElButton>
              </div>
            </template>
          </div>
        </div>

        <div v-if="loading" class="msg-row assistant">
          <div class="msg-bubble loading-bubble">
            <span class="dot" /><span class="dot" /><span class="dot" />
          </div>
        </div>
      </div>
      <div class="panel-input">
        <ElInput
          v-model="input"
          type="textarea"
          :rows="2"
          resize="none"
          placeholder="输入问题，Enter 发送，Shift+Enter 换行"
          :disabled="loading"
          @keydown.enter.exact.prevent="send"
        />
        <ElButton type="primary" :loading="loading" :disabled="!input.trim()" @click="send">
          发送
        </ElButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { nextTick, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { ChatDotRound, Close, Plus } from '@element-plus/icons-vue'
  import { agentChat, type AgentReplyContent } from '@/api/contract-agent'

  defineOptions({ name: 'ContractAgent' })

  interface ChatMessage {
    role: 'user' | 'assistant'
    text?: string
    reply?: AgentReplyContent
  }

  const router = useRouter()
  const panelOpen = ref(false)
  const input = ref('')
  const loading = ref(false)
  const messages = ref<ChatMessage[]>([])
  const sessionId = ref<number | undefined>()
  const bodyRef = ref<HTMLElement>()

  const suggestions = ['本月新增多少合同', '有哪些本周到期的合同', '打开合同台账']

  function quickAsk(text: string) {
    input.value = text
    send()
  }

  async function send() {
    const question = input.value.trim()
    if (!question || loading.value) return
    messages.value.push({ role: 'user', text: question })
    input.value = ''
    loading.value = true
    scrollToBottom()
    try {
      const { data } = await agentChat({ sessionId: sessionId.value, question })
      sessionId.value = data.sessionId
      messages.value.push({ role: 'assistant', reply: data.reply })
    } catch (e: any) {
      messages.value.push({
        role: 'assistant',
        reply: { type: 'text', text: e?.message || '抱歉，出错了，请稍后再试。' }
      })
    } finally {
      loading.value = false
      scrollToBottom()
    }
  }

  function goNavigate(nav: { path: string; query?: Record<string, string> }) {
    router.push({ path: nav.path, query: nav.query })
    panelOpen.value = false
  }

  function startNewSession() {
    sessionId.value = undefined
    messages.value = []
    input.value = ''
    ElMessage.success('已开启新会话')
  }

  function scrollToBottom() {
    nextTick(() => {
      if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight
    })
  }
</script>

<style lang="scss" scoped>
  .contract-agent {
    .agent-ball {
      position: fixed;
      right: 28px;
      bottom: 60px;
      z-index: 2000;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: var(--el-color-primary);
      box-shadow: 0 6px 18px rgb(0 0 0 / 20%);
      cursor: pointer;
      transition: transform 0.2s;

      &:hover {
        transform: scale(1.08);
      }
    }

    .agent-panel {
      position: fixed;
      right: 28px;
      bottom: 28px;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      width: 400px;
      height: 560px;
      max-height: calc(100vh - 56px);
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color-light);
      border-radius: 12px;
      box-shadow: 0 8px 30px rgb(0 0 0 / 18%);
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--el-border-color-lighter);

      .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }
    }

    .panel-body {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
    }

    .empty-hint {
      color: var(--el-text-color-secondary);
      font-size: 13px;

      .hint-chips {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .chip {
        padding: 4px 10px;
        border: 1px solid var(--el-border-color);
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          color: var(--el-color-primary);
          border-color: var(--el-color-primary);
        }
      }
    }

    .msg-row {
      display: flex;
      margin-bottom: 14px;

      &.user {
        justify-content: flex-end;

        .msg-bubble {
          background: var(--el-color-primary);
          color: #fff;
        }
      }

      &.assistant .msg-bubble {
        background: var(--el-fill-color-light);
      }
    }

    .msg-bubble {
      max-width: 88%;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.6;
      word-break: break-word;
    }

    .msg-text {
      white-space: pre-wrap;
    }

    .card {
      margin-top: 8px;
    }

    .loading-bubble {
      display: flex;
      gap: 4px;

      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--el-text-color-secondary);
        animation: blink 1.2s infinite both;

        &:nth-child(2) {
          animation-delay: 0.2s;
        }

        &:nth-child(3) {
          animation-delay: 0.4s;
        }
      }
    }

    @keyframes blink {
      0%,
      80%,
      100% {
        opacity: 0.2;
      }

      40% {
        opacity: 1;
      }
    }

    .panel-input {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      padding: 12px 16px;
      border-top: 1px solid var(--el-border-color-lighter);
    }
  }
</style>
