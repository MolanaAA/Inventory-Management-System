import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FiX, FiSave } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';

const ProductModal = ({ product, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue
  } = useForm();

  const isEditing = !!product;

  useEffect(() => {
    fetchCategories();
    fetchBrands();
    
    if (product) {
      // Pre-fill form for editing
      setValue('name', product.name);
      setValue('description', product.description);
      setValue('sku', product.sku);
      setValue('category', product.category);
      setValue('brand', product.brand);
      setValue('unitPrice', product.unit_price);
      setValue('costPrice', product.cost_price);
      setValue('reorderLevel', product.reorder_level);
    }
  }, [product, setValue]);

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

  const onSubmit = async (data) => {
    try {
      setLoading(true);

      const productData = {
        name: data.name,
        description: data.description,
        sku: data.sku,
        category: data.category || null,
        brand: data.brand || null,
        unitPrice: parseFloat(data.unitPrice),
        costPrice: data.costPrice ? parseFloat(data.costPrice) : null,
        reorderLevel: parseInt(data.reorderLevel) || 0
      };

      if (isEditing) {
        await axios.put(`/api/products/${product.id}`, productData);
        toast.success('Product updated successfully');
      } else {
        await axios.post('/api/products', productData);
        toast.success('Product created successfully');
      }

      onSuccess();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to save product';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={handleClose} className="modal-close">
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input
                type="text"
                className={`form-input ${errors.name ? 'border-red-500' : ''}`}
                placeholder="Enter product name"
                {...register('name', { required: 'Product name is required' })}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">SKU *</label>
              <input
                type="text"
                className={`form-input ${errors.sku ? 'border-red-500' : ''}`}
                placeholder="Enter SKU"
                {...register('sku', { required: 'SKU is required' })}
                disabled={isEditing}
              />
              {errors.sku && (
                <p className="mt-1 text-sm text-red-600">{errors.sku.message}</p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              rows="3"
              placeholder="Enter product description"
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" {...register('category')}>
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Brand</label>
              <select className="form-select" {...register('brand')}>
                <option value="">Select Brand</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Unit Price *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={`form-input ${errors.unitPrice ? 'border-red-500' : ''}`}
                placeholder="0.00"
                {...register('unitPrice', { 
                  required: 'Unit price is required',
                  min: { value: 0, message: 'Price must be positive' }
                })}
              />
              {errors.unitPrice && (
                <p className="mt-1 text-sm text-red-600">{errors.unitPrice.message}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Cost Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                placeholder="0.00"
                {...register('costPrice', {
                  min: { value: 0, message: 'Cost must be positive' }
                })}
              />
              {errors.costPrice && (
                <p className="mt-1 text-sm text-red-600">{errors.costPrice.message}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Reorder Level</label>
              <input
                type="number"
                min="0"
                className="form-input"
                placeholder="0"
                {...register('reorderLevel', {
                  min: { value: 0, message: 'Reorder level must be positive' }
                })}
              />
              {errors.reorderLevel && (
                <p className="mt-1 text-sm text-red-600">{errors.reorderLevel.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
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
                  {isEditing ? 'Update Product' : 'Create Product'}
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal; 