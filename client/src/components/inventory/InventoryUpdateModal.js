import React, { useState } from 'react';
import { FiX, FiSave } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';

const InventoryUpdateModal = ({ item, locations, onClose, onSuccess }) => {
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
      if (item) {
        // Update existing inventory
        await axios.put(`/api/inventory/${item.id}`, formData);
        toast.success('Inventory updated successfully');
      } else {
        // Create new inventory record
        await axios.post('/api/inventory', formData);
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
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">
            {item ? 'Update Inventory' : 'Add Inventory'}
          </h2>
          <button onClick={onClose} className="modal-close">
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            />
          </div>

          <div className="form-group">
            <label className="form-label">Transaction Type</label>
            <select
              className="form-select"
              value={formData.transactionType}
              onChange={(e) => setFormData({...formData, transactionType: e.target.value})}
            >
              <option value="adjustment">Adjustment</option>
              <option value="in">Stock In</option>
              <option value="out">Stock Out</option>
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

          <div className="flex justify-end space-x-3 pt-4 border-t">
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
        </form>
      </div>
    </div>
  );
};

export default InventoryUpdateModal; 