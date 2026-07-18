# 交付计划：企业内部合同管理系统

> 需求文档：docs/01-需求与规划/20260712-企业内部合同管理系统-SRS需求规格说明书-V1.0.md
> 创建时间：2026-07-12
> 最后更新：2026-07-12

## 总进度

| 范围 | 总数 | 已完成 | 进行中 | 待实现 |
|------|------|-------|-------|-------|
| 系统设置模块联调 | 9 | 9 | 0 | 0 |
| 合同业务模块联调 | 6 | 1 | 0 | 5 |
| 测试与上线 | 15 | 0 | 0 | 15 |

> 说明：当前已关闭 Mock（`VITE_USE_MOCK=false`，`VITE_ACCESS_MODE=backend`），系统设置模块按真实 API 联调。用户/部门/岗位/角色/菜单、字典管理、操作日志、用户导入导出、批量设置岗位/角色均已完成前后端实现与构建验证。

> 最新同步：已补齐 API 模式下“合同管理 > 合同台账”和“系统配置 > 字典管理/操作日志”的后端菜单增量同步与前端动态路由入口；并新增合同模块 10 类业务字典的种子同步。当前开发库若尚未出现菜单或字典，需启动本地 MySQL/后端后由启动钩子同步，再重新登录刷新权限菜单。

## Phase 1: 前端页面（API 模式）

### 已实现模块（对齐验收，不计入待实现）

| ID | 功能模块 | 终端 | 技能 | 状态 | 依赖 | 备注 |
|----|---------|------|------|------|------|------|
| F01 | 用户管理（组织管理） | PC | page-generator | ✅ | - | 已实现，对齐验收（organization/user/index.vue，617行） |
| F02 | 部门管理（组织管理） | PC | page-generator | ✅ | - | 已实现，对齐验收（organization/department/index.vue，360行） |
| F03 | 岗位管理（组织管理） | PC | page-generator | ✅ | - | 已实现，对齐验收（organization/position/index.vue，204行） |
| F04 | 角色管理（权限管理） | PC | page-generator | ✅ | - | 已实现，对齐验收（permission/role/index.vue，445行） |
| F05 | 菜单管理（权限管理） | PC | page-generator | ✅ | - | 已实现，对齐验收（permission/menu/index.vue，436行） |

### 待实现模块（本期交付重点）

| ID | 功能模块 | 终端 | 技能 | 状态 | 依赖 | 备注 |
|----|---------|------|------|------|------|------|
| F06 | 字典管理前端（字典类型+字典项） | PC | page-generator | ✅ | - | 已实现（2026-07-12），新增字典 API、字典管理页面、系统配置路由并接入真实接口 |
| F07 | 操作日志前端 | PC | page-generator | ✅ | - | 已实现（2026-07-12），新增操作日志 API、只读查询页并挂载系统配置菜单 |
| F08 | 用户导入/导出功能 | PC | page-generator | ✅ | F01 | 已接入真实接口，支持 Excel 解析导入与 CSV 导出下载 |
| F09 | 用户批量设置岗位/批量设置角色功能 | PC | page-generator | ✅ | F01,F03,F04 | 已接入真实接口，支持批量设置岗位与批量覆盖角色 |

## Phase 2: 后端开发

> 由 backend-generator 技能驱动。为 Phase 1 中**需要真实接口**的功能各生成一个后端任务。
> 分层与依赖沿用对应前端功能（数据依赖关系一致）；纯前端展示类（无数据持久化）不生成后端任务。本模块 9 个前端功能均涉及数据持久化，故后端任务数与前端一致。

### 已实现接口（对齐验收）

