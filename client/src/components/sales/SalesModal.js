import React, { useState, useEffect } from 'react';
import { FiX, FiSave } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';

const SalesModal = ({ sale, products, locations, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    productId: sale?.product_id || '',
    locationId: sale?.location_id || '',
    quantity: sale?.quantity || '',
    unitPrice: sale?.unit_price || '',
    customerName: sale?.customer_name || '',
    customerEmail: sale?.customer_email || '',
    customerPhone: sale?.customer_phone || ''
  });
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    if (formData.productId) {
      const product = products.find(p => p.id == formData.productId);
      setSelectedProduct(product);
      if (!sale && product) {
        setFormData(prev => ({ ...prev, unitPrice: product.unit_price }));
      }
    }
  }, [formData.productId, products, sale]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        quantity: parseInt(formData.quantity, 10),
        unitPrice: parseFloat(formData.unitPrice, 10)
      };

      if (sale) {
        // Update existing sale
        await axios.put(`/api/sales/${sale.id}`, submitData);
        toast.success('Sale updated successfully');
      } else {
        // Create new sale
        await axios.post('/api/sales', submitData);
        toast.success('Sale recorded successfully');
      }
      onSuccess();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to save sale';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    const quantity = parseInt(formData.quantity, 10) || 0;
    const unitPrice = parseFloat(formData.unitPrice, 10) || 0;
    return (quantity * unitPrice).toFixed(2);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {sale ? 'Edit Sale' : 'Record New Sale'}
          </h2>
          <button onClick={onClose} className="modal-close">
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select
                  className="form-select"
                  value={formData.productId}
                  onChange={(e) => setFormData({...formData, productId: e.target.value})}
                  required
                >
                  <option value="">Select Product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku}) - ${product.unit_price}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Location *</label>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  required
                  min="1"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unit Price *</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({...formData, unitPrice: e.target.value})}
                  required
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Total Amount</label>
                <input
                  type="text"
                  className="form-input bg-gray-50"
                  value={`$${calculateTotal()}`}
                  readOnly
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Customer Information (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Customer Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Customer Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                  />
                </div>
              </div>
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
                {sale ? 'Update Sale' : 'Record Sale'}
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesModal; 