# 本地测试 OIDC 登录快速指南

适用于前端本地化部署，无需 Docker。

---

## 🚀 方案一：Google OIDC (推荐 - 最快5分钟)

### 步骤

#### 1️⃣ 创建 Google OAuth 2.0 凭据

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 登录您的 Google 账号
3. 创建新项目 (或选择现有项目)
   - 项目名称: `LibreChat-Test`
4. 在左侧菜单选择 **API 和服务** → **凭据**
5. 点击 **创建凭据** → **OAuth 2.0 客户端 ID**
6. 如果是首次创建，需要先配置同意屏幕：
   - 用户类型: **外部**
   - 应用名称: `LibreChat Test`
   - 用户支持电子邮件: 您的邮箱
   - 开发者联系信息: 您的邮箱
   - 保存并继续
7. 返回创建 OAuth 客户端 ID：
   - 应用类型: **Web 应用**
   - 名称: `LibreChat`
   - 已获授权的 JavaScript 来源: `http://localhost:3080`
   - 已获授权的重定向 URI: `http://localhost:3080/oauth/openid/callback`
   - 点击创建

#### 2️⃣ 获取凭据

创建成功后会显示：
- **客户端 ID** (格式: `xxx.apps.googleusercontent.com`)
- **客户端密钥**

#### 3️⃣ 配置 .env 文件

将凭据填入 `.env` 文件（我已经为您准备好了模板）：

```bash
OPENID_CLIENT_ID=您的客户端ID.apps.googleusercontent.com
OPENID_CLIENT_SECRET=您的客户端密钥
OPENID_ISSUER=https://accounts.google.com
OPENID_SESSION_SECRET=001bda89feb98935b28f16ac241063b733d2b2f8c2ff622575e6d02d51b4dd93
OPENID_SCOPE="openid profile email"
OPENID_CALLBACK_URL=/oauth/openid/callback
OPENID_USE_PKCE=true
OPENID_BUTTON_LABEL=使用 Google 登录
```

#### 4️⃣ 重启服务

```bash
# 停止当前运行的后端 (Ctrl+C)
# 然后重新启动
npm run backend
```

#### 5️⃣ 测试登录

1. 访问 http://localhost:3080
2. 点击 "使用 Google 登录" 按钮
3. 使用任何 Google 账号登录
4. 登录成功后会返回 LibreChat

---

## 🌐 方案二：使用公开的 OIDC 测试服务器

如果您不想创建 Google 凭据，可以使用测试服务器。

### Keycloak 公开演示实例

一些组织提供公开的 Keycloak 测试实例，但需要自己注册。不推荐用于生产。

---

## 📱 方案三：GitHub OAuth (也很简单)

### 步骤

#### 1️⃣ 创建 GitHub OAuth App

1. 访问 https://github.com/settings/developers
2. 点击 **New OAuth App**
3. 填写信息：
   - **Application name**: LibreChat Test
   - **Homepage URL**: http://localhost:3080
   - **Authorization callback URL**: http://localhost:3080/oauth/github/callback
4. 点击 **Register application**
5. 生成 **Client secret**

#### 2️⃣ 配置 .env

```bash
# 启用社交登录
ALLOW_SOCIAL_LOGIN=true
ALLOW_SOCIAL_REGISTRATION=true

# GitHub (不是 OIDC，但也能测试 OAuth)
GITHUB_CLIENT_ID=你的GitHub客户端ID
GITHUB_CLIENT_SECRET=你的GitHub客户端密钥
GITHUB_CALLBACK_URL=/oauth/github/callback
```

但注意：GitHub 使用的是 OAuth 2.0，不是标准的 OIDC。

---

## 🧪 方案四：使用 Auth0 免费层

### 优点
- ✅ 专业的企业级身份管理
- ✅ 免费支持 7000 活跃用户
- ✅ 完整的用户管理界面
- ✅ 支持自定义域名、角色等

### 步骤

#### 1️⃣ 注册 Auth0

1. 访问 https://auth0.com/
2. 点击 **Sign Up** 注册免费账号
3. 选择您的地区（建议选择亚太区域）
4. 创建租户（Tenant）

#### 2️⃣ 创建应用

1. 在 Auth0 Dashboard，点击 **Applications** → **Create Application**
2. 应用名称: `LibreChat`
3. 应用类型: **Regular Web Applications**
4. 点击创建

#### 3️⃣ 配置应用

在应用设置页面：
- **Allowed Callback URLs**: `http://localhost:3080/oauth/openid/callback`
- **Allowed Logout URLs**: `http://localhost:3080`
- **Allowed Web Origins**: `http://localhost:3080`
- 保存更改

#### 4️⃣ 获取凭据

在应用的 **Settings** 标签:
- **Domain**: `your-tenant.auth0.com`
- **Client ID**: 复制
- **Client Secret**: 复制

#### 5️⃣ 创建测试用户

1. 在 Auth0 Dashboard，点击 **User Management** → **Users**
2. 点击 **Create User**
3. 填写邮箱和密码（用于测试）

#### 6️⃣ 配置 .env

```bash
OPENID_CLIENT_ID=你的Auth0客户端ID
OPENID_CLIENT_SECRET=你的Auth0客户端密钥
OPENID_ISSUER=https://your-tenant.auth0.com
OPENID_SESSION_SECRET=001bda89feb98935b28f16ac241063b733d2b2f8c2ff622575e6d02d51b4dd93
OPENID_SCOPE="openid profile email"
OPENID_CALLBACK_URL=/oauth/openid/callback
OPENID_USE_PKCE=true
OPENID_BUTTON_LABEL=企业登录
```

---

## 🔍 测试清单

测试登录功能时，检查以下项目：

- [ ] 登录页面显示 OIDC 登录按钮
- [ ] 点击按钮正确重定向到身份提供商
- [ ] 成功登录后返回 LibreChat
- [ ] 用户信息正确显示（姓名、邮箱、头像）
- [ ] 可以正常使用聊天功能
- [ ] 登出功能正常
- [ ] 重新登录可以恢复会话

---

## 🐛 调试技巧

### 启用详细日志

在 `.env` 中已经启用了：
```bash
DEBUG_OPENID_REQUESTS=true
DEBUG_LOGGING=true
```

### 查看后端日志

运行 `npm run backend` 时，注意看控制台输出。

### 常见错误

#### ❌ redirect_uri_mismatch
**原因**: 回调 URL 不匹配  
**解决**: 确保身份提供商配置的 redirect_uri 是 `http://localhost:3080/oauth/openid/callback`

#### ❌ Invalid credentials
**原因**: Client ID 或 Secret 错误  
**解决**: 检查复制的凭据是否正确，注意前后空格

#### ❌ CORS 错误
**原因**: 跨域配置问题  
**解决**: 确保在身份提供商配置了正确的 Web Origins

---

## 💡 推荐方案

**对于本地测试，我推荐按优先级：**

1. **Google OIDC** ⭐⭐⭐⭐⭐
   - 最快速（5分钟）
   - 无需创建测试用户
   - 使用自己的 Google 账号即可

2. **Auth0** ⭐⭐⭐⭐
   - 功能完整
   - 企业级功能（角色、权限等）
   - 需要注册和配置（10分钟）

3. **GitHub OAuth** ⭐⭐⭐
   - 简单快速
   - 但不是标准 OIDC（功能受限）

---

## 📝 配置完成后

1. 重启后端: `npm run backend`
2. 访问: http://localhost:3080
3. 点击登录按钮测试

---

**选择哪个方案？我建议从 Google OIDC 开始！** 🚀

需要帮助配置某个具体方案吗？
