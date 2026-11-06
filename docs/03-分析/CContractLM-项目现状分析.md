# CContractLM 项目现状分析

| 项 | 内容 |
|----|------|
| 分析日期 | 2026-11-06 |
| 基线提交 | `cf75d02`（`main`，2026-07-20「更新合同默认状态」） |
| 范围 | 静态阅读代码、Prisma、Docker、CI 与 `docs/`。未启动数据库，未做联调 |
| 边界 | 只描述现状。业务代码未改。文中不出现密钥、口令、连接串的明文 |

仓库同时装着两套东西：一套是企业内部合同管理产品，一套是 agentPM / SDAD 规格驱动交付脚手架。下文先讲产品，再单独标出脚手架，避免把框架残留当成业务能力。

---

## 1. 产品定位与目标用户

**一句话：** CContractLM 是给企业内部使用的合同台账与履约跟进系统，让业务、财务、法务和系统管理员在签署之后集中登记合同、归档附件、跟踪节点和收付款，并用站内提醒、经营分析和合同 PDF 智能识别减少线下表格与人工催办。

设计方案（`docs/01-需求与规划/2026-07-12-企业内部合同管理系统-设计方案-v1.0.md`）写明第一版不做线上审批、在线编辑、电子签章和财务系统对接。代码已经超出这份边界：加入了多公司/多帐套，以及合同智能识别和智能助手。这两块没有对应的需求或设计文档。

目标用户（来自设计方案与种子角色，不是独立的用户研究）：

| 角色（种子 `label`） | 代码中的权限取向 |
|----------------------|------------------|
| 超级管理员（用户名 `admin`） | 鉴权与数据范围的硬编码旁路，不按公司过滤 |
| 合同管理员 `contract_admin` | 合同全功能，含智能识别 |
| 法务 `legal` | 台账/详情/工作台/提醒/分析只读，可导出 |
| 财务 `finance` | 台账只读 + 收付款管理 |
| 部门经理 `dept_manager` | 与合同管理员同级的合同操作权限（文案写「本部门」，查询并未按部门过滤） |
| 普通员工 `employee` | 工作台、台账、详情、提醒、操作记录只读，无新增合同权限 |

---

## 2. 技术栈与运行拓扑

### 2.1 技术栈

| 层 | 实现 | 包名 / 入口 |
|----|------|-------------|
| 管理端 | Vue 3.5、Vite 7、TypeScript 5.6、Element Plus 2.11、Pinia 3、Vue Router 4、Axios、ECharts | `admin/`，包名 `axuremart-ai-web`，Node ≥ 20.19 |
| 服务端 | NestJS 11、Prisma 6、class-validator、Swagger（非生产）、`@nestjs/schedule` | `server/`，包名 `agentpm-server`，Node ≥ 20 |
| 数据库 | MySQL 8.0 | Prisma `provider = "mysql"`，库名默认 `CContractLM` |
| 缓存 | Redis 7 | `ioredis`。登录 token、密码版本、权限列表 |
| 鉴权 | JWT（`@nestjs/jwt` + Passport 依赖已装）+ Redis 比对 + 密码版本 `passwordV` | 全局 `AuthGuard`、`PermsGuard` |
| 对象存储 | 无。附件落在进程工作目录 `uploads/` | 生产用 Docker volume `backend_uploads` |
| AI | 自研适配层，OpenAI 兼容与 Anthropic 两套 HTTP | 配置存表 `ai_config`，密钥 AES-256-GCM |

前端菜单在未设置 `VITE_ACCESS_MODE=frontend` 时走后端下发（该变量未写入 `.env`，默认即后端菜单）。`VITE_USE_MOCK` 未设置时 Mock 关闭。`docs/delivery-plan.md` 里「已关闭 Mock」与代码默认一致，但环境文件本身没有这两行。

### 2.2 运行拓扑

```
浏览器
  └─ Nginx（admin 镜像，80/443）
        ├─ /            静态资源 /usr/share/nginx/html/web
        └─ /admin/*     反代 backend:9001（限流 30 r/s，突发 50）
                              ├─ MySQL 8（业务库）
                              ├─ Redis 7（会话与权限缓存）
                              ├─ 本地卷 /app/uploads
                              └─ 出站 HTTPS → 大模型（识别 / 问数 / 意图）
```

