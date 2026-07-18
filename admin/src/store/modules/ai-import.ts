import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * AI 智能录入临时状态
 *
 * 用于在识别页（ai-import）和登记表单（ledger）之间传递无法放入
 * history.state 的富对象（如 File）。合同保存后调用 clear() 释放。
 */
export const useAiImportStore = defineStore('ai-import', () => {
  /** 待归档的原始合同 PDF（识别时上传的文件） */
  const pendingFile = ref<File | null>(null)

  function setPendingFile(file: File | null) {
    pendingFile.value = file
  }

  function clear() {
    pendingFile.value = null
  }

  return { pendingFile, setPendingFile, clear }
})
