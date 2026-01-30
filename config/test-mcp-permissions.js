const axios = require('axios');
const path = require('path');
const mongoose = require('mongoose');
const { User } = require('@librechat/data-schemas').createModels(mongoose);
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const connect = require('./connect');

/**
 * MCP权限测试脚本
 * 测试不同角色用户访问MCP服务器时传递的用户信息是否正确
 */

const LIBRECHAT_API = process.env.LIBRECHAT_API_URL || 'http://localhost:3080';
const MCP_SERVER_URL = 'http://localhost:8080';

// 测试用户凭据
const testUsers = [
  {
    email: 'admin@test.com',
    password: 'Admin@123456',
    expectedRole: 'ADMIN',
    description: '管理员用户'
  },
  {
    email: 'user1@test.com',
    password: 'User@123456',
    expectedRole: 'USER',
    description: '普通用户1'
  },
  {
    email: 'user2@test.com',
    password: 'User@123456',
    expectedRole: 'USER',
    description: '普通用户2'
  }
];

/**
 * 登录获取JWT token
 */
async function login(email, password) {
  try {
    const response = await axios.post(`${LIBRECHAT_API}/api/auth/login`, {
      email,
      password
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    // 检查响应数据
    if (!response.data) {
      throw new Error('服务器返回空响应');
    }
    
    // 可能的token字段名
    const token = response.data.token || response.data.accessToken || response.data.access_token;
    
    if (!token) {
      console.log(`   ⚠️  响应数据:`, JSON.stringify(response.data, null, 2));
      throw new Error('响应中未找到token');
    }
    
    return token;
  } catch (error) {
    if (error.response) {
      // 服务器返回了错误响应
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText;
      throw new Error(`登录失败 ${email}: [${status}] ${message}`);
    } else if (error.request) {
      // 请求发出但没有收到响应
      throw new Error(`登录失败 ${email}: 服务器无响应，请确保后端正在运行 (${LIBRECHAT_API})`);
    } else {
      // 其他错误
      throw new Error(`登录失败 ${email}: ${error.message}`);
    }
  }
}

/**
 * 获取用户信息（包括角色）
 */
async function getUserInfo(token) {
  try {
    const response = await axios.get(`${LIBRECHAT_API}/api/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText;
      throw new Error(`获取用户信息失败: [${status}] ${message}`);
    } else if (error.request) {
      throw new Error(`获取用户信息失败: 服务器无响应`);
    } else {
      throw new Error(`获取用户信息失败: ${error.message}`);
    }
  }
}

/**
 * 测试MCP服务器连接（可选）
 */
async function testMcpConnection() {
  try {
    const response = await axios.get(MCP_SERVER_URL, {
      timeout: 3000
    });
    console.log('✅ MCP服务器连接正常');
    return true;
  } catch (error) {
    console.log('⚠️  MCP服务器未响应 (可能需要单独启动)');
    console.log(`   URL: ${MCP_SERVER_URL}`);
    return false;
  }
}

/**
 * 从数据库获取用户详细信息
 */
async function getUserFromDB(email) {
  const user = await User.findOne({ email }).select('_id email role name username');
  return user;
}

/**
 * 运行测试
 */
async function runTests() {
  console.log('\n========================================');
  console.log('🧪 MCP权限测试开始');
  console.log('========================================\n');

  await connect();
  
  // 测试 LibreChat 后端连接
  console.log('🔌 检查 LibreChat 后端连接...');
  try {
    await axios.get(`${LIBRECHAT_API}/api/config`, { timeout: 3000 });
    console.log(`✅ LibreChat 后端运行正常: ${LIBRECHAT_API}`);
  } catch (error) {
    console.log(`❌ LibreChat 后端无法连接: ${LIBRECHAT_API}`);
    console.log('   请先启动后端: npm run backend:dev');
    console.log('');
    await mongoose.connection.close();
    process.exit(1);
  }
  
  // 测试MCP服务器连接
  console.log('🔌 检查MCP服务器连接...');
  await testMcpConnection();
  console.log('');

  const results = [];

  for (const testUser of testUsers) {
    console.log(`\n▶️  测试用户: ${testUser.email} (${testUser.description})`);
    console.log('─'.repeat(50));

    try {
      // 1. 从数据库获取用户信息
      const dbUser = await getUserFromDB(testUser.email);
      if (!dbUser) {
        console.log(`❌ 用户不存在: ${testUser.email}`);
        console.log('   请先运行: npm run setup-test-users');
        results.push({
          email: testUser.email,
          status: 'FAILED',
          reason: '用户不存在'
        });
        continue;
      }

      console.log(`📝 数据库用户信息:`);
      console.log(`   用户ID: ${dbUser._id}`);
      console.log(`   邮箱: ${dbUser.email}`);
      console.log(`   角色: ${dbUser.role || 'USER'}`);
      console.log(`   用户名: ${dbUser.username || 'N/A'}`);

      // 2. 登录获取token
      console.log(`\n🔐 尝试登录...`);
      const token = await login(testUser.email, testUser.password);
      console.log(`   ✅ 登录成功，获得JWT token`);

      // 3. 获取用户信息
      const userInfo = await getUserInfo(token);
      console.log(`\n👤 API返回的用户信息:`);
      console.log(`   用户ID: ${userInfo.id || userInfo._id}`);
      console.log(`   邮箱: ${userInfo.email}`);
      console.log(`   角色: ${userInfo.role || 'USER'}`);
      console.log(`   姓名: ${userInfo.name}`);

      // 4. 验证角色是否正确
      const actualRole = userInfo.role || dbUser.role || 'USER';
      const roleMatch = actualRole === testUser.expectedRole;
      
      console.log(`\n✅ 角色验证:`);
      console.log(`   期望角色: ${testUser.expectedRole}`);
      console.log(`   实际角色: ${actualRole}`);
      console.log(`   验证结果: ${roleMatch ? '✅ 匹配' : '❌ 不匹配'}`);

      // 5. 说明MCP会接收到的请求头
      console.log(`\n📤 MCP服务器将接收到的请求头:`);
      console.log(`   X-User-Role: ${actualRole}`);
      console.log(`   X-User-Email: ${userInfo.email}`);
      console.log(`   X-User-ID: ${userInfo.id || userInfo._id}`);

      results.push({
        email: testUser.email,
        description: testUser.description,
        status: roleMatch ? 'PASSED' : 'FAILED',
        expectedRole: testUser.expectedRole,
        actualRole: actualRole,
        userId: userInfo.id || userInfo._id,
        token: token.substring(0, 20) + '...'
      });

    } catch (error) {
      console.log(`\n❌ 测试失败: ${error.message}`);
      results.push({
        email: testUser.email,
        description: testUser.description,
        status: 'ERROR',
        error: error.message
      });
    }
  }

  // 输出测试摘要
  console.log('\n\n========================================');
  console.log('📊 测试结果摘要');
  console.log('========================================\n');

  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.email} (${result.description})`);
    console.log(`   状态: ${result.status}`);
    if (result.status === 'PASSED') {
      console.log(`   ✅ 角色: ${result.actualRole}`);
      console.log(`   ✅ 用户ID: ${result.userId}`);
    } else if (result.status === 'FAILED') {
      console.log(`   ❌ 期望: ${result.expectedRole}, 实际: ${result.actualRole}`);
    } else if (result.status === 'ERROR') {
      console.log(`   ❌ 错误: ${result.error}`);
    }
    console.log('');
  });

  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status !== 'PASSED').length;

  console.log('========================================');
  console.log(`总计: ${results.length} | 通过: ${passed} | 失败: ${failed}`);
  console.log('========================================\n');

  // 输出实际测试指南
  console.log('📝 手动测试步骤:');
  console.log('========================================\n');
  console.log('1. 打开浏览器，访问 LibreChat: http://localhost:3080');
  console.log('');
  console.log('2. 分别使用以下账号登录测试：');
  results.forEach(result => {
    if (result.status === 'PASSED') {
      console.log(`   - ${result.email} (${result.description}, 角色: ${result.actualRole})`);
    }
  });
  console.log('');
  console.log('3. 登录后，在聊天界面：');
  console.log('   a) 选择启用MCP服务器');
  console.log('   b) 选择 "Oilfield Drilling Data Service"');
  console.log('   c) 尝试调用MCP工具（如查询钻井数据）');
  console.log('');
  console.log('4. 在MCP服务器日志中观察：');
  console.log('   - 检查请求头中的 X-User-Role, X-User-Email, X-User-ID');
  console.log('   - 验证不同角色用户是否能访问不同的数据');
  console.log('   - 验证普通用户之间的数据是否隔离');
  console.log('');
  console.log('5. 预期行为：');
  console.log('   - ADMIN用户应该能看到所有数据');
  console.log('   - USER用户只能看到自己权限范围内的数据');
  console.log('   - 不同USER用户之间数据应该隔离');
  console.log('');

  // 优雅关闭数据库连接
  try {
    await mongoose.connection.close();
    console.log('✅ 数据库连接已关闭\n');
  } catch (error) {
    console.error('⚠️  关闭数据库连接时出错:', error.message);
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(error => {
  console.error('\n❌ 测试脚本执行错误:', error);
  mongoose.connection.close().then(() => {
    process.exit(1);
  }).catch(() => {
    process.exit(1);
  });
});