| 环境 | 入口 | 端口 |
|------|------|------|
| 本地前端 | `admin`：`vite` | 开发代理到 `VITE_API_PROXY_URL`（指向本机 9001） |
| 本地后端 | `server`：`SERVER_PORT`，默认 9001 | Swagger：`/docs`（仅非生产） |
| 本地依赖 | `server/docker/docker-compose.dev.yaml` | MySQL `127.0.0.1:3307`，Redis `127.0.0.1:6380` |
| 生产 | `server/docker/docker-compose.yaml` | 四容器：mysql、redis、backend、nginx。镜像名来自 `BACKEND_IMAGE` / `FRONTEND_IMAGE` |
| 健康检查 | `GET /admin/open/health` | 公开接口 |

生产容器启动链：`server/docker-entrypoint.sh` 先 `prisma migrate deploy`，再 `node dist/main`。生产进程里的 `BootstrapService` 还会再执行一次迁移，并在用户表为空时跑种子。开发环境跳过这段，依赖 `pnpm setup` / `scripts/dev-setup.sh`。

鉴权链路：

1. `POST /admin/open/login` 校验用户名、口令（bcrypt）和公司归属，签发 access / refresh token。载荷含 `tenantId`。用户名为 `admin` 时 `tenantId` 固定为 0，不校验公司。
2. 业务请求带 `Authorization: Bearer`。`AuthGuard` 验签后，与 Redis 键 `admin:token:{userId}`、`admin:passwordVersion:{userId}` 比对。刷新 token 不能访问业务接口。
3. `PermsGuard`：无 `@Perms` 的接口只要登录即可；有 `@Perms` 时按路由前缀派生权限点。用户名为 `admin` 直接放行。
4. 代码注释写明 `/app/*` 目前占位放行。当前没有挂在该前缀下的业务控制器。

---

## 3. 目录与模块地图

### 3.1 仓库顶层

| 路径 | 性质 |
|------|------|
| `admin/` | 业务管理端，同时残留原型框架页面与组件 |
| `server/` | 业务 API，同时残留通用框架模块（代码生成、文件空间、定时任务、回收站、空插件） |
| `docs/` | 产品需求、详细设计、测试用例、两份交付计划。根 `.gitignore` 忽略了整个 `docs/`，但这些文件已被跟踪 |
| `AGENTS.md`、`CLAUDE.md` | agentPM v17.0.1 脚手架说明，文件头写明由 `npx sdad-agentpm init` 生成。指向的 `.claude/`、`.Codex/` 被 gitignore，仓库里没有 agents/skills/hooks |
| `.github/workflows/` | 两个镜像构建流 + 一个未实现的 CI 占位 |

没有仓库级 README。前端 `admin/README-DEV.md` 仍自称「WEB 产品经理原型 AI 框架」，并引用不存在的 `admin/docs/`。

### 3.2 管理端：页面与 API

动态菜单由后端 `viewPath` 指向下列页面。静态路由只覆盖登录、注册、找回密码和 403/404/500。

| 业务页面 | 路径 | 对应 API 模块 |
|----------|------|----------------|
| 合同工作台 | `views/contract/workbench` | `api/contract.ts` → `/admin/contract/workbench/*` |
| 合同台账 | `views/contract/ledger` | `/admin/contract/info/*`（含 `generate-code`） |
| 合同详情 | `views/contract/detail` | 详情、附件、节点、收付款计划、操作记录 |
| 履约提醒 | `views/contract/reminder` | `/admin/contract/reminder/*` |
| 收付款管理 | `views/contract/payment` | `/admin/contract/payment/manage/*` |
| 经营分析 | `views/contract/analysis` | `/admin/contract/analysis/overview` |
| 智能录入 | `views/contract/ai-import` | `api/contract-ai.ts` → `/admin/contract/ai/recognize` |
| 智能助手浮层 | `components/business/contract-agent`（`App.vue` 登录后全局挂载） | `api/contract-agent.ts` |
| 用户 / 部门 / 岗位 | `views/organization/*` | `api/user.ts`、`department.ts`、`organization.ts` |
| 角色 / 菜单 | `views/permission/*` | `api/permission.ts` |
| 字典 | `views/system/dict` 与 `views/dict` | `api/dict.ts` |
| 操作日志 | `views/system/log` 与 `views/log` | `api/log.ts` |
| AI 配置 | `views/system/ai-config` | `api/ai-config.ts` |
| 公司管理 | `views/system/tenant` | `api/tenant.ts` |
| 登录 | `views/auth/login` | `api/auth.ts`（含公司列表） |

