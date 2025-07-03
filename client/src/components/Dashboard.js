import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  FiPackage, 
  FiTruck, 
  FiDollarSign, 
  FiMapPin, 
  FiTrendingUp, 
  FiTrendingDown,
  FiAlertTriangle
} from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalInventory: 0,
    totalSales: 0,
    totalRevenue: 0,
    lowStockItems: 0,
    recentSales: [],
    topProducts: [],
    salesByLocation: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Initialize default values
      let inventory = [];
      let sales = [];
      let products = [];
      let lowStockItems = [];
      let analytics = { topProducts: [], salesByLocation: [] };

      // Fetch inventory stats
      try {
        const inventoryResponse = await axios.get('/api/inventory', {
          params: { limit: 1000 }
        });
        inventory = inventoryResponse.data.inventory || [];
      } catch (error) {
        console.error('Error fetching inventory:', error);
      }
      
      // Fetch sales stats
      try {
        const salesResponse = await axios.get('/api/sales', {
          params: { limit: 1000 }
        });
        sales = salesResponse.data.sales || [];
      } catch (error) {
        console.error('Error fetching sales:', error);
      }
      
      // Fetch products
      try {
        const productsResponse = await axios.get('/api/products', {
          params: { limit: 1000 }
        });
        products = productsResponse.data.products || [];
      } catch (error) {
        console.error('Error fetching products:', error);
      }
      
      // Fetch low stock items
      try {
        const lowStockResponse = await axios.get('/api/inventory/low-stock');
        lowStockItems = lowStockResponse.data.lowStockItems || [];
      } catch (error) {
        console.error('Error fetching low stock items:', error);
      }
      
      // Fetch sales analytics
      try {
        const analyticsResponse = await axios.get('/api/sales/analytics/summary');
        analytics = analyticsResponse.data;
      } catch (error) {
        console.error('Error fetching analytics:', error);
      }

      // Calculate stats
      const totalInventory = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalSales = sales.length;
      const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0);

      setStats({
        totalProducts: products.length,
        totalInventory,
        totalSales,
        totalRevenue,
        lowStockItems: lowStockItems.length,
        recentSales: sales.slice(0, 5),
        topProducts: analytics.topProducts || [],
        salesByLocation: analytics.salesByLocation || []
      });

    } catch (error) {
      console.error('Error in fetchDashboardData:', error);
      toast.error('Some dashboard data failed to load');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, trend, trendValue }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className={`flex items-center mt-1 text-sm ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend === 'up' ? <FiTrendingUp className="mr-1" /> : <FiTrendingDown className="mr-1" />}
              {trendValue}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );

  const RecentSalesTable = () => (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sales</h3>
      {stats.recentSales.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.recentSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sale.product_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.location_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${parseFloat(sale.total_amount).toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(sale.sale_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-4">No recent sales</p>
      )}
    </div>
  );

  const TopProductsTable = () => (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Products</h3>
      {stats.topProducts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity Sold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.topProducts.slice(0, 5).map((product, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.product_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.sales_count}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.total_quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${parseFloat(product.revenue).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-4">No sales data available</p>
      )}
    </div>
  );

  const LowStockAlert = () => (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 border-l-4 border-l-red-500">
      <div className="flex items-center">
        <FiAlertTriangle className="h-5 w-5 text-red-500 mr-3" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Low Stock Alert</h3>
          <p className="text-gray-600">
            {stats.lowStockItems} product{stats.lowStockItems !== 1 ? 's' : ''} need{stats.lowStockItems !== 1 ? '' : 's'} restocking
          </p>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-md p-6 border border-gray-200">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-blue-100">
          Here's what's happening with your inventory today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          icon={FiPackage}
          color="bg-blue-500"
        />
        <StatCard
          title="Total Inventory"
          value={stats.totalInventory.toLocaleString()}
          icon={FiTruck}
          color="bg-green-500"
        />
        <StatCard
          title="Total Sales"
          value={stats.totalSales}
          icon={FiDollarSign}
          color="bg-purple-500"
        />
        <StatCard
          title="Total Revenue"
          value={`$${stats.totalRevenue.toFixed(2)}`}
          icon={FiTrendingUp}
          color="bg-orange-500"
        />
      </div>

      {/* Low Stock Alert */}
      {stats.lowStockItems > 0 && <LowStockAlert />}

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentSalesTable />
        <TopProductsTable />
      </div>

      {/* Sales by Location (Admin only) */}
      {isAdmin && stats.salesByLocation.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales by Location</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Count</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.salesByLocation.map((location, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{location.location_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{location.sales_count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${parseFloat(location.revenue).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <FiPackage className="mr-2" />
            Add Product
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
            <FiTruck className="mr-2" />
            Update Stock
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
            <FiDollarSign className="mr-2" />
            Record Sale
          </button>
          {isAdmin && (
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <FiMapPin className="mr-2" />
              Manage Locations
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 