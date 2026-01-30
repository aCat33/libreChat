# MCP权限测试指南 - Oilfield Drilling

本指南帮助你测试不同角色用户访问 MCP (Model Context Protocol) 服务器时的权限差异。

## 📋 测试目标

验证 LibreChat 正确传递用户信息（角色、邮箱、用户ID）到 MCP 服务器，确保：
- **ADMIN** 用户可以访问所有数据
- **USER** 用户只能访问自己权限范围内的数据
- 不同 USER 之间数据相互隔离

## 🔧 配置说明

### 当前 librechat.yaml 配置

```yaml
mcpServers:
  oilfield-drilling:
    type: http
    url: "http://localhost:8080/sse"
    
    # ⭐ 关键：通过headers传递用户信息
    headers:
      X-User-Role: "{{LIBRECHAT_USER_ROLE}}"      # 用户角色：ADMIN 或 USER
      X-User-Email: "{{LIBRECHAT_USER_EMAIL}}"    # 用户邮箱
      X-User-ID: "{{LIBRECHAT_USER_ID}}"          # 用户唯一ID
```

LibreChat 会自动将模板变量替换为实际用户信息，并发送到 MCP 服务器。

---

## 🚀 快速开始

### 步骤 1: 创建测试用户

运行脚本创建三个测试用户（1个管理员 + 2个普通用户）：

```bash
node config/setup-test-users.js
```

**创建的测试用户：**

| 邮箱 | 密码 | 角色 | 说明 |
|------|------|------|------|
| admin@test.com | Admin@123456 | ADMIN | 管理员，应有完整访问权限 |
| user1@test.com | User@123456 | USER | 普通用户1，测试基础权限 |
| user2@test.com | User@123456 | USER | 普通用户2，测试数据隔离 |

---

### 步骤 2: 启动服务

#### 2.1 启动 LibreChat

```bash
# 启动后端
npm run backend:dev

# 启动前端（新终端）
npm run frontend:dev
```

#### 2.2 启动 MCP 服务器

确保你的 MCP 服务器运行在 `http://localhost:8080/sse`

```bash
# 示例：如果你的MCP服务器是Python FastAPI
cd /path/to/your/mcp/server
python main.py
```

---

### 步骤 3: 运行自动化测试

验证用户角色和信息传递是否正确：

```bash
node config/test-mcp-permissions.js
```

**测试内容：**
- ✅ 验证用户能否登录
- ✅ 验证用户角色是否正确分配
- ✅ 显示将传递给 MCP 的请求头信息
- ✅ 检查 MCP 服务器连接状态

---

## 🧪 手动测试流程

### 测试场景 1：管理员权限测试

1. **登录**
   - 打开 http://localhost:3080
   - 使用 `admin@test.com` / `Admin@123456` 登录

2. **创建对话**
   - 新建聊天
   - 选择任意 AI 模型（如 DeepSeek 或 Qwen）

3. **启用 MCP 服务器**
   - 点击 MCP 配置
   - 启用 "Oilfield Drilling Data Service"

4. **测试查询**
   ```
   查询所有油田钻井数据
   ```

5. **验证 MCP 日志**
   
   在 MCP 服务器日志中应该看到：
   ```
   X-User-Role: ADMIN
   X-User-Email: admin@test.com
   X-User-ID: <管理员的MongoDB ID>
   ```

6. **预期结果**
   - ✅ 应该返回所有钻井数据（不受用户限制）
   - ✅ 可以访问敏感或高权限数据

---

### 测试场景 2：普通用户权限测试

1. **登出并重新登录**
   - 使用 `user1@test.com` / `User@123456` 登录

2. **创建对话并启用 MCP**
   - 新建聊天
   - 启用 "Oilfield Drilling Data Service"

3. **测试相同查询**
   ```
   查询所有油田钻井数据
   ```

4. **验证 MCP 日志**
   ```
   X-User-Role: USER
   X-User-Email: user1@test.com
   X-User-ID: <user1的MongoDB ID>
   ```

5. **预期结果**
   - ✅ 只返回该用户有权限查看的数据
   - ✅ 敏感数据应该被过滤或拒绝访问

---

### 测试场景 3：用户间数据隔离测试

1. **使用 user1 创建一些数据**
   ```
   添加一条钻井记录：井号123，位置XX油田
   ```

2. **登出并使用 user2 登录**
   - 使用 `user2@test.com` / `User@123456` 登录

3. **尝试查询 user1 的数据**
   ```
   查询井号123的记录
   ```

4. **预期结果**
   - ✅ user2 应该无法看到 user1 创建的数据
   - ✅ 或者收到 "无权限" 的提示

---

## 📊 MCP 服务器端实现示例

你的 MCP 服务器应该根据请求头中的用户信息进行权限控制：

### Python FastAPI 示例

```python
from fastapi import FastAPI, Header, HTTPException
from typing import Optional

app = FastAPI()

@app.get("/sse")
async def mcp_endpoint(
    x_user_role: Optional[str] = Header(None),
    x_user_email: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    # 记录日志
    print(f"收到请求 - 角色: {x_user_role}, 邮箱: {x_user_email}, ID: {x_user_id}")
    
    # 权限控制
    if x_user_role == "ADMIN":
        # 管理员可以访问所有数据
        return get_all_drilling_data()
    elif x_user_role == "USER":
        # 普通用户只能访问自己的数据
        return get_user_drilling_data(user_id=x_user_id)
    else:
        raise HTTPException(status_code=403, detail="未授权访问")

def get_all_drilling_data():
    # 返回所有钻井数据
    return {"data": [...], "access_level": "admin"}

def get_user_drilling_data(user_id: str):
    # 只返回该用户有权限的数据
    return {"data": [...], "access_level": "user", "user_id": user_id}
```