`admin/src/api/` 另有 `waybill.ts`。运单抽屉、三维中国地图、考试/题库类型定义仍在树里，没有对应后端合同域模型，属于原型残留。`admin/scripts/clean-demo-modules.js` 说明曾计划清理，但未清完。

### 3.3 服务端 Nest 模块

`AppModule` 用 `discoverModules()` 自动加载 `server/src/modules/*`。

| 模块 | 路由前缀 | 与合同产品的关系 |
|------|----------|------------------|
| `base` | `admin/open`、`admin/sys/{user,department,position,role,menu,log}`、`admin/tenant` | 账号、组织、RBAC、日志、公司 |
| `dict` | `admin/dict/{type,info}` | 合同枚举字典 |
| `contract` | `admin/contract/{info,detail,attachment,milestone,payment,oper-record,reminder,workbench,analysis}` | 合同主域 |
| `ai` | `admin/ai/config`、`admin/contract/ai`、`admin/contract/agent` | 模型配置、识别、助手 |
| `coding` | `admin/coding/generator` | 框架：按表生成代码。生产环境生成落盘被关掉 |
| `space` | `admin/space/{info,type}` | 框架：通用文件空间。合同附件不走这里 |
| `task` | `admin/task/{info,log}` | 框架：通用 cron。合同提醒没有注册 handler |
| `recycle` | `admin/recycle/data` | 框架：软删回收站。合同删除是物理级联 |
| `plugin` | 无控制器 | 空模块 |

全局管道：校验白名单、`TransformInterceptor` 统一 `{ code, data, message }`（非 JSON 的导出响应除外）、`LogInterceptor` 记录非 GET 写操作。

### 3.4 Prisma 核心模型

| 分组 | 模型 | 表 |
|------|------|----|
| 账号权限 | `SysUser` `SysRole` `SysMenu` `SysDepartment` `SysPosition` `SysUserRole` `SysRoleMenu` `SysRoleDepartment` `SysLog` `SysParam` | `base_sys_*` |
| 公司 | `SysTenant` `SysUserTenant` | `base_sys_tenant`、`base_sys_user_tenant` |
| 字典 | `DictType` `DictInfo` | `dict_type`、`dict_info` |
| 合同 | `ContractInfo` 及附件、节点、收付款计划、提醒、操作记录 | `contract_*` |
| AI | `AiConfig` `ContractAgentSession` `ContractAgentMessage` `ContractAgentSqlAudit` | `ai_config`、`contract_agent_*` |
| 框架 | `TaskInfo` `TaskLog` `SpaceInfo` `SpaceType` `PluginInfo` `RecycleData` | `task_*`、`space_*`、`plugin_info`、`recycle_data` |

迁移目录 `server/prisma/migrations/` 共 8 次：初始化、岗位、部门类型、schema 对齐、合同表、`ai_config`、租户表、助手表、操作日志 `description`。

### 3.5 多公司 / 多帐套如何落地

落地方式是**共享库、共享表、行上的 `tenantId`**，不是一公司一库，也不是独立 schema。

- 公司主数据是 `SysTenant`（名称、唯一编码、启停）。用户与公司是 `SysUserTenant` 多对多。
- 登录时选择公司。非 `admin` 用户必须属于该公司，token 写入 `tenantId`。
- 合同台账的列表、新增、修改、导出，以及提醒列表、收付款管理、工作台、经营分析，在用户名不是 `admin` 时把 JWT 里的 `tenantId` 写进查询条件。`admin` 不过滤；经营分析允许 `admin` 用查询参数指定公司。
- 新增合同把 `tenantId` 写入 `contract_info`。从属提醒在扫描时抄合同上的 `tenantId`。
- 菜单、角色、字典、部门模型上有 `tenantId` 字段，种子数据不填，实际是全局共用。
- 合同编号 `code` 在数据库上是**全局唯一**。生成器按当天前缀扫描全库，不按公司分段。

未按公司切开的接口见第 7 节。这是多帐套提交之后最主要的正确性缺口。

---

## 4. 核心业务能力

