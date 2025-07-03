import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiEye } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';
import ProductModal from './ProductModal';
import ProductDetailModal from './ProductDetailModal';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBrands();
  }, [currentPage, searchTerm, categoryFilter, brandFilter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 10,
        search: searchTerm || undefined,
        category: categoryFilter || undefined,
        brand: brandFilter || undefined
      };

      const response = await axios.get('/api/products', { params });
      setProducts(response.data.products);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/products/categories/list');
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await axios.get('/api/products/brands/list');
      setBrands(response.data.brands);
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const handleCreateProduct = () => {
    setSelectedProduct(null);
    setShowModal(true);
  };

  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const handleViewProduct = (product) => {
    setSelectedProduct(product);
    setShowDetailModal(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await axios.delete(`/api/products/${productId}`);
      toast.success('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete product';
      toast.error(message);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedProduct(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchProducts();
  };

  const handleDetailModalClose = () => {
    setShowDetailModal(false);
    setSelectedProduct(null);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setBrandFilter('');
    setCurrentPage(1);
  };

  if (loading && products.length === 0) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your product catalog and inventory
          </p>
        </div>
        <button
          onClick={handleCreateProduct}
          className="btn btn-primary mt-4 sm:mt-0"
        >
          <FiPlus className="mr-2" />
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="form-group">
            <label className="form-label">Search</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="form-input pl-10"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Brand</label>
            <select
              className="form-select"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              <option value="">All Brands</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">&nbsp;</label>
            <button
              onClick={clearFilters}
              className="btn btn-outline w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div>
                      <div className="font-medium text-gray-900">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {product.description}
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-sm">{product.sku}</td>
                  <td>{product.category || '-'}</td>
                  <td>{product.brand || '-'}</td>
                  <td>${parseFloat(product.unit_price).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${
                      product.total_stock <= product.reorder_level 
                        ? 'badge-danger' 
                        : 'badge-success'
                    }`}>
                      {product.total_stock || 0}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      product.is_active ? 'badge-success' : 'badge-danger'
                    }`}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewProduct(product)}
                        className="btn btn-outline btn-sm"
                        title="View Details"
                      >
                        <FiEye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="btn btn-outline btn-sm"
                        title="Edit"
                      >
                        <FiEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="btn btn-danger btn-sm"
                        title="Delete"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {products.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-gray-500">No products found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="btn btn-outline btn-sm"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="btn btn-outline btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <ProductModal
          product={selectedProduct}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}

      {showDetailModal && selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={handleDetailModalClose}
        />
      )}
    </div>
  );
};

export default Products; 