import React, { useState } from 'react';
import { FiX, FiUpload, FiDownload } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';

const CSVUploadModal = ({ products, locations, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState([]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a valid CSV file');
        return;
      }
      setFile(selectedFile);
      setErrors([]);
      setPreview(null);
      
      // Preview the file
      const reader = new FileReader();
      reader.onload = (event) => {
        const csvContent = event.target.result;
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const previewData = lines.slice(1, 6).filter(line => line.trim()).map(line => {
          const values = line.split(',').map(v => v.trim());
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });
        setPreview({ headers, data: previewData });
      };
      reader.readAsText(selectedFile);
    }
  };

  const validateCSV = (csvData) => {
    const errors = [];
    const requiredFields = ['product_sku', 'location_name', 'quantity', 'unit_price'];
    
    csvData.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because index starts at 0 and we skip header
      
      // Check required fields
      requiredFields.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          errors.push(`Row ${rowNumber}: ${field} is required`);
        }
      });
      
      // Validate quantity
      if (row.quantity && (isNaN(row.quantity) || parseInt(row.quantity) <= 0)) {
        errors.push(`Row ${rowNumber}: quantity must be a positive number`);
      }
      
      // Validate unit price
      if (row.unit_price && (isNaN(row.unit_price) || parseFloat(row.unit_price) < 0)) {
        errors.push(`Row ${rowNumber}: unit_price must be a non-negative number`);
      }
      
      // Validate email if provided
      if (row.customer_email && row.customer_email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(row.customer_email)) {
          errors.push(`Row ${rowNumber}: invalid customer_email format`);
        }
      }
      
      // Check if product exists
      const product = products.find(p => p.sku === row.product_sku);
      if (!product) {
        errors.push(`Row ${rowNumber}: product with SKU "${row.product_sku}" not found`);
      }
      
      // Check if location exists
      const location = locations.find(l => l.name === row.location_name);
      if (!location) {
        errors.push(`Row ${rowNumber}: location "${row.location_name}" not found`);
      }
    });
    
    return errors;
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a CSV file');
      return;
    }

    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/api/sales/bulk-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const { results } = response.data;
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.length - successCount;
      
      if (errorCount > 0) {
        setErrors(results.filter(r => !r.success).map(r => r.message));
        toast.error(`${successCount} sales imported, ${errorCount} failed`);
      } else {
        toast.success(`${successCount} sales imported successfully`);
        onSuccess();
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to upload CSV';
      toast.error(message);
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['product_sku', 'location_name', 'quantity', 'unit_price', 'customer_name', 'customer_email', 'customer_phone'];
    const sampleData = [
      ['LAP-001', 'Main Warehouse', '2', '1299.99', 'John Doe', 'john@example.com', '+1234567890'],
      ['ACC-001', 'West Coast Distribution', '5', '29.99', 'Jane Smith', 'jane@example.com', '+0987654321']
    ];
    
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_upload_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Upload Sales CSV</h2>
          <button onClick={onClose} className="modal-close">
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          <div className="space-y-6">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">CSV Format Requirements:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>product_sku</strong>: Product SKU (must exist in system)</li>
                <li>• <strong>location_name</strong>: Location name (must exist in system)</li>
                <li>• <strong>quantity</strong>: Number of items sold (positive integer)</li>
                <li>• <strong>unit_price</strong>: Price per unit (non-negative number)</li>
                <li>• <strong>customer_name</strong>: Customer name (optional)</li>
                <li>• <strong>customer_email</strong>: Customer email (optional, must be valid format)</li>
                <li>• <strong>customer_phone</strong>: Customer phone (optional)</li>
              </ul>
            </div>

            {/* File Upload */}
            <div className="form-group">
              <label className="form-label">Select CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="form-input"
              />
            </div>

            {/* Template Download */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={downloadTemplate}
                className="btn btn-outline flex items-center"
              >
                <FiDownload className="mr-2" />
                Download Template
              </button>
            </div>

            {/* Preview */}
            {preview && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">File Preview (first 5 rows):</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {preview.headers.map((header, index) => (
                          <th key={index} className="px-3 py-2 text-left border-b">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.data.map((row, index) => (
                        <tr key={index} className="border-b">
                          {preview.headers.map((header, headerIndex) => (
                            <td key={headerIndex} className="px-3 py-2">{row[header] || '-'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-red-900 mb-2">Validation Errors:</h4>
                <ul className="text-sm text-red-800 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
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
            type="button"
            onClick={handleUpload}
            className="btn btn-primary"
            disabled={loading || !file}
          >
            {loading ? (
              <div className="flex items-center">
                <div className="spinner mr-2"></div>
                Uploading...
              </div>
            ) : (
              <div className="flex items-center">
                <FiUpload className="mr-2" />
                Upload Sales
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CSVUploadModal; 