### 4.1 合同生命周期

状态枚举（DTO 与字典一致）：草稿、履行中、已到期、已终止、已归档。节点和收付款计划另有：待处理、已完成、逾期。

| 环节 | 行为 |
|------|------|
| 编号 | `GET /admin/contract/info/generate-code`。格式 `N` + 上海时区日期 `YYYYMMDD` + 3 位序号。权限点复用 `contract:info:add` |
| 默认状态 | 台账表单三处初始值是「履行中」（提交 `cf75d02`）。服务端在请求没带状态时仍回退「草稿」 |
| 校验 | 生效日不早于签订日，到期日不早于生效日；编号重复返回业务错误。状态只校验枚举，没有迁移矩阵，任意状态可直接互改 |
| 到期 | 合同状态不会因到期日自动改成「已到期」。工作台用日期判断「即将到期 / 逾期」 |
| 节点 / 收付款 | `resolvePendingStatus`：已完成保持已完成；计划日早于今天则为逾期。收付款登记累加 `paidAmount`，不超过计划金额，满额后标已完成。这比设计方案「第一版只记一笔、部分金额靠备注」更进一步 |
| 提醒 | 打开提醒列表时 `scanReminders()` 全表扫描：未终止/未归档且 30 天内到期的合同，以及未完成且 30 天内的节点。没有 cron。收付款计划不产生提醒 |
| 删除 | 事务内删附件、节点、计划、提醒，再删主表。操作记录 `onDelete: SetNull`，合同删后记录还在 |
| 附件 | 详情页上传，Multer 50MB；识别接口另限 PDF 20MB。下载走接口读磁盘，不经 Nginx `/uploads` |
| 导出 | 台账与收付款导出 CSV。拦截器看到非 JSON `Content-Type` 时不再包一层 JSON |

设计方案里的「登录后默认工作台」没有写死。`HOME_PAGE_PATH` 为空，首页取当前用户菜单的第一项。工作台 `orderNum = 1` 且是顶级菜单，排序正常时会落到工作台。合同菜单的 `parentId` 都是空，隐藏目录「合同管理」`isShow = 0`，所以侧边栏是一排顶级页面，不是设计稿里的一级目录加子页。

### 4.2 权限与角色

声明式 RBAC：控制器 `@Perms('add')` 加上路由前缀，变成 `contract:info:add` 这类权限点。`PermsSyncService` 每次启动把权限点登记成菜单按钮。`SeedService.seedRoleMenus()` 给五个业务角色补菜单，并清 Redis 权限缓存。

2026-07-20 提交「普通用户录入合同无权限」补的是**业务角色菜单为空**：`contract_admin` 与 `dept_manager` 因此能录入。`employee` 仍然没有 `contract:info:add`，与角色备注「只读」一致。

数据权限字段 `SysRole.relevance` 和 `SysRoleDepartment` 只有模型和种子值，合同查询没有读取它们。部门经理与合同管理员在合同域权限列表上等价，都能看到本公司全部合同，不能按部门收缩。

操作日志：`LogInterceptor` 对非 GET 成功响应写 `base_sys_log`。`description` 由 URL 末段映射成「新增 / 修改 / 删除…」。密码、token 等键名会脱敏。查询页在 `views/system/log` 与 `views/log`。

### 4.3 系统设置

已有页面和接口：用户（含导入导出、批量岗位/角色）、部门、岗位、角色与菜单分配、菜单、字典类型与字典项、操作日志、AI 配置、公司（启停、挂用户）。

种子在 `server/src/common/seed.service.ts`：管理员、五个业务角色、示例部门和岗位、六名示例员工、合同字典、24 条 `DEMO-C-*` 演示合同（`contract-demo-seed.ts`）。示例用户会挂到第一家启用的公司；若种子时还没有公司，则不会自动绑定。

### 4.4 AI / 智能识别调用链

配置：`/admin/ai/config` 维护多套模型。提供商为 openai、anthropic、qwen、deepseek、openai-compatible。`modelType` 区分 text / vision。`apiKey` 经 `CryptoService` 加密后入库，列表接口脱敏。加密密钥优先 `AI_ENCRYPT_KEY`，否则 `JWT_SECRET`，再否则代码内固定回退串。未配置 `AI_ENCRYPT_KEY` 时启动会打警告。

**智能识别（不落库）：**

