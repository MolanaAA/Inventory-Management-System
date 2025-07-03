import React, { useState, useEffect } from 'react';

const initialState = {
  name: '',
  address: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  phone: '',
  email: '',
  isActive: true,
};

const LocationModal = ({ open, onClose, onSave, location }) => {
  const [form, setForm] = useState(initialState);

  useEffect(() => {
    if (location) {
      setForm({ ...location });
    } else {
      setForm(initialState);
    }
  }, [location, open]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{location ? 'Edit Location' : 'Add Location'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form className="modal-body space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">Name</label>
            <input className="form-input" name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div>
            <label className="form-label">Address</label>
            <input className="form-input" name="address" value={form.address} onChange={handleChange} />
          </div>
          <div className="form-row">
            <div>
              <label className="form-label">City</label>
              <input className="form-input" name="city" value={form.city} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">State</label>
              <input className="form-input" name="state" value={form.state} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div>
              <label className="form-label">Country</label>
              <input className="form-input" name="country" value={form.country} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">Postal Code</label>
              <input className="form-input" name="postalCode" value={form.postalCode} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div>
              <label className="form-label">Phone</label>
              <input className="form-input" name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input className="form-input" name="email" value={form.email} onChange={handleChange} />
            </div>
          </div>
          {location && (
            <div>
              <label className="form-label">Active</label>
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handleChange}
                className="ml-2"
              />
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{location ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LocationModal; 