### Node.js Express 示例

```javascript
const express = require('express');
const app = express();

app.get('/sse', (req, res) => {
  const userRole = req.headers['x-user-role'];
  const userEmail = req.headers['x-user-email'];
  const userId = req.headers['x-user-id'];

  console.log(`收到请求 - 角色: ${userRole}, 邮箱: ${userEmail}, ID: ${userId}`);

  // 权限控制
  if (userRole === 'ADMIN') {
    res.json(getAllDrillingData());
  } else if (userRole === 'USER') {
    res.json(getUserDrillingData(userId));
  } else {
    res.status(403).json({ error: '未授权访问' });
  }
});

function getAllDrillingData() {
  return { data: [...], access_level: 'admin' };
}

function getUserDrillingData(userId) {
  return { data: [...], access_level: 'user', user_id: userId };
}

app.listen(8080, () => {
  console.log('MCP服务器运行在 http://localhost:8080');
});
```

---

## 🔍 调试技巧

### 1. 查看 LibreChat 日志

```bash
# 查看后端日志
tail -f api/logs/*.log
```

查找包含 MCP 请求的日志条目。

### 2. 查看浏览器开发者工具

1. 打开浏览器开发者工具 (F12)
2. 切换到 Network 标签
3. 筛选 XHR/Fetch 请求
4. 查找到 MCP 服务器的请求
5. 检查请求头是否包含正确的用户信息

### 3. 使用 curl 模拟请求

```bash
# 模拟管理员请求
curl -X GET http://localhost:8080/sse \
  -H "X-User-Role: ADMIN" \
  -H "X-User-Email: admin@test.com" \
  -H "X-User-ID: 507f1f77bcf86cd799439011"

# 模拟普通用户请求
curl -X GET http://localhost:8080/sse \
  -H "X-User-Role: USER" \
  -H "X-User-Email: user1@test.com" \
  -H "X-User-ID: 507f1f77bcf86cd799439012"
```

### 4. 添加 MCP 服务器日志

在 MCP 服务器端添加详细日志：

```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.get("/sse")
async def mcp_endpoint(
    x_user_role: Optional[str] = Header(None),
    x_user_email: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    logger.info(f"=== MCP 请求 ===")
    logger.info(f"角色: {x_user_role}")
    logger.info(f"邮箱: {x_user_email}")
    logger.info(f"用户ID: {x_user_id}")
    logger.info(f"===============")
    
    # ... 权限控制逻辑
```

---

## ✅ 测试检查清单

### 配置检查
- [ ] librechat.yaml 中 MCP 服务器配置正确
- [ ] MCP 服务器 URL 可访问
- [ ] headers 模板变量配置正确

### 用户创建
- [ ] 管理员用户创建成功（role=ADMIN）
- [ ] 普通用户1创建成功（role=USER）
- [ ] 普通用户2创建成功（role=USER）

### 权限测试
- [ ] 管理员能访问所有数据
- [ ] 普通用户只能访问自己的数据
- [ ] 不同普通用户之间数据隔离

### 请求头传递
- [ ] X-User-Role 正确传递
- [ ] X-User-Email 正确传递
- [ ] X-User-ID 正确传递

---

## 🐛 常见问题

### Q1: 用户创建后角色不正确？

**解决方案：**
```bash
# 手动更新用户角色
node config/setup-test-users.js
```

或使用 MongoDB 命令：
```javascript
db.users.updateOne(
  { email: "admin@test.com" },
  { $set: { role: "ADMIN" } }
)
```

### Q2: MCP 服务器收不到请求头？

**检查项：**
1. 确认 librechat.yaml 中的 headers 配置正确
2. 检查 MCP 服务器是否正确解析请求头（注意大小写）
3. 查看 LibreChat 日志是否有错误

### Q3: 所有用户看到的数据都一样？

**原因：** MCP 服务器端未实现权限控制

**解决方案：** 在 MCP 服务器端根据 `X-User-Role` 和 `X-User-ID` 进行数据过滤

---

## 📚 相关文档

- [LibreChat MCP 配置文档](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers)
- [Model Context Protocol 规范](https://modelcontextprotocol.io/)
- [LibreChat 角色权限系统](https://www.librechat.ai/docs/configuration/roles)

---

## 💡 最佳实践

1. **在 MCP 服务器端始终验证用户信息**
   - 不要仅依赖请求头，做好安全防护
   - 对敏感操作添加额外验证

2. **记录详细的访问日志**
   - 记录谁、何时、访问了什么数据
   - 便于审计和故障排查

3. **实现细粒度权限控制**
   - 不仅区分 ADMIN/USER
   - 可以根据业务需求添加更多角色

4. **定期审查权限配置**
   - 检查用户角色分配是否合理
   - 验证数据隔离是否有效

---

## 📞 需要帮助？

如果遇到问题，请检查：
1. LibreChat 服务是否正常运行
2. MCP 服务器是否正常运行
3. 网络连接是否正常
4. 配置文件是否正确

祝测试顺利！🎉
