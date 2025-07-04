import React, { useState } from 'react';
import { FiX, FiSave } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';

const InventoryUpdateModal = ({ item, locations, products, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    productId: item?.product_id || '',
    locationId: item?.location_id || '',
    quantity: '',
    transactionType: 'adjustment',
    reason: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert quantity to number to avoid string concatenation issues
      const submitData = {
        ...formData,
        quantity: parseInt(formData.quantity, 10)
      };

      if (item) {
        // Update existing inventory
        await axios.put(`/api/inventory/${item.id}`, submitData);
        toast.success('Inventory updated successfully');
      } else {
        // Create new inventory record
        await axios.post('/api/inventory', submitData);
        toast.success('Inventory record created successfully');
      }
      onSuccess();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update inventory';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {item ? 'Update Inventory' : 'Add Inventory'}
          </h2>
          <button onClick={onClose} className="modal-close">
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Product</label>
              <select
                className="form-select"
                value={formData.productId}
                onChange={(e) => setFormData({...formData, productId: e.target.value})}
                required
              >
                <option value="">Select Product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Location</label>
              <select
                className="form-select"
                value={formData.locationId}
                onChange={(e) => setFormData({...formData, locationId: e.target.value})}
                required
              >
                <option value="">Select Location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input
                type="number"
                className="form-input"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                required
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Transaction Type</label>
              <select
                className="form-select"
                value={formData.transactionType}
                onChange={(e) => setFormData({...formData, transactionType: e.target.value})}
              >
                <option value="adjustment">Set Quantity (Direct)</option>
                <option value="in">Add to Existing Stock</option>
                <option value="out">Remove from Stock</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Reason</label>
              <textarea
                className="form-input"
                rows="3"
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                required
              />
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center">
                <div className="spinner mr-2"></div>
                Saving...
              </div>
            ) : (
              <div className="flex items-center">
                <FiSave className="mr-2" />
                Save
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryUpdateModal; 