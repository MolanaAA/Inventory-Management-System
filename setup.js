#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Inventory Management System...\n');

// Check if Node.js is installed
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' });
  console.log(`✅ Node.js version: ${nodeVersion.trim()}`);
} catch (error) {
  console.error('❌ Node.js is not installed. Please install Node.js first.');
  process.exit(1);
}

// Check if npm is installed
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' });
  console.log(`✅ npm version: ${npmVersion.trim()}`);
} catch (error) {
  console.error('❌ npm is not installed. Please install npm first.');
  process.exit(1);
}

// Install backend dependencies
console.log('\n📦 Installing backend dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Backend dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install backend dependencies');
  process.exit(1);
}

// Install frontend dependencies
console.log('\n📦 Installing frontend dependencies...');
try {
  execSync('cd client && npm install', { stdio: 'inherit' });
  console.log('✅ Frontend dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install frontend dependencies');
  process.exit(1);
}

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('\n📝 Creating .env file...');
  const envContent = `# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=inventory_management

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Client Configuration
CLIENT_URL=http://localhost:3000
`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created');
  console.log('⚠️  Please update the .env file with your database credentials');
} else {
  console.log('✅ .env file already exists');
}

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Set up your MySQL database');
console.log('2. Import the database schema: mysql -u your_username -p inventory_management < database/schema.sql');
console.log('3. Update the .env file with your database credentials');
console.log('4. Start the development server: npm run dev');
console.log('\n📚 For more information, see the README.md file'); 