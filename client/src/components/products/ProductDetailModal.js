import React from 'react';
import { FiX, FiMapPin, FiPackage, FiDollarSign } from 'react-icons/fi';

const ProductDetailModal = ({ product, onClose }) => {
  return (
    <div className="modal">
      <div className="modal-content max-w-4xl">
        <div className="modal-header">
          <h2 className="modal-title">Product Details</h2>
          <button onClick={onClose} className="modal-close">
            <FiX />
          </button>
        </div>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Product Name</label>
                  <p className="text-gray-900">{product.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">SKU</label>
                  <p className="font-mono text-gray-900">{product.sku}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-900">{product.description || 'No description available'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <p className="text-gray-900">{product.category || 'Uncategorized'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Brand</label>
                  <p className="text-gray-900">{product.brand || 'No brand'}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing & Stock</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Unit Price</label>
                  <p className="text-gray-900">${parseFloat(product.unit_price).toFixed(2)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Cost Price</label>
                  <p className="text-gray-900">
                    {product.cost_price ? `$${parseFloat(product.cost_price).toFixed(2)}` : 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Stock</label>
                  <p className="text-gray-900">{product.total_stock || 0} units</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Reserved Stock</label>
                  <p className="text-gray-900">{product.total_reserved || 0} units</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Reorder Level</label>
                  <p className="text-gray-900">{product.reorder_level} units</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <span className={`badge ${product.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Inventory by Location */}
          {product.inventory && product.inventory.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FiMapPin className="mr-2" />
                Inventory by Location
              </h3>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th>City</th>
                      <th>Available Stock</th>
                      <th>Reserved Stock</th>
                      <th>Total Stock</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.inventory.map((item) => (
                      <tr key={item.id}>
                        <td className="font-medium">{item.location_name}</td>
                        <td>{item.city}, {item.state}</td>
                        <td>
                          <span className={`badge ${
                            item.quantity <= product.reorder_level 
                              ? 'badge-danger' 
                              : 'badge-success'
                          }`}>
                            {item.quantity}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-info">
                            {item.reserved_quantity || 0}
                          </span>
                        </td>
                        <td>{item.quantity + (item.reserved_quantity || 0)}</td>
                        <td>
                          <span className={`badge ${
                            item.quantity <= product.reorder_level 
                              ? 'badge-warning' 
                              : 'badge-success'
                          }`}>
                            {item.quantity <= product.reorder_level ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stock Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card bg-blue-50 border-blue-200">
              <div className="flex items-center">
                <FiPackage className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Available</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {product.total_stock || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="card bg-yellow-50 border-yellow-200">
              <div className="flex items-center">
                <FiPackage className="h-8 w-8 text-yellow-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-600">Reserved</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {product.total_reserved || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="card bg-green-50 border-green-200">
              <div className="flex items-center">
                <FiDollarSign className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-600">Total Value</p>
                  <p className="text-2xl font-bold text-green-900">
                    ${((product.total_stock || 0) * parseFloat(product.unit_price)).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={onClose}
              className="btn btn-outline"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal; 