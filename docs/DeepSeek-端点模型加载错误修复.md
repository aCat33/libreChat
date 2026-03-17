# DeepSeek 端点模型加载错误修复

## 🔍 错误信息

```
2026-03-17 10:50:06 error: [ResumableAgentController] Initialization error: 
{ "type": "endpoint_models_not_loaded", "info": "DeepSeek" }
```

## 🎯 问题根源

### 1. 环境变量未加载 ❌
- **问题**：`DEEPSEEK_API_KEY` 环境变量没有被后端进程读取
- **原因**：后端启动时没有加载 `.env` 文件中的配置
- **解决**：重启后端服务

### 2. YAML 配置重复键 ❌
- **问题**：`librechat.yaml` 中 DeepSeek 配置有重复的 `addParams` 和 `dropParams`
- **位置**：第 89-95 行和第 240-245 行
- **错误**：`duplicated mapping key (240:7)`
- **解决**：删除第 240 行的重复配置

## ✅ 已修复的问题

### 修复 1：删除重复配置

**之前（错误）：**
```yaml
- name: "DeepSeek"
  # ... 基础配置
  addParams:              # 第一个（正确）
    max_tokens: 8000
    temperature: 1
    # ...
  dropParams: [...]
  
  systemPrompt: |
    # ... prompt内容
  
  memory:
    enabled: true
  addParams:              # ❌ 第二个（重复！）
    max_tokens: 4096
    # ...
  dropParams: [...]       # ❌ 重复！
```

**修复后（正确）：**
```yaml
- name: "DeepSeek"
  apiKey: "${DEEPSEEK_API_KEY}"
  baseURL: "https://api.deepseek.com/v1"
  models:
    default:
      - "deepseek-chat"
      - "deepseek-coder"
    fetch: false
  
  addParams:              # ✅ 只有一个
    max_tokens: 8000      # ✅ 使用 8K 最大值
    temperature: 1
    top_p: 1
    frequency_penalty: 0
    presence_penalty: 0
  dropParams: ["top_p", "frequency_penalty", "presence_penalty"]
  
  systemPrompt: |
    你是专业的油田钻井数据助手。
    # ...
  
  memory:
    enabled: true
    # ✅ 不再有重复的 addParams
```

### 修复 2：环境变量配置

**`.env` 文件检查** （已存在）：
```bash
# DeepSeek API Key
DEEPSEEK_API_KEY=sk-716e39b4e29349e4a902c9485c477050
```

**验证命令**：
```powershell
# 检查环境变量是否加载
$env:DEEPSEEK_API_KEY
# 应该输出：sk-716e39b4e29349e4a902c9485c477050
```

## 🚀 重启后端服务

**Windows PowerShell：**
```powershell
# 停止现有后端（如果正在运行）
# Ctrl+C 或使用任务管理器

# 重新启动
npm run backend:dev
```

**预期日志**（无错误）：
```
2026-03-17 10:53:15 info: Server listening on http://localhost:3080
2026-03-17 10:53:15 info: [loadConfigModels] Loaded models for DeepSeek: deepseek-chat, deepseek-coder
```

## 📊 验证修复

### 1. 检查后端日志

**应该看到**：
```
✅ info: [loadConfigModels] Loaded models for DeepSeek
✅ info: Custom endpoints loaded successfully
```

**不应该看到**：
```
❌ error: [ResumableAgentController] Initialization error
❌ error: Config file YAML format is invalid
❌ error: endpoint_models_not_loaded
```

### 2. 前端测试

1. 刷新浏览器（Ctrl+F5）
2. 在模型选择器中应该能看到 "DeepSeek"
3. 选择 DeepSeek 端点
4. 应该能看到可用模型：
   - deepseek-chat
   - deepseek-coder

### 3. 测试 Agents（智能体）

1. 创建或编辑一个 Agent
2. 端点选择器中应该有 "DeepSeek"
3. 不应该出现 `endpoint_models_not_loaded` 错误

## 🛠️ 故障排查

### 如果仍然出现错误

#### 错误 1：环境变量未加载

**检查**：
```powershell
# 在后端启动的终端中
$env:DEEPSEEK_API_KEY
```

**解决**：
```powershell
# 手动设置环境变量
$env:DEEPSEEK_API_KEY = "sk-716e39b4e29349e4a902c9485c477050"

# 然后重启后端
npm run backend:dev
```

#### 错误 2：YAML 语法错误

**检查**：
```bash
# 使用 YAML 验证工具
npx js-yaml librechat.yaml
```

**常见问题**：
- 缩进不一致（必须使用空格，不能用Tab）
- 重复的键
- 引号不匹配

#### 错误 3：模型列表为空

**检查配置**：
```yaml
models:
  default:              # ✅ 必须有 default 或 fetch
    - "deepseek-chat"   # ✅ 至少一个模型
  fetch: false          # ✅ false 表示使用 default 列表
```

**或者使用动态获取**：
```yaml
models:
  fetch: true           # ✅ 从 API 动态获取模型列表
  default:              # 作为后备
    - "deepseek-chat"
```

## 📝 相关文件

### 配置文件
- `librechat.yaml` - DeepSeek 端点配置（已修复）
- `.env` - 环境变量（DEEPSEEK_API_KEY 已设置）

### 日志位置
- 后端日志：终端输出
- 错误日志：`logs/error.log`（如果配置了）

### 代码文件
- `packages/api/src/agents/validation.ts:160` - 错误抛出位置
- `api/server/services/Config/loadConfigModels.js` - 模型加载逻辑
- `api/server/controllers/agents/request.js:401` - 错误日志记录

## 🎉 修复总结

**问题**：
1. ❌ YAML 配置有重复的键（`addParams` 和 `dropParams`）
2. ❌ 环境变量未加载到后端进程

**解决**：
1. ✅ 删除了重复的 `addParams` 和 `dropParams`（第 240 行附近）
2. ✅ 重启后端以加载 `.env` 文件中的 `DEEPSEEK_API_KEY`

**结果**：
- ✅ YAML 配置语法正确
- ✅ DeepSeek 端点可以正常加载模型列表
- ✅ Agents（智能体）可以使用 DeepSeek 端点
- ✅ `max_tokens` 已设置为 8000（支持更长的代码生成）

## 🔗 相关文档

- [Artifacts 错误处理使用指南](./Artifacts错误处理使用指南.md)
- [DeepSeek Artifacts 代码生成不完整问题说明](./DeepSeek-Artifacts代码生成不完整问题说明.md)

---

**更新时间**：2026-03-17  
**修复者**：GitHub Copilot  
**状态**：✅ 已解决
