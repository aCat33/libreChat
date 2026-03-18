# OIDC 企业登录测试指南

本指南提供三种测试 OIDC 集成的方法，从简单到完整的企业场景。

---

## 🚀 方案一：使用本地 Keycloak (推荐用于完整测试)

### 优点
- ✅ 完全本地控制，无需外部服务
- ✅ 预配置好的测试用户和角色
- ✅ 模拟真实企业环境
- ✅ 支持角色管理、用户组等企业功能

### 步骤

#### 1️⃣ 启动 Keycloak 测试环境

```bash
# 启动 Keycloak 容器
docker-compose -f docker-compose.keycloak-test.yml up -d

# 等待 Keycloak 完全启动 (约 1-2 分钟)
# 查看日志确认启动
docker logs librechat-keycloak -f
```

看到 `Keycloak 23.0 started` 表示启动成功。

#### 2️⃣ 访问 Keycloak 管理控制台

- **URL**: http://localhost:8080
- **管理员账号**: `admin`
- **管理员密码**: `admin`

#### 3️⃣ 配置 LibreChat `.env` 文件

在您的 `.env` 文件中添加/修改以下配置：

```bash
# 启用社交登录
ALLOW_SOCIAL_LOGIN=true
ALLOW_SOCIAL_REGISTRATION=true

# Keycloak OIDC 配置
OPENID_CLIENT_ID=librechat
OPENID_CLIENT_SECRET=librechat-test-secret-12345
OPENID_ISSUER=http://localhost:8080/realms/librechat-test
OPENID_SESSION_SECRET=your-generated-session-secret-here
OPENID_SCOPE="openid profile email roles"
OPENID_CALLBACK_URL=/oauth/openid/callback
OPENID_USE_PKCE=true

# 角色控制 (可选)
# OPENID_REQUIRED_ROLE=user
# OPENID_REQUIRED_ROLE_TOKEN_KIND=id_token
# OPENID_REQUIRED_ROLE_PARAMETER_PATH=roles

# OPENID_ADMIN_ROLE=admin
# OPENID_ADMIN_ROLE_TOKEN_KIND=id_token
# OPENID_ADMIN_ROLE_PARAMETER_PATH=roles

# 按钮显示
OPENID_BUTTON_LABEL=企业登录 (Keycloak)

# 调试 (开发环境可启用)
DEBUG_OPENID_REQUESTS=true
```

#### 4️⃣ 重启 LibreChat

```bash
# 如果使用 Docker
docker-compose restart

# 如果本地运行
# 停止当前服务，然后重新启动
npm run backend
```

#### 5️⃣ 测试登录

访问 http://localhost:3080，使用以下测试账号：

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| `admin` | `admin123` | admin | 管理员账号 |
| `user1` | `user123` | user | 普通用户 - 张三 |
| `user2` | `user123` | user | 普通用户 - 李四 |
| `manager` | `manager123` | user, manager | 经理 - 王五 |

#### 6️⃣ 停止测试环境

```bash
# 停止 Keycloak
docker-compose -f docker-compose.keycloak-test.yml down

# 删除数据 (如需重置)
docker-compose -f docker-compose.keycloak-test.yml down -v
```

---

## 🌐 方案二：使用 Google OIDC (最快速)

### 优点
- ✅ 5分钟内可完成配置
- ✅ 使用真实的 Google 账号
- ✅ 无需额外服务器

### 步骤

#### 1️⃣ 创建 Google OAuth 2.0 应用

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 **Google+ API**
4. 进入 **凭据** → **创建凭据** → **OAuth 2.0 客户端 ID**
5. 应用类型选择 **Web 应用**
6. 配置：
   - **已获授权的 JavaScript 来源**: `http://localhost:3080`
   - **已获授权的重定向 URI**: `http://localhost:3080/oauth/openid/callback`

#### 2️⃣ 配置 `.env`

```bash
ALLOW_SOCIAL_LOGIN=true
ALLOW_SOCIAL_REGISTRATION=true

OPENID_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
OPENID_CLIENT_SECRET=your-google-client-secret
OPENID_ISSUER=https://accounts.google.com
OPENID_SESSION_SECRET=your-generated-session-secret
OPENID_SCOPE="openid profile email"
OPENID_CALLBACK_URL=/oauth/openid/callback
OPENID_USE_PKCE=true

OPENID_BUTTON_LABEL=使用 Google 登录
```

#### 3️⃣ 测试

使用任何 Google 账号登录即可。

---

## 🔧 方案三：使用 Auth0 免费层

### 优点
- ✅ 专业的企业级身份管理平台
- ✅ 免费层支持 7000 活跃用户
- ✅ 提供完整的用户管理界面

### 步骤

#### 1️⃣ 注册 Auth0

