const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_management'
};

async function testDatabase() {
  let connection;
  try {
    console.log('🔍 Testing database connection...');
    console.log('Database config:', { ...dbConfig, password: '***' });
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully!');
    
    // Test if tables exist
    console.log('\n📋 Checking tables...');
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('Tables found:', tables.map(t => Object.values(t)[0]));
    
    // Check if we have required data
    console.log('\n📊 Checking data...');
    
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log(`Users: ${users[0].count}`);
    
    const [products] = await connection.execute('SELECT COUNT(*) as count FROM products WHERE is_active = TRUE');
    console.log(`Active Products: ${products[0].count}`);
    
    const [locations] = await connection.execute('SELECT COUNT(*) as count FROM locations WHERE is_active = TRUE');
    console.log(`Active Locations: ${locations[0].count}`);
    
    const [inventory] = await connection.execute('SELECT COUNT(*) as count FROM inventory');
    console.log(`Inventory Records: ${inventory[0].count}`);
    
    // Show sample data
    if (products[0].count > 0) {
      const [sampleProducts] = await connection.execute('SELECT id, name, sku FROM products WHERE is_active = TRUE LIMIT 3');
      console.log('\n📦 Sample Products:', sampleProducts);
    }
    
    if (locations[0].count > 0) {
      const [sampleLocations] = await connection.execute('SELECT id, name FROM locations WHERE is_active = TRUE LIMIT 3');
      console.log('🏢 Sample Locations:', sampleLocations);
    }
    
    if (inventory[0].count > 0) {
      const [sampleInventory] = await connection.execute(`
        SELECT i.product_id, i.location_id, i.quantity, p.name as product_name, l.name as location_name 
        FROM inventory i 
        JOIN products p ON i.product_id = p.id 
        JOIN locations l ON i.location_id = l.id 
        LIMIT 3
      `);
      console.log('📦 Sample Inventory:', sampleInventory);
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n💡 Database does not exist. You need to:');
      console.log('1. Create the database: CREATE DATABASE inventory_management;');
      console.log('2. Import the schema: mysql -u root -p inventory_management < database/schema.sql');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 MySQL server is not running or not accessible.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Access denied. Check your database credentials in .env file.');
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testDatabase(); 