| ID | 功能模块 | 技能 | 状态 | 依赖 | 对应前端 | 备注 |
|----|---------|------|------|------|---------|------|
| B01 | 用户管理接口 | backend-generator | ✅ | - | F01 | 已实现（admin/sys/user，CrudControllerFactory） |
| B02 | 部门管理接口 | backend-generator | ✅ | - | F02 | 已实现（admin/sys/department） |
| B03 | 岗位管理接口 | backend-generator | ✅ | - | F03 | 已实现（admin/sys/position） |
| B04 | 角色管理接口 | backend-generator | ✅ | - | F04 | 已实现（admin/sys/role） |
| B05 | 菜单管理接口 | backend-generator | ✅ | - | F05 | 已实现（admin/sys/menu） |
| B06 | 字典管理接口 | backend-generator | ✅ | - | F06 | 已实现（admin/dict/type、admin/dict/info），前端已接入 |
| B07 | 操作日志接口 | backend-generator | ✅ | - | F07 | 已实现（admin/sys/log），前端已接入分页查询 |

### 已实现接口（本次补齐）

| ID | 功能模块 | 技能 | 状态 | 依赖 | 对应前端 | 备注 |
|----|---------|------|------|------|---------|------|
| B08 | 用户导入/导出接口 | backend-generator | ✅ | B01 | F08 | 已新增 admin/sys/user/import 与 admin/sys/user/export |
| B09 | 用户批量设置岗位/角色接口 | backend-generator | ✅ | B01,B03,B04 | F09 | 已新增 admin/sys/user/batch-set-position 与 admin/sys/user/batch-set-roles |

## Phase 3: 前后端联调

| ID | 联调项 | 状态 | 关联功能 | 备注 |
|----|-------|------|---------|------|
| L01 | 用户管理基础 CRUD 联调 | ✅ | F01 / B01 | 用户列表、新增、编辑、删除、状态切换使用真实接口 |
| L02 | 用户导入/导出联调 | ✅ | F08 / B08 | 用户导入提交结构化行数据，导出下载 CSV 文件 |
| L03 | 用户批量设置岗位/角色联调 | ✅ | F09 / B09 | 前端使用真实岗位/角色列表，后端批量更新用户岗位与角色关联 |
| L04 | 部门管理联调 | ✅ | F02 / B02 | 已专项验收（2026-07-12），前端部门树、新增、编辑、删除、排序字段已对齐真实接口 |
| L05 | 岗位管理联调 | ✅ | F03 / B03 | 已专项验收（2026-07-12），岗位列表、新增、编辑、删除、排序字段已对齐真实接口 |
| L06 | 角色管理联调 | ✅ | F04 / B04 | 已专项验收（2026-07-12），角色 CRUD、状态筛选、菜单权限分配已对齐真实接口，后端支持清空角色菜单权限 |
| L07 | 菜单管理联调 | ✅ | F05 / B05 | 已专项验收（2026-07-12），菜单树、CRUD、显示/隐藏已对齐真实接口，显示状态改为提交 isShow 字段 |
| L08 | 字典管理联调 | ✅ | F06 / B06 | 字典类型与字典项已接入 admin/dict/type、admin/dict/info 真实接口 |
| L09 | 操作日志联调 | ✅ | F07 / B07 | 操作日志查询页已接入 admin/sys/log/list 真实接口 |

## 合同业务模块联调

| ID | 联调项 | 状态 | 关联功能 | 备注 |
|----|-------|------|---------|------|
| C01 | 合同台账联调 | ✅ | 合同管理 / 合同台账 | 已新增 `contract_info` 模型、`admin/contract/info` 后端接口、`admin/src/api/contract.ts` 和 `admin/src/views/contract/ledger/index.vue`，支持筛选、分页、新增、编辑、删除、导出 |
| C02 | 合同详情联调 | ⬜ | 合同详情 / 基础信息 | 待实现合同详情页，并承接合同台账查看入口 |
| C03 | 合同附件联调 | ⬜ | 合同详情 / 附件归档 | 待实现附件上传、下载、删除与文件元数据接口 |
| C04 | 履约节点联调 | ⬜ | 合同详情 / 履约节点、履约提醒 | 待实现履约节点 CRUD、标记完成和提醒视图 |
| C05 | 收付款管理联调 | ⬜ | 合同详情 / 收付款计划、收付款管理 | 待实现收付款计划 CRUD、登记实际收付款和集中列表 |
| C06 | 工作台与经营分析联调 | ⬜ | 工作台 / 经营分析 | 待基于合同、节点、收付款数据实现指标和图表 |

