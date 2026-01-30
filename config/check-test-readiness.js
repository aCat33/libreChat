const axios = require('axios');
const path = require('path');
const mongoose = require('mongoose');
const { User } = require('@librechat/data-schemas').createModels(mongoose);
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const connect = require('./connect');

/**
 * 检查测试环境准备情况
 */

const LIBRECHAT_API = process.env.LIBRECHAT_API_URL || 'http://localhost:3080';
const MCP_SERVER_URL = 'http://localhost:8080';

const testUsers = [
  { email: 'admin@test.com', expectedRole: 'ADMIN', description: '管理员' },
  { email: 'user1@test.com', expectedRole: 'USER', description: '普通用户1' },
  { email: 'user2@test.com', expectedRole: 'USER', description: '普通用户2' }
];

async function checkEnvironment() {
  console.log('\n========================================');
  console.log('🔍 MCP权限测试环境检查');
  console.log('========================================\n');

  let allGood = true;

  // 1. 检查数据库连接和用户
  console.log('📊 1. 检查数据库和测试用户...');
  try {
    await connect();
    console.log('   ✅ 数据库连接成功');
    
    let usersOk = true;
    for (const testUser of testUsers) {
      const user = await User.findOne({ email: testUser.email });
      if (!user) {
        console.log(`   ❌ 用户不存在: ${testUser.email}`);
        usersOk = false;
      } else {
        const roleMatch = (user.role || 'USER') === testUser.expectedRole;
        if (roleMatch) {
          console.log(`   ✅ ${testUser.email} (${user.role})`);
        } else {
          console.log(`   ⚠️  ${testUser.email} 角色不匹配: ${user.role} (期望: ${testUser.expectedRole})`);
          usersOk = false;
        }
      }
    }
    
    if (!usersOk) {
      console.log('\n   ⚠️  请运行: npm run setup-test-users');
      allGood = false;
    }
  } catch (error) {
    console.log(`   ❌ 数据库错误: ${error.message}`);
    allGood = false;
  }
  console.log('');

  // 2. 检查 LibreChat 后端
  console.log('🌐 2. 检查 LibreChat 后端...');
  try {
    await axios.get(`${LIBRECHAT_API}/api/config`, { timeout: 3000 });
    console.log(`   ✅ 后端运行正常: ${LIBRECHAT_API}`);
  } catch (error) {
    console.log(`   ❌ 后端无法连接: ${LIBRECHAT_API}`);
    console.log('   ⚠️  请运行: npm run backend:dev');
    allGood = false;
  }
  console.log('');

  // 3. 检查 LibreChat 前端
  console.log('🖥️  3. 检查 LibreChat 前端...');
  try {
    await axios.get('http://localhost:3080', { timeout: 3000 });
    console.log('   ✅ 前端运行正常: http://localhost:3080');
  } catch (error) {
    console.log('   ⚠️  前端无法访问: http://localhost:3080');
    console.log('   提示: npm run frontend:dev (可选)');
  }
  console.log('');

  // 4. 检查 MCP 服务器
  console.log('🔌 4. 检查 MCP 服务器...');
  try {
    await axios.get(MCP_SERVER_URL, { timeout: 3000 });
    console.log(`   ✅ MCP服务器运行正常: ${MCP_SERVER_URL}`);
  } catch (error) {
    console.log(`   ⚠️  MCP服务器无法连接: ${MCP_SERVER_URL}`);
    console.log('   提示: 这是可选的，用于实际权限测试');
  }
  console.log('');

  // 5. 检查配置文件
  console.log('⚙️  5. 检查 librechat.yaml 配置...');
  const fs = require('fs');
  const yaml = require('js-yaml');
  try {
    const configPath = path.join(__dirname, '..', 'librechat.yaml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    
    if (config.mcpServers && config.mcpServers['oilfield-drilling']) {
      const mcpConfig = config.mcpServers['oilfield-drilling'];
      console.log('   ✅ MCP服务器配置存在: oilfield-drilling');
      
      if (mcpConfig.headers) {
        const hasRole = mcpConfig.headers['X-User-Role'] === '{{LIBRECHAT_USER_ROLE}}';
        const hasEmail = mcpConfig.headers['X-User-Email'] === '{{LIBRECHAT_USER_EMAIL}}';
        const hasId = mcpConfig.headers['X-User-ID'] === '{{LIBRECHAT_USER_ID}}';
        
        if (hasRole && hasEmail && hasId) {
          console.log('   ✅ 用户信息请求头配置正确');
        } else {
          console.log('   ⚠️  用户信息请求头配置不完整');
          if (!hasRole) console.log('      缺失: X-User-Role');
          if (!hasEmail) console.log('      缺失: X-User-Email');
          if (!hasId) console.log('      缺失: X-User-ID');
        }
      } else {
        console.log('   ⚠️  未配置用户信息请求头');
      }
    } else {
      console.log('   ⚠️  未找到 oilfield-drilling MCP服务器配置');
    }
  } catch (error) {
    console.log(`   ⚠️  配置文件检查失败: ${error.message}`);
  }
  console.log('');

  // 总结
  console.log('========================================');
  if (allGood) {
    console.log('✅ 环境检查通过！可以进行测试');
    console.log('========================================\n');
    console.log('📝 下一步：');
    console.log('1. 自动化测试: npm run test:mcp-permissions');
    console.log('2. 手动测试: 浏览器访问 http://localhost:3080\n');
    
    console.log('📋 测试账号：');
    testUsers.forEach(u => {
      console.log(`   ${u.email} / [见脚本输出] (${u.description})`);
    });
  } else {
    console.log('⚠️  环境未就绪，请按照上面的提示修复');
    console.log('========================================\n');
    console.log('📝 修复步骤：');
    console.log('1. 创建测试用户: npm run setup-test-users');
    console.log('2. 启动后端: npm run backend:dev');
    console.log('3. (可选) 启动前端: npm run frontend:dev');
    console.log('4. (可选) 启动MCP服务器');
  }
  console.log('');

  await mongoose.connection.close();
  process.exit(allGood ? 0 : 1);
}

checkEnvironment().catch(error => {
  console.error('\n❌ 检查失败:', error);
  mongoose.connection.close().then(() => process.exit(1));
});
