const path = require('path');
const mongoose = require('mongoose');
const { User } = require('@librechat/data-schemas').createModels(mongoose);
const { SystemRoles } = require('librechat-data-provider');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const connect = require('./connect');

/**
 * 检查和修复用户角色脚本
 */

async function checkAndFixUserRoles() {
  try {
    await connect();
    console.log('\n========================================');
    console.log('🔍 检查用户角色');
    console.log('========================================\n');

    // 查找所有测试用户
    const testEmails = ['admin@test.com', 'user1@test.com', 'user2@test.com'];
    
    for (const email of testEmails) {
      const user = await User.findOne({ email });
      
      if (!user) {
        console.log(`❌ 用户不存在: ${email}\n`);
        continue;
      }

      console.log(`📧 邮箱: ${email}`);
      console.log(`   姓名: ${user.name}`);
      console.log(`   用户名: ${user.username}`);
      console.log(`   当前角色: ${user.role || 'USER'}`);
      console.log(`   用户ID: ${user._id}`);
      console.log(`   邮箱验证: ${user.emailVerified ? '✅ 已验证' : '❌ 未验证'}`);
      
      // 修复admin@test.com的角色
      if (email === 'admin@test.com' && user.role !== SystemRoles.ADMIN) {
        console.log(`   ⚠️  角色不正确，正在修复...`);
        await User.updateOne(
          { email },
          { 
            $set: { 
              role: SystemRoles.ADMIN,
              emailVerified: true 
            } 
          }
        );
        console.log(`   ✅ 已修复为 ADMIN 角色`);
      }
      
      // 确保普通用户角色正确
      if ((email === 'user1@test.com' || email === 'user2@test.com') && user.role !== SystemRoles.USER) {
        console.log(`   ⚠️  角色不正确，正在修复...`);
        await User.updateOne(
          { email },
          { 
            $set: { 
              role: SystemRoles.USER,
              emailVerified: true 
            } 
          }
        );
        console.log(`   ✅ 已修复为 USER 角色`);
      }

      console.log('');
    }

    // 再次验证
    console.log('========================================');
    console.log('✅ 验证修复结果');
    console.log('========================================\n');
    
    for (const email of testEmails) {
      const user = await User.findOne({ email });
      if (user) {
        const expectedRole = email === 'admin@test.com' ? SystemRoles.ADMIN : SystemRoles.USER;
        const roleCorrect = user.role === expectedRole;
        
        console.log(`${roleCorrect ? '✅' : '❌'} ${email}`);
        console.log(`   角色: ${user.role} (期望: ${expectedRole})`);
        console.log(`   用户ID: ${user._id}`);
        console.log('');
      }
    }

    console.log('========================================');
    console.log('💡 测试提示');
    console.log('========================================\n');
    console.log('现在可以用这些账号测试MCP权限：');
    console.log('');
    console.log('管理员账号：');
    console.log('  邮箱: admin@test.com');
    console.log('  密码: Admin@123456');
    console.log('  角色: ADMIN');
    console.log('');
    console.log('普通用户1：');
    console.log('  邮箱: user1@test.com');
    console.log('  密码: User@123456');
    console.log('  角色: USER');
    console.log('');
    console.log('普通用户2：');
    console.log('  邮箱: user2@test.com');
    console.log('  密码: User@123456');
    console.log('  角色: USER');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  }
}

checkAndFixUserRoles();
