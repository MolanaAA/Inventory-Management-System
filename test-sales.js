const axios = require('axios');

// Configure axios base URL
axios.defaults.baseURL = 'http://localhost:5000';

async function testSalesAPI() {
  try {
    console.log('🔐 Testing login...');
    console.log('Making request to:', axios.defaults.baseURL + '/api/auth/login');
    
    // Test login
    const loginResponse = await axios.post('/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const { token } = loginResponse.data;
    console.log('✅ Login successful!');
    console.log('Token received:', token.substring(0, 20) + '...');
    console.log('Response data:', loginResponse.data);
    
    // Set authorization header
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('Authorization header set');
    
    console.log('\n📦 Testing sales API...');
    
    // Test creating a sale
    const saleData = {
      productId: 1,
      locationId: 1,
      quantity: 1,
      unitPrice: 1299.99,
      customerName: 'Test Customer',
      customerEmail: 'test@example.com'
    };
    
    console.log('Sale data:', saleData);
    console.log('Making request to:', axios.defaults.baseURL + '/api/sales');
    
    const saleResponse = await axios.post('/api/sales', saleData);
    console.log('✅ Sale created successfully!');
    console.log('Sale ID:', saleResponse.data.sale.id);
    console.log('Total Amount:', saleResponse.data.sale.total_amount);
    
    // Test getting sales list
    console.log('\n📋 Testing get sales...');
    const salesListResponse = await axios.get('/api/sales');
    console.log('✅ Sales list retrieved!');
    console.log('Total sales:', salesListResponse.data.sales.length);
    
  } catch (error) {
    console.error('❌ Test failed!');
    console.error('Error message:', error.message);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    console.error('Error headers:', error.response?.headers);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Authentication failed. Check if you are logged in.');
    } else if (error.response?.status === 400) {
      console.log('\n💡 Bad request. Check the sale data format.');
    } else if (error.response?.status === 404) {
      console.log('\n💡 Product or location not found.');
    } else if (error.response?.status === 403) {
      console.log('\n💡 Access denied. Check user permissions.');
    }
  }
}

console.log('🚀 Starting sales API test...');
testSalesAPI(); 