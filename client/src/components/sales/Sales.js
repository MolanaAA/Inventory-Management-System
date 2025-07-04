
import React, { useState, useEffect } from 'react';
import { FiPlus, FiUpload, FiDownload, FiEye, FiEdit, FiTrash2 } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';
import SalesModal from './SalesModal';
import CSVUploadModal from './CSVUploadModal';

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [filters, setFilters] = useState({
    locationId: '',
    productId: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchSales();
    fetchProducts();
    fetchLocations();
  }, [filters]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = { limit: 1000, ...filters };
      const res = await axios.get('/api/sales', { params });
      setSales(res.data.sales || []);
    } catch (err) {
      toast.error('Failed to fetch sales');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get('/api/products');
      setProducts(res.data.products || []);
    } catch (err) {
      toast.error('Failed to fetch products');
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await axios.get('/api/locations');
      setLocations(res.data.locations || []);
    } catch (err) {
      toast.error('Failed to fetch locations');
    }
  };

  const handleManualSuccess = () => {
    setShowManualModal(false);
    fetchSales();
  };

  const handleCSVSuccess = () => {
    setShowCSVModal(false);
    fetchSales();
  };

  const handleEdit = (sale) => {
    setSelectedSale(sale);
    setShowManualModal(true);
  };

  const handleDelete = async (saleId) => {
    if (!window.confirm('Are you sure you want to delete this sale?')) {
      return;
    }

    try {
      await axios.delete(`/api/sales/${saleId}`);
      toast.success('Sale deleted successfully');
      fetchSales();
    } catch (err) {
      toast.error('Failed to delete sale');
    }
  };

  const downloadCSVTemplate = () => {
    const headers = ['product_sku', 'location_name', 'quantity', 'unit_price', 'customer_name', 'customer_email', 'customer_phone'];
    const csvContent = [headers.join(',')].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportSales = () => {
    const headers = ['Date', 'Product', 'SKU', 'Location', 'Quantity', 'Unit Price', 'Total Amount', 'Customer Name', 'Customer Email', 'Customer Phone'];
    const csvData = sales.map(sale => [
      new Date(sale.sale_date).toLocaleDateString(),
      sale.product_name,
      sale.sku,
      sale.location_name,
      sale.quantity,
      sale.unit_price,
      sale.total_amount,
      sale.customer_name || '',
      sale.customer_email || '',
      sale.customer_phone || ''
    ]);

    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Record and manage sales transactions
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={() => setShowManualModal(true)}
            className="btn btn-primary flex items-center"
          >
            <FiPlus className="mr-2" />
            Record Sale
          </button>
          <button
            onClick={() => setShowCSVModal(true)}
            className="btn btn-secondary flex items-center"
          >
            <FiUpload className="mr-2" />
            Upload CSV
          </button>
          <button
            onClick={downloadCSVTemplate}
            className="btn btn-outline flex items-center"
          >
            <FiDownload className="mr-2" />
            Download Template
          </button>
          <button
            onClick={exportSales}
            className="btn btn-outline flex items-center"
          >
            <FiDownload className="mr-2" />
            Export Sales
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="form-label">Location</label>
            <select
              className="form-select"
              value={filters.locationId}
              onChange={(e) => setFilters({...filters, locationId: e.target.value})}
            >
              <option value="">All Locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="form-label">Product</label>
            <select
              className="form-select"
              value={filters.productId}
              onChange={(e) => setFilters({...filters, productId: e.target.value})}
            >
              <option value="">All Products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            />
          </div>
          
          <div>
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-input"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Sales History</h3>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(sale.sale_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{sale.product_name}</div>
                        <div className="text-sm text-gray-500">{sale.sku}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.location_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${parseFloat(sale.unit_price).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${parseFloat(sale.total_amount).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{sale.customer_name || '-'}</div>
                        <div className="text-sm text-gray-500">{sale.customer_email || '-'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(sale)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <FiEdit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sale.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {sales.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No sales found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showManualModal && (
        <SalesModal
          sale={selectedSale}
          products={products}
          locations={locations}
          onClose={() => {
            setShowManualModal(false);
            setSelectedSale(null);
          }}
          onSuccess={handleManualSuccess}
        />
      )}

      {showCSVModal && (
        <CSVUploadModal
          products={products}
          locations={locations}
          onClose={() => setShowCSVModal(false)}
          onSuccess={handleCSVSuccess}
        />
      )}

import React from 'react';

const Sales = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          Record and manage sales transactions
        </p>
      </div>
      
      <div className="card">
        <p className="text-center text-gray-500 py-8">
          Sales management component will be implemented here.
          <br />
          Features: Record sales, view sales history, sales analytics
        </p>
      </div>

    </div>
  );
};

export default Sales; 