```
智能录入页选择 PDF
  → POST /admin/contract/ai/recognize（权限 contract:ai:recognize，内存缓冲）
  → PdfExtractService 抽文本
       ├─ 文本足够：默认文本模型 + JSON 抽取提示词
       └─ 文本不足：改用视觉模型，把页面渲成图片再请求
  → 解析 JSON，枚举归一（合同类型、币种）
  → Pinia ai-import 把结果带到台账「新增」表单
```

识别结果含合同字段和分期 `paymentPlans`，以及按关键字段完整度估算的 `confidence`。失败不写合同。

**智能助手（登录后全局浮层）：**

```
POST /admin/contract/agent/chat
  → AgentIntentService 判意图
       ├─ query     TextToSql：模型出 SQL → sql-guard → 只读连接执行 → 再生成解读
       ├─ navigate  返回站内路由
       ├─ recognize 只引导去智能录入，对话内不上传
       └─ 其他      能力说明
  → 会话与消息写入 contract_agent_session / message
  → SQL 写入 contract_agent_sql_audit（success / blocked / failed）
```

`sql-guard` 只允许单条 `SELECT`，拒绝写关键字和多语句，表白名单为 `contract_info`、`contract_payment_plan`、`contract_milestone`、`contract_reminder`，并强制 `LIMIT`（上限 1000）。`ReadonlyDbService` 优先 `AI_READONLY_DATABASE_URL`；没配则回退主库 `DATABASE_URL` 并告警。

助手四个接口都没有 `@Perms`。按守卫规则，任意已登录用户可调用。问数 SQL 不注入 `tenantId`。

---

## 5. 文档与代码的吻合度

对照物：

- 设计方案 v1.0
- 合同 PRD v1.0、系统设置 PRD v1.0 与 v1.1
- 合同模块详细设计 V1.0
- 合同 / 系统设置测试用例
- `docs/delivery-plan.md`（2026-07-12）
- `docs/contract-management-delivery-plan.md`（更新到 2026-07-15）

仓库里**没有**独立的 AI 测试用例文档。`delivery-plan.md` 引用的 SRS `docs/01-需求与规划/20260712-企业内部合同管理系统-SRS需求规格说明书-V1.0.md` 不存在。提交 `80a074c` 删除了同目录下的 SRS V1.1（约 1600 行），引用没有改。

### 5.1 已实现（文档与代码一致，或代码已覆盖文档描述）

| 能力 | 依据 |
|------|------|
| 工作台、台账、详情（基础信息 / 附件 / 节点 / 收付款 / 操作记录）、提醒列表、收付款集中管理、经营分析 | 合同 PRD 的 US-001～US-008；详细设计第 3 章；六张合同表与控制器均在 |
| 系统设置：用户、部门、岗位、角色、菜单、字典、日志、导入导出、批量设置 | 系统设置 PRD v1.0；`delivery-plan.md` 的 F01–F09 / B01–B09 / L01–L09 |
| 合同字典 10 类、演示种子 24 条 | `contract-management-delivery-plan.md` Phase 0 与「种子数据补充」 |
| 附件 50MB 限制、CSV 导出不再被 JSON 包装、下载接口不再把 Response 交回拦截器 | 合同测试用例第七节记录的两条缺陷，代码中仍是修复后的形态 |
| 日期先后校验、编号唯一校验、级联删除保留操作记录 | 与台账 / 详情用例描述一致 |

`contract-management-delivery-plan.md` 把 Phase 0–6 标成完成，和当前合同六块页面、接口是对齐的。它没有覆盖 7 月 18–20 日的 AI、多公司和编号/默认状态。

### 5.2 部分实现

