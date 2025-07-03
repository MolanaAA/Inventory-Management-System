import React from 'react';
import { FiX } from 'react-icons/fi';

const TransactionHistoryModal = ({ item, onClose }) => {
  return (
    <div className="modal">
      <div className="modal-content max-w-4xl">
        <div className="modal-header">
          <h2 className="modal-title">Transaction History</h2>
          <button onClick={onClose} className="modal-close">
            <FiX />
          </button>
        </div>

        <div className="space-y-4">
          <div className="text-center text-gray-500 py-8">
            Transaction history component will be implemented here.
            <br />
            Features: View stock transaction history, filter by date, export data
          </div>
          
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

export default TransactionHistoryModal; 