1. 访问 [Auth0](https://auth0.com/) 并注册免费账号
2. 创建新的 **Application** (Regular Web Application)

#### 2️⃣ 配置 Application

在 Auth0 Dashboard 中:
- **Allowed Callback URLs**: `http://localhost:3080/oauth/openid/callback`
- **Allowed Logout URLs**: `http://localhost:3080`
- **Allowed Web Origins**: `http://localhost:3080`

#### 3️⃣ 创建测试用户

在 Auth0 Dashboard → Users & Roles → Users 中创建测试用户。

#### 4️⃣ 配置 `.env`

```bash
ALLOW_SOCIAL_LOGIN=true
ALLOW_SOCIAL_REGISTRATION=true

OPENID_CLIENT_ID=your-auth0-client-id
OPENID_CLIENT_SECRET=your-auth0-client-secret
OPENID_ISSUER=https://your-tenant.auth0.com
OPENID_SESSION_SECRET=your-generated-session-secret
OPENID_SCOPE="openid profile email"
OPENID_CALLBACK_URL=/oauth/openid/callback
OPENID_USE_PKCE=true

OPENID_BUTTON_LABEL=企业登录 (Auth0)
```

---

## 🧪 测试场景和验证点

### 基本功能测试

- [ ] 登录页面显示 OIDC 登录按钮
- [ ] 点击按钮正确重定向到 OIDC 提供商
- [ ] 成功登录后返回 LibreChat
- [ ] 用户信息正确显示 (姓名、邮箱)
- [ ] 登出功能正常工作

### 角色和权限测试 (Keycloak)

启用角色配置后测试:

```bash
# 在 .env 中启用
OPENID_REQUIRED_ROLE=user
OPENID_REQUIRED_ROLE_TOKEN_KIND=id_token
OPENID_REQUIRED_ROLE_PARAMETER_PATH=roles

OPENID_ADMIN_ROLE=admin
OPENID_ADMIN_ROLE_TOKEN_KIND=id_token
OPENID_ADMIN_ROLE_PARAMETER_PATH=roles
```

测试：
- [ ] 有 `user` 角色的用户可以登录
- [ ] 没有 `user` 角色的用户被拒绝
- [ ] 有 `admin` 角色的用户拥有管理员权限

### 会话管理测试

- [ ] Token 刷新正常工作
- [ ] 会话过期后要求重新登录
- [ ] 登出后无法访问受保护资源

---

## 🔍 调试技巧

### 启用详细日志

在 `.env` 中:
```bash
DEBUG_OPENID_REQUESTS=true
DEBUG_LOGGING=true
```

### 查看 Token 内容

使用 [JWT.io](https://jwt.io/) 解码 token，检查：
- `iss` (issuer): 是否匹配 `OPENID_ISSUER`
- `aud` (audience): 是否匹配 `OPENID_CLIENT_ID`
- `sub` (subject): 用户唯一标识
- `roles` 或其他自定义 claims

### 常见错误

#### ❌ "redirect_uri_mismatch"
- **原因**: 回调 URL 不匹配
- **解决**: 确保 OIDC 提供商配置的 redirect_uri 与 `${DOMAIN_CLIENT}${OPENID_CALLBACK_URL}` 完全一致

#### ❌ "invalid_client"
- **原因**: Client ID 或 Secret 错误
- **解决**: 检查 `OPENID_CLIENT_ID` 和 `OPENID_CLIENT_SECRET`

#### ❌ "issuer mismatch"
- **原因**: Issuer URL 不匹配
- **解决**: 检查 `OPENID_ISSUER`，确保没有尾部斜杠

#### ❌ 用户信息为空
- **原因**: Scope 不正确或缺少必要的 claims
- **解决**: 确保 `OPENID_SCOPE` 包含 `openid profile email`

---

## 📊 性能和安全建议

### 开发环境
```bash
OPENID_USE_PKCE=true
DEBUG_OPENID_REQUESTS=true
OPENID_JWKS_URL_CACHE_ENABLED=true
```

### 生产环境
```bash
OPENID_USE_PKCE=true
DEBUG_OPENID_REQUESTS=false  # 关闭调试
OPENID_JWKS_URL_CACHE_ENABLED=true
OPENID_JWKS_URL_CACHE_TIME=600000
OPENID_USE_END_SESSION_ENDPOINT=true
```

---

## 🎯 推荐测试流程

1. **第一步**: 使用 Keycloak 本地测试 (5 分钟设置)
2. **第二步**: 测试所有功能和角色控制
3. **第三步**: 集成到实际的企业身份提供商
4. **第四步**: 进行压力测试和安全审计

---

## 📞 需要帮助？

如果遇到问题：
1. 检查 LibreChat 后端日志
2. 检查 Keycloak 日志: `docker logs librechat-keycloak`
3. 使用浏览器开发者工具查看网络请求
4. 参考 [LibreChat 官方文档](https://www.librechat.ai/docs)

Happy Testing! 🚀
