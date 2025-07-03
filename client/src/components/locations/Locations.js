import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import LocationModal from './LocationModal';
import { FiEdit, FiTrash2, FiPlus } from 'react-icons/fi';

const Locations = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editLocation, setEditLocation] = useState(null);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/locations', { params: { limit: 100 } });
      setLocations(res.data.locations || []);
    } catch (err) {
      toast.error('Failed to fetch locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleAdd = () => {
    setEditLocation(null);
    setModalOpen(true);
  };

  const handleEdit = (location) => {
    setEditLocation(location);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;
    try {
      await axios.delete(`/api/locations/${id}`);
      toast.success('Location deleted');
      fetchLocations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleSave = async (form) => {
    try {
      if (editLocation) {
        await axios.put(`/api/locations/${editLocation.id}`, form);
        toast.success('Location updated');
      } else {
        await axios.post('/api/locations', form);
        toast.success('Location created');
      }
      setModalOpen(false);
      fetchLocations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Locations</h1>
        <button className="btn btn-primary flex items-center" onClick={handleAdd}>
          <FiPlus className="mr-2" /> Add Location
        </button>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        {loading ? (
          <div className="flex justify-center py-8">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {locations.map((loc) => (
                  <tr key={loc.id}>
                    <td className="px-4 py-2 font-medium">{loc.name}</td>
                    <td className="px-4 py-2">{loc.city}</td>
                    <td className="px-4 py-2">{loc.state}</td>
                    <td className="px-4 py-2">{loc.country}</td>
                    <td className="px-4 py-2">
                      {loc.is_active ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-danger">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-2 flex space-x-2">
                      <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(loc)}>
                        <FiEdit />
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(loc.id)}>
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <LocationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        location={editLocation}
      />
    </div>
  );
};

export default Locations; 