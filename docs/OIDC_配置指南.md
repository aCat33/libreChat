# OpenID Connect (OIDC) 登录配置指南

## 📋 配置步骤

### 1. 选择您的身份提供商

LibreChat 支持任何符合 OIDC 标准的身份提供商,包括:

- **Azure AD / Microsoft Entra ID**
- **Keycloak**
- **Auth0**
- **Okta**
- **Google Identity Platform**
- **自建 OIDC 服务器**

---

## 🔧 常见身份提供商配置示例

### Azure AD (Microsoft Entra ID)

```bash
# 1. 在 Azure Portal 注册应用
# 2. 获取以下信息:

OPENID_CLIENT_ID=your-application-client-id
OPENID_CLIENT_SECRET=your-client-secret-value
OPENID_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0
OPENID_SESSION_SECRET=your-random-32-byte-hex
OPENID_SCOPE="openid profile email"
OPENID_CALLBACK_URL=/oauth/openid/callback
OPENID_USE_PKCE=true

# 可选:用户名和显示名称映射
OPENID_USERNAME_CLAIM=preferred_username
OPENID_NAME_CLAIM=name

# 可选:角色控制
OPENID_REQUIRED_ROLE=LibreChat-User
OPENID_REQUIRED_ROLE_TOKEN_KIND=id_token
OPENID_REQUIRED_ROLE_PARAMETER_PATH=roles

OPENID_ADMIN_ROLE=LibreChat-Admin
OPENID_ADMIN_ROLE_TOKEN_KIND=id_token
OPENID_ADMIN_ROLE_PARAMETER_PATH=roles

# 按钮显示
OPENID_BUTTON_LABEL=使用 Microsoft 登录
```

