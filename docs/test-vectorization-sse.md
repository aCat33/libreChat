# RAG 向量化状态 SSE 连接测试指南

## 问题诊断

从您的控制台日志分析，主要问题是：
1. **401 未授权错误** - EventSource 连接被拒绝
2. **前端未收到 SSE 消息** - 没有 "MESSAGE RECEIVED" 日志
3. **UI 无状态显示** - 没有蓝色/绿色边框

## 已实施的修复

### 1. 前端改进 (useVectorizationStatus.ts)
- ✅ 增强 token 验证（排除空字符串）
- ✅ 添加详细的连接状态日志
- ✅ 改进错误处理和重连逻辑
- ✅ 增加消息接收的调试输出

### 2. 后端改进 (vectorization.js)
- ✅ 增强认证错误日志
- ✅ 修复 CORS 头设置（使用实际 origin）
- ✅ 改进 SSE 响应头配置
- ✅ 添加连接确认消息

### 3. UI 改进 (FileContainer.tsx)  
- ✅ 增强调试信息显示
- ✅ 添加连接状态指示器
- ✅ 更明显的状态边框（加粗 + 阴影）

## 测试步骤

### 第一步：重启服务

```powershell
# 停止现有服务
# 然后重新启动

# 后端
npm run backend:dev

# 前端  
npm run frontend:dev
```

### 第二步：上传测试文件

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 上传一个 PDF 或文档文件（> 5000 tokens 会触发向量化）

### 第三步：观察日志

#### ✅ 成功的日志应该包含：

**前端 Console:**
```
[FileContainer] File object: { file_id: '...', ... }
[useVectorizationStatus] ✅ Connecting SSE for: xxx
[useVectorizationStatus] Token info: { length: 261, preview: 'eyJ...', isJWT: true }
[useVectorizationStatus] ✅ SSE Connected successfully!
[useVectorizationStatus] ReadyState: 1 (1=OPEN)
[useVectorizationStatus] ⏰ Waiting for messages...
[useVectorizationStatus] 📨 ============ MESSAGE RECEIVED ============
[useVectorizationStatus] ✅ STATUS UPDATE: { status: 'processing', ... }
[FileContainer] Render state: { isVectorizing: true, isConnected: true, ... }
```

**后端 Terminal:**
```
[vectorization SSE] =========== NEW REQUEST ===========
[vectorization SSE] ✅ Auth successful
[vectorization SSE] ✅ SSE headers set
[vectorization SSE] ✅ Sent connection confirmation
[vectorization SSE] ✅ Listener registered
[VectorizationStatusManager] Updated status for xxx: processing
[VectorizationStatusManager] 📡 notifyListeners for xxx, listeners count: 1
[VectorizationStatusManager] ✅ Message sent successfully
```

#### ❌ 如果仍然出现 401 错误：

1. **检查 JWT_SECRET**:
   ```powershell
   Select-String -Path ".env" -Pattern "JWT_SECRET"
   ```
   确认存在且非空

2. **检查 token 有效期**:
   - 401 可能是 token 过期
   - 刷新页面重新登录

3. **检查后端是否正常运行**:
   ```powershell
   Get-Process | Where-Object { $_.ProcessName -like "*node*" }
   ```

### 第四步：验证 UI 显示

上传文件后，您应该看到：

1. **黄色调试框**（在文件卡片顶部）:
   ```
   ID:✅ | Conn:✅
   V:🔵 C:- F:-
   Status: processing
   ```

2. **蓝色边框和阴影**（向量化进行中）
3. **绿色边框和阴影**（向量化完成）
4. **文件卡片下方的状态文本**:
   - "⏳ Indexing document for intelligent search..." (进行中)
   - "✅ Ready for vector search" (完成)

## 常见问题排查

### Q1: 仍然看到 401 错误

**原因**: Token 验证失败

**解决方案**:
1. 清除浏览器缓存
2. 退出登录后重新登录
3. 检查 `.env` 中的 `JWT_SECRET`
4. 确认前后端使用相同的 JWT_SECRET

### Q2: 连接成功但没有消息

**原因**: 文件可能不符合向量化条件

**检查**:
- 文件大小 > 5000 tokens？
- 后端日志是否显示 "triggering vectorization"？
- 文件类型是否支持（PDF, DOCX, TXT 等）？

### Q3: UI 没有蓝色/绿色边框

**原因**: 状态未正确传递到 UI

**检查**:
1. Console 中 `[FileContainer] Render state` 的值
2. `isVectorizing` / `isCompleted` 是否为 `true`
3. 黄色调试框中的状态指示

### Q4: 多次出现连接/断开

**原因**: 组件重新渲染导致 useEffect 重复执行

**正常行为**: 
- 初始连接时可能有 1-2 次重连
- 之后应该保持稳定连接

**异常行为**:
- 持续不断的连接/断开循环
- 可能是 token 状态变化过于频繁

## 调试命令

### 查看最新的后端日志
```powershell
Get-Content "logs\debug-2026-03-10.log" -Tail 50 | Select-String -Pattern "vectorization"
```

### 查看错误日志
```powershell
Get-Content "logs\error-2026-03-10.log" -Tail 20
```

### 测试 JWT token
在浏览器 Console 中:
```javascript
// 获取当前 token
const token = localStorage.getItem('token');
console.log('Token:', token);

// 解析 JWT payload (不验证签名)
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Payload:', payload);
console.log('Expires:', new Date(payload.exp * 1000));
```

## 预期效果演示

### 文件上传后的完整流程:

1. **上传阶段** (0-2秒)
   - 文件卡片显示
   - 黄色调试框: `ID:✅ | Conn:❌`

2. **连接建立** (2-3秒)  
   - EventSource 连接成功
   - 黄色调试框: `ID:✅ | Conn:✅`

3. **向量化开始** (3-5秒)
   - 蓝色边框出现
   - 黄色调试框显示: `V:🔵 Status: processing`

4. **向量化完成** (20-30秒)
   - 绿色边框替代蓝色
   - 黄色调试框显示: `C:🟢 Status: completed`

5. **自动断开** (完成后 2 秒)
   - EventSource 连接关闭
   - 绿色边框保持显示

## 需要帮助?

如果按照以上步骤仍然无法解决问题，请提供：
1. 完整的前端 Console 日志（包含所有 vectorization 相关的）
2. 后端 Terminal 的输出
3. 黄色调试框显示的内容截图
4. 浏览器 Network 标签中 SSE 请求的状态

---

📝 **备注**: 黄色调试框会一直显示，这是为了方便调试。如果一切正常，可以在 FileContainer.tsx 中删除调试代码。
