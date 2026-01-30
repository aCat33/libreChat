const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User } = require('@librechat/data-schemas').createModels(mongoose);
const { SystemRoles } = require('librechat-data-provider');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const connect = require('./connect');

/**
 * 创建测试用户脚本
 * 用于测试不同角色用户访问MCP服务器的权限差异
 */

const testUsers = [
  {
    email: 'admin@test.com',
    name: 'Admin User',
    username: 'admin_test',
    password: 'Admin@123456',
    role: SystemRoles.ADMIN,
    description: '管理员用户 - 应该有完整的MCP访问权限'
  },
  {
    email: 'user1@test.com',
    name: 'Regular User 1',
    username: 'user1_test',
    password: 'User@123456',
    role: SystemRoles.USER,
    description: '普通用户1 - 测试基础MCP访问权限'
  },
  {
    email: 'user2@test.com',
    name: 'Regular User 2',
    username: 'user2_test',
    password: 'User@123456',
    role: SystemRoles.USER,
    description: '普通用户2 - 测试不同用户之间的数据隔离'
  }
];

async function setupTestUsers() {
  try {
    await connect();
    console.log('\n========================================');
    console.log('🚀 开始创建测试用户');
    console.log('========================================\n');

    for (const userData of testUsers) {
      try {
        // 检查用户是否已存在
        let existingUser = await User.findOne({ email: userData.email });
        
        if (existingUser) {
          console.log(`⚠️  用户已存在: ${userData.email}`);
          console.log(`   当前角色: ${existingUser.role || 'USER'}`);
          
          // 更新角色（如果需要）
          if (existingUser.role !== userData.role) {
            await User.updateOne(
              { email: userData.email },
              { $set: { role: userData.role } }
            );
            console.log(`   ✅ 角色已更新为: ${userData.role}`);
          }
          
          // 确保邮箱已验证
          if (!existingUser.emailVerified) {
            await User.updateOne(
              { email: userData.email },
              { $set: { emailVerified: true } }
            );
            console.log(`   ✅ 邮箱已设置为已验证`);
          }
          
          console.log('');
          continue;
        }

        // 创建新用户
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(userData.password, salt);
        
        const newUser = new User({
          email: userData.email,
          password: hashedPassword,
          name: userData.name,
          username: userData.username,
          role: userData.role,
          provider: 'local',
          emailVerified: true, // 自动验证邮箱
          avatar: null
        });

        await newUser.save();

        console.log(`✅ 创建成功: ${userData.email}`);
        console.log(`   姓名: ${userData.name}`);
        console.log(`   用户名: ${userData.username}`);
        console.log(`   角色: ${userData.role}`);
        console.log(`   用户ID: ${newUser._id}`);
        console.log(`   说明: ${userData.description}`);
        console.log(`   密码: ${userData.password}`);
        console.log('');
      } catch (error) {
        console.error(`❌ 创建用户失败 ${userData.email}:`, error.message);
        console.log('');
      }
    }

    console.log('========================================');
    console.log('📋 测试用户列表汇总');
    console.log('========================================\n');
    
    for (const userData of testUsers) {
      const user = await User.findOne({ email: userData.email });
      if (user) {
        console.log(`邮箱: ${userData.email}`);
        console.log(`密码: ${userData.password}`);
        console.log(`角色: ${user.role || 'USER'}`);
        console.log(`用户ID: ${user._id}`);
        console.log(`说明: ${userData.description}`);
        console.log('---');
      }
    }

    console.log('\n========================================');
    console.log('📝 下一步测试说明');
    console.log('========================================\n');
    console.log('1. 启动LibreChat服务（如果还未启动）：');
    console.log('   npm run backend:dev');
    console.log('   npm run frontend:dev');
    console.log('');
    console.log('2. 启动MCP服务器：');
    console.log('   确保 http://localhost:8080/sse 可访问');
    console.log('');
    console.log('3. 测试步骤：');
    console.log('   a) 使用admin@test.com登录，测试管理员权限');
    console.log('   b) 使用user1@test.com登录，测试普通用户权限');
    console.log('   c) 使用user2@test.com登录，测试数据隔离');
    console.log('');
    console.log('4. 观察MCP服务器日志中的请求头：');
    console.log('   X-User-Role: ADMIN 或 USER');
    console.log('   X-User-Email: 对应的用户邮箱');
    console.log('   X-User-ID: 对应的用户ID');
    console.log('');
    console.log('5. 运行自动化测试（可选）：');
    console.log('   npm run test:mcp-permissions');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 脚本执行错误:', error);
    process.exit(1);
  }
}

// 执行脚本
setupTestUsers();
