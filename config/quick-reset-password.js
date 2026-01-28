const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User } = require('@librechat/data-schemas').createModels(mongoose);
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const connect = require('./connect');

const resetUserPassword = async (email, newPassword) => {
  try {
    await connect();
    
    const user = await User.findOne({ email });
    
    if (!user) {
      console.error('❌ 用户不存在！');
      process.exit(1);
    }
    
    console.log(`找到用户: ${user.email}`);
    console.log(`用户名: ${user.name || 'N/A'}`);
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    user.password = hashedPassword;
    await user.save();
    
    console.log('✅ 密码重置成功！');
    console.log(`新密码: ${newPassword}`);
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
};

// 从命令行参数获取邮箱和密码
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('用法: node quick-reset-password.js <email> <password>');
  process.exit(1);
}

resetUserPassword(email, password);