## Phase 4: 测试与上线

> 测试用例文档已生成：`docs/20260712-企业内部合同管理系统-系统设置模块测试用例-V1.0.md`。Phase 4 统计仅记录测试执行完成情况，生成用例不计入已完成模块。

| ID | 测试项 | 状态 | 关联功能 | 备注 |
|----|-------|------|---------|------|
| T01 | 用户管理验收测试 | ⬜ | F01 / B01 / L01 | 执行用户列表、新增、编辑、删除、批量删除、启停、权限测试 |
| T02 | 部门管理验收测试 | ⬜ | F02 / B02 / L04 | 执行部门树、新增下级、编辑、删除、父级排除测试 |
| T03 | 岗位管理验收测试 | ⬜ | F03 / B03 / L05 | 执行岗位列表、新增、编辑、删除、关联删除测试 |
| T04 | 角色管理验收测试 | ⬜ | F04 / B04 / L06 | 执行角色 CRUD、状态筛选、菜单权限分配测试 |
| T05 | 菜单管理验收测试 | ⬜ | F05 / B05 / L07 | 执行菜单树、类型联动、显示隐藏、删除关联测试 |
| T06 | 字典管理验收测试 | ⬜ | F06 / B06 / L08 | 执行字典类型、字典项 CRUD 与唯一性测试 |
| T07 | 操作日志验收测试 | ⬜ | F07 / B07 / L09 | 执行日志查询、详情、只读约束、权限测试 |
| T08 | 用户导入/导出验收测试 | ⬜ | F08 / B08 / L02 | 执行 Excel 导入、CSV 导出、异常文件测试 |
| T09 | 用户批量设置验收测试 | ⬜ | F09 / B09 / L03 | 执行批量设置岗位、批量设置角色与异常测试 |

---

## 当前推荐

**下一步**：C02 合同详情联调（合同台账已完成，详情页是附件、履约节点、收付款计划的入口）
**执行命令**：`继续完成合同详情联调`

**次优先**：C03 合同附件联调

---

## 核实说明

已通过 Glob/Grep 核对以下事实：
- `admin/src/views/organization/{user,department,position}/index.vue` 与 `admin/src/views/permission/{role,menu}/index.vue` 均存在且已实现
- `admin/src/views/dict/index.vue`、`admin/src/api/dict.ts` 与 `admin/src/router/modules/dict-template.ts` 已新增，确认字典管理前端已实现
- `admin/src/views/log/index.vue` 与 `admin/src/api/log.ts` 已新增，确认操作日志前端已实现
- 已补齐 API 模式菜单链路：`server/src/common/seed.service.ts` 会增量同步“系统配置 > 字典管理/操作日志”，`admin/src/views/system/{dict,log}/index.vue` 提供动态路由入口
- 已补齐合同台账真实 API 链路：`server/src/modules/contract/`、`admin/src/api/contract.ts`、`admin/src/views/contract/ledger/index.vue` 已新增，并通过 `server npm run build`、`admin npm run build`
- 已补齐合同模块业务字典入库链路：`server/src/common/seed.service.ts` 会增量同步合同类型、合同状态、合同币种、附件分类、履约节点状态、收付款方向、收付款计划状态、提醒类型、逾期状态、处理状态 10 类字典到字典管理
- `server/src/modules/dict/` 下 `dict-type.controller.ts`、`dict-info.controller.ts` 已存在；`server/src/modules/base/controllers/log.controller.ts` 已存在，确认字典、日志后端接口已实现；字典与日志前端已接入真实接口
- `admin/src/views/organization/user/index.vue` 中用户导入/导出、批量设置岗位/角色已接入真实接口，原预留提示已移除
- 已处理全局前端构建门禁：补齐 `admin/src/api/waybill.ts` 后，`admin npm run build` 与 `server npm run build` 均通过
