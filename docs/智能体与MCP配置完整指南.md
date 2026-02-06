# 智能体与MCP配置完整指南

> 本指南详细介绍LibreChat中智能体（Agent）的创建配置，以及MCP服务器的两种配置方式及其区别。

---

## 📑 目录

1. [MCP服务器配置方式对比](#mcp服务器配置方式对比)
2. [智能体创建完整指南](#智能体创建完整指南)
3. [最佳实践建议](#最佳实践建议)

---

## MCP服务器配置方式对比

### 1. 直接配置MCP服务器

**配置位置**: 侧边栏 → MCP构建器（MCP Builder）面板

#### 特点

- **独立资源**: MCP服务器作为独立实体存储在数据库中
- **全局可用**: 配置后可以在多个场景使用
  - 不同的对话
  - 不同的智能体
  - 聊天输入框的MCP选择器
- **权限管理**: 支持完整的ACL权限控制
  - VIEW（查看）- 可以使用服务器
  - EDIT（编辑）- 可以修改配置
  - DELETE（删除）- 可以删除服务器
  - SHARE（共享）- 可以分享给其他用户
- **灵活使用**: 用户可以随时在对话中选择或取消选择
- **数据库标识**: 有独立的`dbId`（MongoDB ObjectId）用于权限控制

#### 适用场景

✅ 需要在多个场景灵活使用的通用工具  
✅ 需要精细权限控制和多人协作  
✅ 独立的API服务或数据源  
✅ 需要在不同智能体间共享的工具  

#### 配置方式

```typescript
// 前端配置界面
{
  title: "GitHub API",              // 显示名称
  description: "GitHub 仓库管理",   // 描述
  url: "http://localhost:8080/sse", // 服务器地址
  type: "sse",                       // 连接类型: sse/http/streamable-http
  iconPath: "/icons/github.svg",    // 图标路径
  oauth: {                           // OAuth配置（可选）
    client_id: "...",
    client_secret: "...",
    authorization_url: "...",
    token_url: "..."
  }
}
```

---

### 2. 在智能体中配置MCP服务器

**配置位置**: 智能体构建器 → 智能体配置 → MCP工具部分

#### 特点

- **绑定关系**: MCP服务器与特定智能体绑定
  - 存储在智能体的`mcpServerNames`字段中
- **自动加载**: 使用智能体时自动激活对应的MCP服务器
- **间接访问**: 通过`consumeOnly`标志标记
  - `consumeOnly: true` - 只能通过智能体使用，不能直接选择
  - `consumeOnly: false/undefined` - 有直接访问权限
- **权限继承**: 
  - 如果用户有智能体的VIEW权限
  - 则自动获得其配置的MCP服务器的使用权限
- **访问限制**: 
  - 不能单独配置或修改
  - 不在聊天输入框的MCP选择器中显示

#### 适用场景

✅ 特定智能体专用的工具集  
✅ 打包智能体能力（工具+智能体一体化）  
✅ 通过共享智能体间接共享工具  
✅ 需要工具与特定业务逻辑绑定的场景  

#### 工作原理

```typescript
// 智能体数据结构
interface Agent {
  id: string;
  name: string;
  // ... 其他配置
  mcpServerNames: string[];  // 绑定的MCP服务器列表
}

// 使用智能体时
// 1. 系统检测到 mcpServerNames: ["github-api", "jira-api"]
// 2. 自动加载这些MCP服务器
// 3. 智能体可以调用这些服务器的工具
// 4. 但用户不能在其他地方直接使用这些工具（consumeOnly: true）
```

---

### 3. consumeOnly 标志详解

这是区分两种配置方式的关键标识：

```typescript
export type MCPServerDBObjectResponse = {
  dbId?: string;
  serverName: string;
  consumeOnly?: boolean;  // ⭐ 关键标志
} & MCPOptions;
```

#### consumeOnly: true

**含义**: 只能通过智能体间接使用

**特征**:
- ❌ 不出现在聊天输入框的MCP选择器中
- ❌ 不能独立配置或修改
- ✅ 使用智能体时自动激活
- ✅ 通过智能体访问权限控制

#### consumeOnly: false 或 undefined

**含义**: 有直接访问权限

**特征**:
- ✅ 出现在MCP选择器中可以手动选择
- ✅ 可以在MCP构建器中配置
- ✅ 有独立的权限管理
- ✅ 可以在任何对话中使用

#### 权限优先级

```typescript
// ServerConfigsDB.ts - 权限检查逻辑
if (userHasDirectAccess) {
  // 直接访问优先，不设置 consumeOnly
  return await this.mapDBServerToParsedConfig(server);
}

if (hasAgentAccess) {
  // 只有智能体访问，设置 consumeOnly: true
  return {
    ...await this.mapDBServerToParsedConfig(server),
    consumeOnly: true,
  };
}
```

**规则**: 直接访问权限 > 智能体访问权限

**示例**:
- 用户A创建MCP服务器"Data API"
- 用户A在智能体"数据分析师"中配置该服务器
- 用户A也直接分享该服务器给用户B
- 结果:
  - 用户A: `consumeOnly: false` (创建者，有直接权限)
  - 用户B: `consumeOnly: false` (被直接分享，有直接权限)
  - 用户C只有智能体访问权限: `consumeOnly: true`

---

### 4. 实际应用示例

#### 场景1: 通用API工具

```yaml
# 直接配置 - MCP构建器
配置目标: 企业内部API服务
使用方式: 
  - 在MCP构建器中创建"企业数据API"
  - 设置权限：所有员工可VIEW
  - 员工在任何对话中都能选择使用
  - 可以与不同的智能体组合使用

优势: 
  - 灵活性高
  - 可以独立更新配置
  - 所有员工共享同一套凭证
```

#### 场景2: 专业领域智能体

```yaml
# 智能体配置
配置目标: 钻井工程专家智能体
配置方式:
  1. 在智能体中添加"钻井数据MCP"
  2. 添加"地质模型MCP"
  3. 添加"设备监控MCP"
  
访问方式:
  - 用户使用"钻井工程专家"智能体
  - 自动加载全部3个MCP服务器
  - 智能体可以综合调用多个数据源
  - 用户不需要手动选择MCP服务器

优势:
  - 一键启用完整能力
  - 工具与智能体逻辑绑定
  - 便于分享和部署
```

#### 场景3: 混合配置

```yaml
# 同时使用两种方式
直接配置:
  - "通用搜索API" - 所有人可用
  - "文件存储API" - 所有人可用

智能体配置:
  - 智能体A: 绑定"客户数据API" (仅该智能体使用)
  - 智能体B: 绑定"财务数据API" (仅该智能体使用)
  
使用时:
  - 用户可以选择通用API
  - 使用智能体A时自动加载客户数据API
  - 使用智能体B时自动加载财务数据API
  - 实现了灵活性与专业性的平衡
```

---

## 智能体创建完整指南

### 配置界面位置

侧边栏 → 智能体面板（Agent Panel）→ 新建智能体

---

### 必填字段 ⭐

#### 1. 名称 (Name) *

```typescript
name: string;  // 最大长度: 256字符
```

**说明**: 智能体的显示名称

**示例**:
- ✅ "客服助手"
- ✅ "数据分析专家"
- ✅ "API开发助手"

**注意事项**:
- 必须填写，不能为空
- 建议简洁明确，体现智能体功能
- 在智能体列表和对话中显示

---

#### 2. 模型 (Model) *

```typescript
provider: string;  // 提供商: openai, anthropic, google等
model: string;     // 具体模型: gpt-4, claude-3-opus等
```

**配置方式**: 点击"模型"按钮 → 进入模型配置面板

**配置步骤**:

1. **选择提供商 (Provider)**
   ```
   可选项:
   - OpenAI
   - Anthropic (Claude)
   - Google (Gemini)
   - Azure OpenAI
   - 其他自定义端点
   ```

2. **选择模型 (Model)**
   ```
   根据提供商显示可用模型:
   - OpenAI: gpt-4, gpt-4-turbo, gpt-3.5-turbo等
   - Anthropic: claude-3-opus, claude-3-sonnet等
   - Google: gemini-pro, gemini-pro-vision等
   ```

3. **模型参数 (Model Parameters)**
   ```typescript
   model_parameters: {
     temperature?: number;        // 0-2, 控制随机性
     max_tokens?: number;         // 最大输出令牌数
     top_p?: number;              // 核采样参数
     frequency_penalty?: number;  // 频率惩罚 (-2 to 2)
     presence_penalty?: number;   // 存在惩罚 (-2 to 2)
     // ... 其他提供商特定参数
   }
   ```

**注意事项**:
- ⚠️ 必须先选择提供商，才能选择模型
- ⚠️ 不同提供商支持的参数不同
- 💡 温度越高，输出越随机；越低，输出越确定

---

#### 3. 分类 (Category) *

```typescript
category: string;  // 智能体分类
```

**可选分类**:
- `general` - 通用
- `writing` - 写作
- `productivity` - 生产力
- `programming` - 编程
- `education` - 教育
- `business` - 商业
- `lifestyle` - 生活方式
- `other` - 其他

**作用**:
- 在智能体市场中分类展示
- 便于用户查找和筛选
- 影响推荐算法

---

### 可选字段

#### 4. 描述 (Description)

```typescript
description: string | null;  // 最大长度: 512字符
```

**说明**: 智能体的详细介绍

**示例**:
```
专业的客户服务智能体，能够：
- 回答产品相关问题
- 处理订单查询
- 解决常见技术问题
- 提供7x24小时服务
```

**最佳实践**:
- 清晰描述智能体的功能和用途
- 说明适用场景
- 突出特色能力
- 在智能体卡片中显示（显示前2-5行）

---

#### 5. 指令 (Instructions)

```typescript
instructions: string | null;  // 智能体的系统提示词
```

**说明**: 定义智能体的行为、角色和规则

**示例**:
```
你是一位专业的数据分析师。你的职责是：

1. 分析用户提供的数据集
2. 使用统计方法识别趋势和模式
3. 用清晰的语言解释分析结果
4. 提供可视化建议

注意事项：
- 始终验证数据质量
- 说明分析的局限性
- 提供可操作的建议
```

**特殊变量**: 可以在指令中使用动态变量

##### 可用特殊变量

点击"变量"按钮可插入以下变量：

```typescript
// 时间相关
{{current_date}}       // 当前日期 "2024-04-29 (1)" - 1表示星期一
{{current_datetime}}   // 当前日期时间 "2024-04-29 12:34:56 (1)"
{{iso_datetime}}       // ISO格式时间 "2024-04-29T16:34:56.000Z"

// 用户信息（在运行时自动替换）
{{current_user}}       // 当前用户名称
```

**使用示例**:
```
你是一位日报生成助手。

当前日期: {{current_date}}
当前用户: {{current_user}}

请为{{current_user}}生成今日工作总结。
```

**运行时结果**:
```
你是一位日报生成助手。

当前日期: 2024-04-29 (1)
当前用户: 张三

请为张三生成今日工作总结。
```

**最佳实践**:
- 清晰定义角色和职责
- 提供具体的行为规则
- 包含输出格式要求
- 说明限制和边界
- 合理使用特殊变量增强动态性

---

#### 6. 头像 (Avatar)

```typescript
avatar: {
  filepath: string;  // 头像文件路径
  source: string;    // 文件来源
} | null;
```

**配置方式**:
- 点击头像区域上传图片
- 支持常见图片格式（PNG, JPG, SVG等）
- 会自动缩放到合适尺寸

**注意事项**:
- 建议使用方形图片
- 文件大小限制（通常<5MB）
- 头像显示在智能体卡片和对话界面

---

#### 7. 工具和能力 (Tools & Capabilities)

##### 7.1 代码执行 (Code Execution)

```typescript
execute_code: boolean;  // 是否启用代码执行能力
```

**功能**: 允许智能体编写和执行Python代码

**适用场景**:
- 数据分析和可视化
- 数学计算
- 文件处理
- 科学计算

**安全性**: 在沙箱环境中执行

---

##### 7.2 文件搜索 (File Search)

```typescript
file_search: boolean;           // 是否启用文件搜索
tool_resources: {
  file_search: {
    file_ids: string[];         // 关联的文件ID列表
  }
}
```

**功能**: 在上传的文档中搜索信息

**配置步骤**:
1. 启用文件搜索
2. 上传知识库文件
3. 智能体可以在对话中引用文档内容

**支持文件类型**:
- PDF
- Word文档
- 文本文件
- Markdown
- CSV等

---

##### 7.3 网络搜索 (Web Search)

```typescript
web_search: boolean;  // 是否启用网络搜索
```

**功能**: 在对话中实时搜索互联网信息

**适用场景**:
- 需要最新信息
- 查找实时数据
- 验证事实

---

##### 7.4 常规工具 (Regular Tools)

```typescript
tools: string[];  // 工具ID列表
```

**配置方式**: 点击"添加工具"按钮 → 选择所需工具

**可用工具类型**:
- 系统内置工具（计算器、翻译等）
- 第三方插件（天气、新闻等）
- 自定义工具

---

##### 7.5 MCP服务器工具

```typescript
mcpServerNames: string[];  // MCP服务器名称列表
```

**配置方式**: 点击"添加MCP服务器工具"按钮 → 选择MCP服务器

**工作原理**:
- 选择的MCP服务器与智能体绑定
- 使用智能体时自动加载MCP工具
- MCP工具仅在该智能体中可用（`consumeOnly: true`）

**详见**: [MCP服务器配置方式对比](#mcp服务器配置方式对比)

---

##### 7.6 动作 (Actions)

```typescript
actions: string[];  // 动作ID列表
```

**说明**: OpenAPI规范的动作定义

**配置方式**:
1. 点击"添加动作"
2. 提供OpenAPI规范（JSON/YAML）
3. 配置认证信息

**适用场景**:
- 调用REST API
- 集成第三方服务
- 自定义业务逻辑

---

#### 8. 工件 (Artifacts)

```typescript
artifacts: string;  // 工件类型
```

**可选值**:
- `` (空) - 不启用
- `code` - 代码工件
- `markdown` - Markdown文档

**功能**: 在对话中生成独立的、可交互的内容

**示例用途**:
- 生成可运行的代码片段
- 创建格式化的文档
- 构建交互式演示

---

#### 9. 高级配置

##### 9.1 递归限制 (Recursion Limit)

```typescript
recursion_limit: number | undefined;  // 默认: 25
```

**说明**: 智能体之间相互调用的最大深度

**适用场景**: 多智能体协作时防止无限循环

---

##### 9.2 工具执行后结束 (End After Tools)

```typescript
end_after_tools: boolean;  // 默认: false
```

**功能**: 执行工具后立即结束，不再生成文本响应

**适用场景**: 纯工具执行型智能体

---

##### 9.3 隐藏顺序输出 (Hide Sequential Outputs)

```typescript
hide_sequential_outputs: boolean;  // 默认: false
```

**功能**: 隐藏工具调用的中间过程，只显示最终结果

**适用场景**: 改善用户体验，避免显示技术细节

---

#### 10. 对话启动器 (Conversation Starters)

```typescript
conversation_starters: string[];  // 最多4个
```

**说明**: 预设的对话开场建议

**示例**:
```typescript
[
  "帮我分析这个数据集",
  "生成月度报告",
  "解释这个趋势",
  "创建数据可视化"
]
```

**显示位置**: 智能体详情页和对话开始界面

---

#### 11. 支持联系方式 (Support Contact)

```typescript
support_contact: {
  name: string;   // 联系人名称
  email: string;  // 联系邮箱
} | null;
```

**说明**: 用户遇到问题时的联系方式

**示例**:
```typescript
{
  name: "技术支持团队",
  email: "support@example.com"
}
```

**显示位置**: 智能体详情页

---

#### 12. 协作与权限

##### 12.1 协作模式 (已废弃)

```typescript
isCollaborative: boolean;  // @deprecated - 使用ACL权限替代
```

⚠️ 此字段已废弃，请使用新的ACL权限系统

##### 12.2 ACL权限系统 (推荐)

```typescript
// 通过UI配置，不在表单中
effectivePermissions: number;  // 权限位掩码
```

**权限类型**:
- `VIEW` (1) - 查看和使用
- `EDIT` (2) - 编辑配置
- `DELETE` (4) - 删除智能体
- `SHARE` (8) - 分享给他人

**配置方式**: 创建后在智能体详情页配置分享权限

---

#### 13. 项目关联 (Projects)

```typescript
projectIds: string[];  // 关联的项目ID
```

**说明**: 将智能体归属到特定项目

**用途**:
- 组织管理智能体
- 项目级别的权限控制
- 团队协作

---

### 配置流程最佳实践

#### 1. 创建新智能体的推荐步骤

```
1. 基础信息
   ├─ 填写名称 *
   ├─ 填写描述
   └─ 选择分类 *

2. 模型配置
   ├─ 选择提供商 *
   ├─ 选择模型 *
   └─ 调整模型参数

3. 行为定义
   ├─ 编写指令
   └─ 添加特殊变量

4. 能力配置
   ├─ 启用所需工具
   ├─ 上传知识库文件
   └─ 添加MCP服务器

5. 外观和互动
   ├─ 上传头像
   ├─ 设置对话启动器
   └─ 填写支持联系方式

6. 测试和调整
   ├─ 保存智能体
   ├─ 开始对话测试
   └─ 根据效果调整配置
```

---

#### 2. 验证要点

**保存前检查清单**:

```
✓ 必填字段
  □ 名称已填写
  □ 模型已选择（提供商 + 模型）
  □ 分类已选择

✓ 功能完整性
  □ 指令清晰明确
  □ 所需工具已添加
  □ 知识库文件已上传（如需要）

✓ 用户体验
  □ 描述易于理解
  □ 对话启动器有吸引力
  □ 头像已设置

✓ 测试验证
  □ 创建测试对话
  □ 验证工具调用
  □ 检查输出质量
```

---

### 常见问题和注意事项

#### 问题1: 保存失败

**原因**:
- 缺少必填字段（名称、模型、分类）
- 模型未正确选择（需要提供商和模型都设置）

**解决**:
```typescript
// 检查控制台错误信息
// 常见错误:
"Provider and model are required"
"Agent name is required"
```

---

#### 问题2: 智能体行为不符合预期

**原因**:
- 指令不够清晰或具体
- 模型参数设置不当
- 缺少必要的工具或知识库

**解决**:
1. 优化指令，增加具体示例
2. 调整温度参数（降低温度提高确定性）
3. 确保启用了所需的工具

---

#### 问题3: MCP工具无法使用

**检查事项**:
```
1. MCP服务器是否正常运行
2. 是否在智能体中添加了MCP服务器
3. MCP服务器是否需要认证（检查customUserVars）
4. 检查MCP连接状态（在MCP构建器中查看）
```

---

#### 问题4: 文件搜索不工作

**检查事项**:
```
1. 是否启用了 file_search 能力
2. 是否上传了文件
3. 文件格式是否支持
4. 文件是否成功索引（检查文件状态）
```

---

## 最佳实践建议

### 1. 智能体设计原则

#### 单一职责原则
```yaml
❌ 错误: "全能助手" - 什么都会做
✅ 正确: 
  - "客服助手" - 专注客户服务
  - "数据分析师" - 专注数据分析
  - "代码审查员" - 专注代码审查
```

#### 清晰的角色定位
```
指令模板:
你是一位[角色]。你的专长是[专长领域]。

你的主要职责:
1. [职责1]
2. [职责2]
3. [职责3]

你应该:
- [行为准则1]
- [行为准则2]

你不应该:
- [限制1]
- [限制2]
```

---

### 2. MCP服务器使用策略

#### 选择配置方式决策树

```
开始
  ↓
该工具是否只用于特定智能体？
  ├─ 是 → 在智能体中配置
  └─ 否 ↓
需要跨多个场景使用？
  ├─ 是 → 直接配置
  └─ 否 ↓
需要精细的权限控制？
  ├─ 是 → 直接配置
  └─ 否 → 根据便利性选择
```

#### 混合配置策略

```yaml
直接配置（共享层）:
  - 通用API服务
  - 企业数据源
  - 公共工具集

智能体配置（专业层）:
  - 领域专用API
  - 智能体特定工具
  - 绑定业务逻辑的服务
```

---

### 3. 指令编写技巧

#### 结构化指令模板

```markdown
# 角色定义
你是[角色名称]，专注于[领域]。

# 核心能力
你擅长:
1. [能力1]
2. [能力2]
3. [能力3]

# 工作流程
处理用户请求时，请遵循以下步骤:
1. [步骤1]
2. [步骤2]
3. [步骤3]

# 输出格式
你的回答应该:
- [格式要求1]
- [格式要求2]

# 限制条件
请注意:
- [限制1]
- [限制2]

# 特殊处理
当遇到[特殊情况]时:
- [处理方式]
```

#### 使用动态变量增强个性化

```markdown
你好，{{current_user}}！

今天是 {{current_date}}，让我帮你完成今日任务。

当前时间: {{current_datetime}}
```

---

### 4. 工具组合策略

#### 基础组合

```typescript
// 通用助手
{
  execute_code: false,
  file_search: false,
  web_search: true,    // 实时信息
  tools: ["calculator", "translator"]
}
```

#### 数据分析型

```typescript
// 数据分析师
{
  execute_code: true,        // 数据处理
  file_search: true,         // 文档查询
  web_search: false,
  mcpServers: ["database-api"]  // 数据库访问
}
```

#### 研究型

```typescript
// 研究助手
{
  execute_code: false,
  file_search: true,         // 文献检索
  web_search: true,          // 最新资料
  mcpServers: ["academic-db"]  // 学术数据库
}
```

#### 开发型

```typescript
// 编程助手
{
  execute_code: true,        // 代码测试
  file_search: true,         // 文档查询
  web_search: true,          // 技术搜索
  mcpServers: ["github-api", "stack-overflow"],
  tools: ["code_search"]
}
```

---

### 5. 性能优化建议

#### 减少不必要的工具
```
❌ 启用所有可用工具
✅ 只启用必需的工具
```

#### 合理设置模型参数
```typescript
// 需要创意性任务
{ temperature: 0.8 }

// 需要精确性任务  
{ temperature: 0.2 }

// 平衡型
{ temperature: 0.5 }
```

#### 知识库文件优化
```
- 控制文件数量（建议<50个）
- 优化文件大小（单文件<10MB）
- 使用清晰的文件命名
- 定期清理过时文档
```

---

### 6. 测试和迭代

#### 测试检查清单

```
功能测试:
  □ 基本对话响应正常
  □ 指令遵循准确
  □ 工具调用成功
  □ MCP服务器连接正常
  □ 文件搜索有效

边界测试:
  □ 超出能力范围的请求
  □ 错误输入处理
  □ 并发请求处理

用户体验:
  □ 响应速度可接受
  □ 输出格式美观
  □ 错误提示友好
  □ 对话启动器有用
```

#### 迭代优化流程

```
1. 收集用户反馈
2. 分析常见问题
3. 优化指令和配置
4. A/B测试新版本
5. 数据分析效果
6. 持续改进
```

---

## 附录

### A. 字段完整列表

```typescript
interface Agent {
  // ===== 基础信息 =====
  id: string;                          // 自动生成的唯一ID
  name: string;                        // *必填* 名称
  description?: string;                // 描述
  category: string;                    // *必填* 分类
  avatar?: {                           // 头像
    filepath: string;
    source: string;
  };

  // ===== 模型配置 =====
  provider: string;                    // *必填* 提供商
  model: string;                       // *必填* 模型
  model_parameters?: {                 // 模型参数
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  };

  // ===== 行为定义 =====
  instructions?: string;               // 指令/提示词
  conversation_starters?: string[];    // 对话启动器

  // ===== 工具和能力 =====
  execute_code?: boolean;              // 代码执行
  file_search?: boolean;               // 文件搜索
  web_search?: boolean;                // 网络搜索
  tools?: string[];                    // 常规工具
  actions?: string[];                  // 动作/OpenAPI
  mcpServerNames?: string[];           // MCP服务器

  // ===== 高级配置 =====
  artifacts?: string;                  // 工件类型
  recursion_limit?: number;            // 递归限制
  end_after_tools?: boolean;           // 工具后结束
  hide_sequential_outputs?: boolean;   // 隐藏顺序输出

  // ===== 组织和权限 =====
  author: ObjectId;                    // 作者ID（自动）
  authorName?: string;                 // 作者名称（自动）
  projectIds?: ObjectId[];             // 项目ID列表
  support_contact?: {                  // 支持联系方式
    name: string;
    email: string;
  };

  // ===== 其他 =====
  tool_resources?: {                   // 工具资源
    file_search?: {
      file_ids: string[];
    };
    code_files?: {
      file_ids: string[];
    };
  };
  edges?: GraphEdge[];                 // 智能体图边（多智能体协作）
  versions?: Agent[];                  // 版本历史
  is_promoted?: boolean;               // 是否推广
  createdAt?: Date;                    // 创建时间（自动）
  updatedAt?: Date;                    // 更新时间（自动）
}
```

---

### B. 特殊变量完整列表

```typescript
// 在指令中可用的特殊变量
const specialVariables = {
  // 时间变量
  "current_date": "当前日期 (格式: YYYY-MM-DD (星期))",
  "current_datetime": "当前日期时间 (格式: YYYY-MM-DD HH:mm:ss (星期))",
  "iso_datetime": "ISO格式时间 (格式: YYYY-MM-DDTHH:mm:ss.000Z)",
  
  // 用户变量
  "current_user": "当前用户名称"
};

// 在MCP服务器headers中可用的用户变量
const mcpUserVariables = {
  "LIBRECHAT_USER_ID": "用户唯一ID",
  "LIBRECHAT_USER_EMAIL": "用户邮箱",
  "LIBRECHAT_USER_ROLE": "用户角色 (ADMIN/USER)",
  "LIBRECHAT_USER_NAME": "用户名称",
  "LIBRECHAT_USER_USERNAME": "用户用户名"
};
```

---

### C. 常见错误码

```typescript
// 智能体相关错误
const agentErrors = {
  "AGENT_NOT_FOUND": "智能体不存在",
  "AGENT_NAME_REQUIRED": "智能体名称是必需的",
  "PROVIDER_MODEL_REQUIRED": "提供商和模型是必需的",
  "INVALID_CATEGORY": "无效的分类",
  "PERMISSION_DENIED": "权限不足",
  "INVALID_MODEL": "模型不可用或不支持"
};

// MCP相关错误
const mcpErrors = {
  "MCP_SERVER_NOT_FOUND": "MCP服务器不存在",
  "MCP_CONNECTION_FAILED": "MCP服务器连接失败",
  "MCP_AUTH_REQUIRED": "需要MCP服务器认证",
  "MCP_TOOL_NOT_FOUND": "MCP工具不存在",
  "CONSUME_ONLY_ACCESS": "只能通过智能体访问此MCP服务器"
};
```

---

### D. 相关链接

- [LibreChat官方文档](https://docs.librechat.ai/)
- [智能体API文档](https://docs.librechat.ai/api/agents)
- [MCP协议规范](https://modelcontextprotocol.io/)
- [OpenAI模型文档](https://platform.openai.com/docs/models)
- [Anthropic模型文档](https://docs.anthropic.com/claude/docs)

---

## 版本历史

- **v1.0** (2026-02-06) - 初始版本，涵盖智能体和MCP配置完整指南

---

**文档维护**: 请根据系统更新及时更新本文档
**反馈渠道**: 如有问题或建议，请提交Issue或Pull Request