| 项 | 文档 | 代码 |
|----|------|------|
| 登录默认首页 | 设计方案：固定进工作台 | 取菜单第一项。工作台排序靠前，但是间接结果。交付计划 P4-03 自己也写了「待产品确认」 |
| 菜单结构 | 设计方案：一级「合同管理」下挂子页 | 子页全是顶级菜单；「合同管理」目录隐藏 |
| 提醒生成 | 设计方案：定期扫描；类型含收付款 | 仅在打开提醒列表时扫描合同到期和节点。收付款计划、独立定时任务都没有 |
| 部分收付款 | 设计方案：第一版不拆分，备注说明 | 已有 `paidAmount` 累计登记和剩余金额校验 |
| 合同状态机 | PRD 有状态机章节 | 只校验枚举值，不限制迁移；到期不自动改状态 |
| 部门数据权限 | 角色备注写「本部门」；模型有 `relevance`、角色-部门 | 查询未使用。同一公司内合同对有列表权限的人全可见 |
| 多公司 | 设计方案写「第一版不做复杂隔离，登录用户都可见」 | 主列表按 `tenantId` 过滤，从属资源与问数没有（见第 7 节） |
| 系统设置 PRD 版本 | v1.1 仍把字典、日志标成「待实现」 | v1.0 和代码都已实现。v1.1 过时 |
| 根交付计划 | `delivery-plan.md` 仍写 C02–C06 待实现，下一步是合同详情 | 与合同专项计划和代码冲突，文件停在 2026-07-12 |
| 测试用例执行记录 | 合同用例写 2026-07-13 API 走查 13 条通过 | 记录是文档自述。仓库没有可重复的自动化用例，本次分析未复跑 |
| 智能识别 | 无规格 | 功能在代码里，枚举归一和加解密有脚本，没有测试用例文档 |

### 5.3 文档有、代码无

| 文档描述 | 现状 |
|----------|------|
| SRS V1.0 / 被删的 SRS V1.1 | 文件不在树里 |
| 设计方案「后续规划」：审批流、附件版本、在线预览、邮件/企微/钉钉、财务对接、合同风险分析 | 均未实现。与「第一版不做」的边界一致，不算缺陷，只是未开工 |
| 收付款计划提醒、逾期提醒作为独立扫描类型 | 字典有这些值；扫描逻辑不生成收付款提醒 |
| 按部门隔离合同 | 文案和表结构在，过滤逻辑不在 |
| `admin/README-DEV.md` 列出的规范文档、Mock 默认开启、AntV G2、wangEditor、Socket.io | 与 `package.json` 和现行「Mock 关闭、后端菜单」不符 |
| agentPM 技能表（page-generator、code-reviewer 等） | 说明文件在，执行这些技能所需的 `.claude/` 目录不在仓库 |

### 5.4 代码有、文档无

| 代码 | 说明 |
|------|------|
| 多公司：`SysTenant`、登录选公司、`views/system/tenant`、合同主查询的 `tenantId` | 2026-07-19 提交。需求/设计/测试用例都未改 |
| AI 配置、PDF 识别（文本/视觉）、智能助手、SQL 审计 | 2026-07-18 至 07-19。无 PRD、无测试用例文档 |
| 合同编号自动生成 `NyyyyMMdd###` | 2026-07-20。PRD「编码规则」未同步 |
| 台账默认状态改为履行中 | 2026-07-20。与服务端回退「草稿」并存，文档仍两可 |
| 操作日志 `description` | 迁移 `20260720000000_add_syslog_description`。系统设置用例未覆盖这条展示 |
| 框架模块 coding / space / task / recycle / plugin | 通用后端遗留，产品文档未解释其是否对客户开放 |
| 运单、三维地图、考试类型 | 前端原型遗留 |

---

## 6. 质量与工程

### 6.1 测试

| 位置 | 内容 | 是否进入 CI 或 npm script |
|------|------|---------------------------|
| `server/scripts/contract-domain.spec.ts` | 4 条逾期状态断言 | 否。需自行 `tsx` / `ts-node` |
| `server/scripts/contract-demo-seed.spec.ts` | 演示种子数量、编号、覆盖面 | 否 |
| `server/scripts/verify-sql-guard.ts` | SQL 注入与白名单 | 有 script `verify:sql-guard`，CI 不跑 |
| `server/scripts/verify-ai-units.ts` | 枚举匹配与加解密 | 有 script `verify:ai-units`，CI 不跑 |
| `server/package.json` | 无 `test` 脚本，无 Jest/Vitest | — |
| `admin/package.json` | 无单测脚本。`build` = `vue-tsc --noEmit && vite build` | CI 镜像构建只跑 `vite build`，不含 `vue-tsc` |
| 合同测试用例第七节 | 声称 API 走查 13 条，并留有压测数据说明 | 不可在干净仓库里复现 |

### 6.2 Lint