**Azure AD 配置步骤:**
1. 访问 [Azure Portal](https://portal.azure.com)
2. 进入 "Azure Active Directory" → "应用注册" → "新注册"
3. 设置重定向 URI: `http://localhost:3080/oauth/openid/callback` (开发环境)
4. 生成客户端密钥: "证书和密钥" → "新客户端密钥"
5. 获取租户 ID: "概述" 页面
6. API 权限: 添加 `openid`, `profile`, `email`

---

### Keycloak

```bash
# 1. 在 Keycloak 中创建 Realm 和 Client
# 2. 配置:

OPENID_CLIENT_ID=librechat
OPENID_CLIENT_SECRET=your-keycloak-client-secret
OPENID_ISSUER=https://your-keycloak-domain/realms/your-realm
OPENID_SESSION_SECRET=your-random-32-byte-hex
OPENID_SCOPE="openid profile email"
OPENID_CALLBACK_URL=/oauth/openid/callback
OPENID_USE_PKCE=true

# 用户信息映射
OPENID_USERNAME_CLAIM=preferred_username
OPENID_NAME_CLAIM=name

# 按钮显示
OPENID_BUTTON_LABEL=企业登录
```

**Keycloak 配置步骤:**
1. 创建新的 Realm (或使用现有的)
2. 创建新 Client:
   - Client ID: `librechat`
   - Client Protocol: `openid-connect`
   - Access Type: `confidential`
   - Valid Redirect URIs: `http://localhost:3080/oauth/openid/callback`
3. 在 "Credentials" 标签获取 Client Secret
4. 在 Client Scopes 中确保包含 `openid`, `profile`, `email`

---

### Auth0

```bash
OPENID_CLIENT_ID=your-auth0-client-id
OPENID_CLIENT_SECRET=your-auth0-client-secret
OPENID_ISSUER=https://your-domain.auth0.com
OPENID_SESSION_SECRET=your-random-32-byte-hex
OPENID_SCOPE="openid profile email"
OPENID_CALLBACK_URL=/oauth/openid/callback
OPENID_USE_PKCE=true

# 按钮显示
OPENID_BUTTON_LABEL=使用 Auth0 登录
```

**Auth0 配置步骤:**
1. 在 Auth0 Dashboard 创建新应用 (Regular Web Application)
2. 在 Settings 中配置:
   - Allowed Callback URLs: `http://localhost:3080/oauth/openid/callback`
   - Allowed Logout URLs: `http://localhost:3080`
3. 复制 Domain, Client ID, Client Secret

---

### Okta

```bash
OPENID_CLIENT_ID=your-okta-client-id
OPENID_CLIENT_SECRET=your-okta-client-secret
OPENID_ISSUER=https://your-domain.okta.com
OPENID_SESSION_SECRET=your-random-32-byte-hex
OPENID_SCOPE="openid profile email"
OPENID_CALLBACK_URL=/oauth/openid/callback
OPENID_USE_PKCE=true

# 按钮显示
OPENID_BUTTON_LABEL=使用 Okta 登录
```

---

## 🔐 生成 SESSION_SECRET

使用 Node.js 生成安全的 session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

复制生成的字符串到 `OPENID_SESSION_SECRET`

---

## 🎨 自定义登录界面

### 设置登录按钮文本和图标

```bash
# 按钮显示文本
OPENID_BUTTON_LABEL=企业登录

# 按钮图标 (可选,使用公共 URL 或本地路径)
OPENID_IMAGE_URL=https://your-domain.com/logo.png
# 或使用本地文件: OPENID_IMAGE_URL=/assets/company-logo.png
```

### 自动重定向到 OIDC (仅单一登录方式时使用)

```bash
# 警告: 启用后将跳过登录表单,直接跳转到 OIDC 提供商
OPENID_AUTO_REDIRECT=true
```

---

## 👥 角色和权限控制

### 限制特定角色才能访问

```bash
# 要求用户必须具有特定角色
OPENID_REQUIRED_ROLE=LibreChat-User
OPENID_REQUIRED_ROLE_TOKEN_KIND=id_token
OPENID_REQUIRED_ROLE_PARAMETER_PATH=roles

# 示例: Azure AD 中 roles 数组包含 "LibreChat-User"
# Token 示例: { "roles": ["LibreChat-User", "Other-Role"] }
```

### 设置管理员角色

```bash
# 具有此角色的用户将成为系统管理员
OPENID_ADMIN_ROLE=LibreChat-Admin
OPENID_ADMIN_ROLE_TOKEN_KIND=id_token
OPENID_ADMIN_ROLE_PARAMETER_PATH=roles
```

### 角色路径说明

`OPENID_REQUIRED_ROLE_PARAMETER_PATH` 使用点号表示法访问 token 中的嵌套属性:

```bash
# Token: { "resource_access": { "librechat": { "roles": ["user"] } } }
OPENID_REQUIRED_ROLE_PARAMETER_PATH=resource_access.librechat.roles

# Token: { "realm_access": { "roles": ["user"] } }
OPENID_REQUIRED_ROLE_PARAMETER_PATH=realm_access.roles

# Token: { "roles": ["user"] }
OPENID_REQUIRED_ROLE_PARAMETER_PATH=roles
```

---

## 🔧 高级配置选项

### PKCE (Proof Key for Code Exchange)

```bash
# 推荐启用,提高安全性,防止授权码拦截攻击
OPENID_USE_PKCE=true
```

### Token 重用

```bash
# 使用 OIDC token 而不是 MongoDB session
OPENID_REUSE_TOKENS=true
```

### JWKS 缓存

```bash
# 启用签名密钥缓存 (默认: true)
OPENID_JWKS_URL_CACHE_ENABLED=true
# 缓存时间 (毫秒,默认: 600000 = 10分钟)
OPENID_JWKS_URL_CACHE_TIME=600000
```

### 代表流 (On-Behalf-Of Flow)

```bash
# 用于需要额外 token 交换的场景 (如 Microsoft Graph API)
OPENID_ON_BEHALF_FLOW_FOR_USERINFO_REQUIRED=true
OPENID_ON_BEHALF_FLOW_USERINFO_SCOPE="user.read"
```

### 登出配置

```bash
# 使用 OIDC 提供商的登出端点
OPENID_USE_END_SESSION_ENDPOINT=true
# 登出后重定向地址
OPENID_POST_LOGOUT_REDIRECT_URI=http://localhost:3080/login
```

### 用户信息映射

```bash
# 自定义用户名字段 (默认: sub)
OPENID_USERNAME_CLAIM=preferred_username

# 自定义显示名称字段 (默认: name)
OPENID_NAME_CLAIM=name

# 常见的 claim:
# - sub: 唯一标识符
# - email: 邮箱地址
# - preferred_username: 首选用户名
# - name: 完整姓名
# - given_name: 名字
# - family_name: 姓氏
```

### Audience 参数

```bash
# 某些提供商需要 audience 参数
OPENID_AUDIENCE=api://librechat
```

---

## 🌐 生产环境配置

### 更新域名和回调 URL

```bash
# 开发环境
DOMAIN_CLIENT=http://localhost:3080
DOMAIN_SERVER=http://localhost:3080

# 生产环境
DOMAIN_CLIENT=https://librechat.your-company.com
DOMAIN_SERVER=https://librechat.your-company.com

# OIDC 回调 URL 不需要修改,会自动使用 DOMAIN_CLIENT
OPENID_CALLBACK_URL=/oauth/openid/callback
```

### 在 OIDC 提供商中更新回调 URL

生产环境回调 URL 示例:
- `https://librechat.your-company.com/oauth/openid/callback`

---

## 🚀 启动和测试

### 1. 检查配置

确保 `.env` 文件中所有必需的 OIDC 参数已填写:
- ✅ `ALLOW_SOCIAL_LOGIN=true`
- ✅ `OPENID_CLIENT_ID`
- ✅ `OPENID_CLIENT_SECRET`
- ✅ `OPENID_ISSUER`
- ✅ `OPENID_SESSION_SECRET`

### 2. 重启服务

```bash
# 如果使用 Docker
docker-compose down
docker-compose up -d

# 如果本地运行
npm run backend  # 在一个终端
npm run frontend # 在另一个终端
```

### 3. 测试登录

1. 访问 `http://localhost:3080`
2. 应该看到自定义的 OIDC 登录按钮
3. 点击按钮,将重定向到您的 OIDC 提供商
4. 登录后应自动重定向回 LibreChat

### 4. 调试

启用调试日志查看详细信息:

```bash
DEBUG_OPENID_REQUESTS=true
DEBUG_LOGGING=true
```

---

## 🔍 常见问题

### 问题: 重定向 URI 不匹配

**解决方案:**
- 确保 OIDC 提供商中配置的重定向 URI 与 `${DOMAIN_CLIENT}${OPENID_CALLBACK_URL}` 完全一致
- 注意 http/https 和尾部斜杠

### 问题: 无法获取用户信息

**解决方案:**
- 检查 `OPENID_SCOPE` 是否包含必要的 scopes
- 某些提供商可能需要额外配置,如启用 `OPENID_ON_BEHALF_FLOW_FOR_USERINFO_REQUIRED`

### 问题: Token 验证失败

**解决方案:**
- 检查 `OPENID_ISSUER` 是否正确
- 确认 OIDC 提供商的 `/.well-known/openid-configuration` 端点可访问

### 问题: 角色检查不生效

**解决方案:**
- 检查 `OPENID_REQUIRED_ROLE_PARAMETER_PATH` 路径是否正确
- 使用 JWT 解码工具查看 token 结构,确认 roles 字段位置

---

## 📚 参考资源

- [LibreChat 官方文档](https://www.librechat.ai/docs/configuration/authentication/oauth)
- [OpenID Connect 规范](https://openid.net/connect/)
- [OAuth 2.0 规范](https://oauth.net/2/)
- [PKCE 规范](https://oauth.net/2/pkce/)

---

## 💡 最佳实践

1. **安全性:**
   - ✅ 始终使用 HTTPS (生产环境)
   - ✅ 启用 PKCE: `OPENID_USE_PKCE=true`
   - ✅ 使用强随机 SESSION_SECRET
   - ✅ 定期轮换 client secrets

2. **用户体验:**
   - ✅ 设置清晰的按钮标签: `OPENID_BUTTON_LABEL`
   - ✅ 添加公司 logo: `OPENID_IMAGE_URL`
   - ✅ 仅在单一登录方式时使用自动重定向

3. **权限管理:**
   - ✅ 使用角色控制访问: `OPENID_REQUIRED_ROLE`
   - ✅ 明确定义管理员角色: `OPENID_ADMIN_ROLE`
   - ✅ 定期审查用户权限

4. **监控和日志:**
   - ✅ 开发环境启用 `DEBUG_OPENID_REQUESTS=true`
   - ✅ 生产环境关闭调试,启用错误日志
   - ✅ 监控登录失败率

---

配置完成后,您的企业用户可以使用统一的身份提供商登录 LibreChat! 🎉
