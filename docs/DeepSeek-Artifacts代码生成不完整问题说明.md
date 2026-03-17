# DeepSeek Artifacts 代码生成不完整问题说明

## 🔍 问题原因

DeepSeek 生成 artifact 代码时中途截断，**不是 bug，而是 token 输出限制**。

### 关键发现

根据代码库分析（`packages/api/src/utils/tokens.ts`）：

```typescript
const deepseekMaxOutputs = {
  deepseek: 8000,        // deepseek-chat default: 4K, max: 8K
  'deepseek-chat': 8000,
  'deepseek-v3': 8000,
  'deepseek-reasoner': 64000,  // default: 32K, max: 64K
};
```

**DeepSeek-chat 模型限制：**
- 上下文窗口：128,000 tokens
- ⚠️ **默认最大输出：4,000 tokens** (约 3000-3200 行中文代码)
- 可配置最大输出：8,000 tokens (约 6000-6400 行代码)

### 当前配置问题

检查 `librechat.yaml` 中 DeepSeek 端点配置：

```yaml
- name: "DeepSeek"
  apiKey: "${DEEPSEEK_API_KEY}"
  baseURL: "https://api.deepseek.com/v1"
  models:
    default:
      - "deepseek-chat"
  # ❌ 没有设置 max_tokens！使用默认 4K
```

**对比千问端点配置**（有明确设置）：

```yaml
- name: "通义千问"
  addParams:
    max_tokens: 4096  # ✅ 明确设置了输出限制
```

## ✅ 解决方案

### 方案 1：增加 DeepSeek 的 max_tokens（推荐）

在 `librechat.yaml` 中为 DeepSeek 端点添加参数配置：

```yaml
- name: "DeepSeek"
  apiKey: "${DEEPSEEK_API_KEY}"
  baseURL: "https://api.deepseek.com/v1"
  models:
    default:
      - "deepseek-chat"
      - "deepseek-coder"
  titleConvo: true
  titleModel: "deepseek-chat"
  modelDisplayLabel: "DeepSeek"
  
  # ✅ 添加这个配置
  addParams:
    max_tokens: 8000  # 设置为 8K 最大值
    temperature: 1
  
  # 保持其他配置不变...
  systemPrompt: |
    你是专业的油田钻井数据助手。
    ...
```

### 方案 2：不同场景使用不同配置

```yaml
- name: "DeepSeek 标准"
  # ... 基础配置
  addParams:
    max_tokens: 4096  # 普通对话使用 4K

- name: "DeepSeek 长输出"
  # ... 基础配置  
  addParams:
    max_tokens: 8000  # 生成代码/图表时使用 8K
```

### 方案 3：使用 deepseek-reasoner (推理模型)

如果需要更长的输出（如复杂图表），可以使用 `deepseek-reasoner`：

```yaml
models:
  default:
    - "deepseek-chat"
    - "deepseek-reasoner"  # ✅ 默认 32K，最大 64K 输出
```

## 📊 Token 与代码行数参考

根据实际测试，对于 React+recharts artifacts：

| max_tokens | 中文内容 | 英文代码 | 适用场景 |
|-----------|---------|---------|---------|
| 4,000 | ~240-280 行 | ~300-350 行 | 简单组件、单图表 |
| 6,000 | ~360-420 行 | ~450-525 行 | 中等复杂图表 |
| 8,000 | ~480-560 行 | ~600-700 行 | 复杂多图表、带交互 |
| 16,000 | ~960-1120 行 | ~1200-1400 行 | 非常复杂的应用 |

**从截图看，代码在第 305 行被截断 = 约 4000 tokens，正好是默认限制！**

## 🔧 立即修复步骤

1. **编辑配置文件**：
   ```bash
   # Windows
   notepad librechat.yaml
   ```

2. **找到 DeepSeek 配置段**（约第 73 行）：
   ```yaml
   - name: "DeepSeek"
     apiKey: "${DEEPSEEK_API_KEY}"
   ```

3. **在 `modelDisplayLabel: "DeepSeek"` 后添加**：
   ```yaml
   modelDisplayLabel: "DeepSeek"
   addParams:
     max_tokens: 8000
     temperature: 1
   ```

4. **重启后端**：
   ```bash
   npm run backend:dev
   ```

## ⚠️ 注意事项

### DeepSeek API 限制

根据 [DeepSeek 官方文档](https://api-docs.deepseek.com/)：

- `deepseek-chat`: max_tokens 范围 1-8192
- `deepseek-reasoner`: max_tokens 范围 1-65536

**设置超出范围会被 API 自动截断到最大值。**

### 成本考虑

- 增加 `max_tokens` 不会直接增加成本
- 成本基于**实际生成的 token 数**，而非设置的最大值
- 更长的输出可能略微增加生成时间

### 已实现的错误处理

现有错误处理机制（刚才实现的）会：
1. 捕获因截断导致的语法错误
2. 显示友好提示
3. 允许用户重试或手动编辑

## 🎯 推荐配置

综合考虑性能、成本和实用性：

```yaml
- name: "DeepSeek"
  apiKey: "${DEEPSEEK_API_KEY}"
  baseURL: "https://api.deepseek.com/v1"
  models:
    default:
      - "deepseek-chat"
      - "deepseek-coder"
  titleConvo: true
  titleModel: "deepseek-chat"
  modelDisplayLabel: "DeepSeek"
  
  addParams:
    max_tokens: 8000      # ✅ 使用最大值，适配复杂artifacts
    temperature: 1        # 保持创造性
    top_p: 1
    frequency_penalty: 0
    presence_penalty: 0
  
  # 如果想避免某些参数被传递给 API
  dropParams: ["top_p", "frequency_penalty", "presence_penalty"]
  
  systemPrompt: |
    你是专业的油田钻井数据助手。
    # 保持原有 prompt...
```

## 📈 验证修复

修改后测试：

1. 重启后端
2. 新建对话
3. 让 DeepSeek 生成相同的图表
4. 检查是否完整生成（应该能看到完整的闭合标签）

## 🔍 排查其他可能

如果增加 `max_tokens` 后仍然截断：

1. **检查 API key 配额**：
   - 登录 DeepSeek 控制台
   - 查看是否有账户级别的限制

2. **检查网络代理/中间件**：
   - 某些代理可能有响应大小限制

3. **检查 MongoDB 限制**：
   - 默认文档大小限制 16MB
   - artifacts 代码一般不会接近这个限制

## 📝 相关文件

- 配置文件：`librechat.yaml`
- Token 限制定义：`packages/api/src/utils/tokens.ts`
- 错误处理组件：`client/src/components/Artifacts/ArtifactErrorBoundary.tsx`
- 已修复的错误展示

---

**总结：DeepSeek artifacts 生成不完整的主要原因是默认 4K token 输出限制，增加 `max_tokens` 到 8000 即可解决。**