| 端 | 现状 |
|----|------|
| admin | ESLint 9、Prettier、Stylelint、Commitlint、Husky、lint-staged 配置齐全 |
| server | `package.json` 有 `lint` 脚本，依赖和配置文件都没有，脚本无法按文档直接跑 |

### 6.3 CI（`.github/workflows`）

| 工作流 | 触发 | 实际动作 |
|--------|------|----------|
| `blank.yml`（名称为 CI） | push / PR 到 `main` | 只 `echo`。使用浮动的 `actions/checkout@v4` |
| `build-server.yml` | `main` 上 `server/**` 变更，或手动 | 构建并推送 `ghcr.io/<owner>/ccontractlm-server`。Action 已钉 commit |
| `build-admin.yml` | `main` 上 `admin/**` 变更，或手动 | 同上，镜像 `ccontractlm-admin` |

两条构建流不跑测试、不跑 lint、不跑 `vue-tsc`。PR 没有有效的质量门禁。`server` 镜像用 pnpm frozen lockfile；`admin` 镜像注释写明 lock 与 `package.json` 有漂移，改用 `npm install`，构建结果不由 lock 锁定。两端都同时提交了 `package-lock.json` 和 `pnpm-lock.yaml`。

### 6.4 种子与环境

种子见第 4.3 节。演示合同与示例账号的口令在 `SeedService` 里硬编码后 bcrypt，生产库若被空库初始化，会带上这套可预测口令。`server/docker/DEPLOY.md` 要求上线前修改。

环境变量（只列名，不列值）：

| 变量 | 出现位置 | 风险备注 |
|------|----------|----------|
| `DATABASE_URL` | Prisma；只读库未配置时的回退 | 问数可能拿到主库写账号 |
| `AI_READONLY_DATABASE_URL` | `readonly-db.service.ts` | 生产应单独配置，当前可选 |
| `AI_ENCRYPT_KEY` | `crypto.service.ts` | 未设则回退 `JWT_SECRET` 或固定串 |
| `AI_CALL_TIMEOUT_MS`、`AI_SQL_TIMEOUT_MS` | AI 调用与 SQL 超时 | 有默认值 |
| `JWT_SECRET`、`JWT_ACCESS_EXPIRE`、`JWT_REFRESH_EXPIRE` | `common.module.ts`、`auth.service.ts`、compose | 未配置 `JWT_SECRET` 时进程拒绝启动。模板在 `server/docker/.env.example` |
| `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`、`REDIS_DB` | `redis.service.ts`、compose | 开发 compose 把口令写在文件里 |
| `SERVER_PORT`、`NODE_ENV`、`CORS_ORIGINS` | `main.ts` | 生产未设 `CORS_ORIGINS` 时关闭跨域，与 Nginx 同域部署匹配 |
| `MYSQL_ROOT_PASSWORD`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD` | compose 与 `.env.example` | 开发 compose 使用弱口令字面量；示例文件是占位符 |
| `BACKEND_IMAGE`、`FRONTEND_IMAGE`、`BACKEND_PORT`、`HTTP_PORT`、`HTTPS_PORT` | 生产 compose | 镜像地址需自行改 GHCR |
| `VITE_BASE_URL`、`VITE_API_URL`、`VITE_API_PROXY_URL`、`VITE_DROP_CONSOLE` | `admin/.env.development`、`.env.production` | 已入库 |
| `VITE_AMAP_KEY`、`VITE_AMAP_SECRET` | 仅 `admin/.env.development` | **已随仓库提交明文**。注释写给运单地图用，合同主流程不依赖 |

`server/.gitignore` 忽略了 `server/.env*` 与 `docker/.env`，这些文件不在树里。根 `.gitignore` 忽略 `docs/`，新文档默认加不进版本库，除非强制添加。`admin/.vite/deps/` 被提交进库（智能识别那次提交），属于构建缓存。

---

## 7. 主要风险与技术债

严重程度按「现在就能造成越权或泄密」高于「交付不可重复」高于「文档和残留代码」。

### 高

1. **多公司隔离不完整。** 台账主路径认 `tenantId`，附件、节点、收付款计划、详情聚合、操作记录、提醒的查看来源/办理，都不校验公司。知道数字 ID 且拥有对应按钮权限的用户，可以读写其他公司的合同从属数据，并下载附件。
2. **智能助手问数跨公司，且任何登录用户可用。** `agent` 控制器没有 `@Perms`。`TextToSqlService` 不把 `tenantId` 写入 SQL。白名单挡的是写操作，挡不住读别的公司。再叠加只读 URL 未配置时回退主库，数据库账号若可写，应用层黑名单是唯一防线。
3. **密钥与默认口令材料在仓库或种子里。** `admin/.env.development` 含地图 Key/Secret 明文；开发 compose 与种子服务含可预测口令；AI 密钥加密在未配置 `AI_ENCRYPT_KEY` 时使用可预测回退。生产若直接空库启动种子，管理员口令即种子里的那一个。
4. **超级管理员是用户名字符串，不是角色。** `username === 'admin'` 同时绕过权限守卫和公司过滤。改名、复制账号或该账号泄露，影响面是全库。角色 `label = admin` 并不自动获得同等能力。

### 中

5. **CI 不能证明可构建、可测试。** `blank.yml` 不编译。镜像流不跑类型检查和已有断言脚本。`admin` 镜像不使用锁文件冻结依赖。合同用例的「已通过」无法在 CI 复现。
6. **两份交付计划互相矛盾，SRS 已删但引用还在。** 新人会按 `delivery-plan.md` 去补已经存在的详情页，或按已删除的 SRS 找需求。根 gitignore 还把 `docs/` 标成构建产物。
7. **提醒与「部门权限」名实不符。** 提醒靠打开列表时全表扫描，多用户同时打开会重复扫；收付款提醒缺失。部门经理文案承诺的数据范围没有实现。合同编号全局唯一，和「按公司校验重复」的服务层条件不一致，跨公司相同编号会在数据库层失败，错误信息不是业务文案。
8. **编号生成没有并发保护。** 先查最大序号再插入，没有事务锁或唯一重试。并发新增可能撞唯一键。

### 低

9. **原型与框架残留。** 运单、地图、考试类型、空插件、代码生成器、文件空间、回收站、通用任务。管理端 README 与依赖描述过时。`.vite` 缓存入库。`/app` 鉴权占位仍在，一旦有人把接口挂到该前缀会未授权暴露。
10. **生产启动双次迁移。** entrypoint 与 `BootstrapService` 各跑一次 `migrate deploy`，幂等但增加启动失败面。合同状态无自动流转，和前端默认「履行中」、后端缺省「草稿」不一致，录入来源不同会得到不同初始状态。

---

## 8. 建议的下一步

1. **先补租户predicate，再谈新功能。** 合同从属读写和附件下载统一走「当前 JWT 的 `tenantId`」；`TextToSql` 在守卫之后强制加上本公司条件（或改为参数化查询，不再把模型 SQL 直接送进主库）；`agent` 接口补 `@Perms`；生产必须配置 `AI_READONLY_DATABASE_URL` 与 `AI_ENCRYPT_KEY`。用两条测试固定：A 公司 token 访问 B 公司附件 ID 应 403，问数结果不得出现 B 公司合同编号。
2. **轮换已入库的地图密钥，移出 `.env.development`。** 开发库口令改为本地未跟踪文件。种子管理员改为首次登录改密，或由环境变量注入初始口令。不要把现有明文复制到新的示例文件。
3. **让 PR 至少跑过构建和现有脚本。** 替换 `blank.yml`：`server` 的 `npm run build`、`verify:sql-guard`、`verify:ai-units`，以及两个 `tsx` 断言；`admin` 的 `vue-tsc --noEmit`。镜像构建改为锁文件冻结安装。
4. **把文档收成一份以代码为准的索引。** 归档或改写 `docs/delivery-plan.md` 里已过时的 C02–C06；删掉对缺失 SRS 的引用，或从历史提交恢复后单独立项。为多公司与 AI 各补一页范围说明（做什么、不做什么）。从根 `.gitignore` 去掉 `docs/`，避免规格被当成构建垃圾。
5. **在隔离补上之后，只做三件产品收口。** 收付款计划纳入提醒扫描或明确从字典和页面去掉；部门数据权限要么按 `ownerId` / 部门实现，要么改掉角色备注；统一默认状态（建议以前端「履行中」为准，并写进 PRD），编号生成改为按公司加唯一约束与冲突重试。工作台是否为强制首页，用产品确认后的一行配置结束 P4-03，而不是继续依赖菜单排序。
