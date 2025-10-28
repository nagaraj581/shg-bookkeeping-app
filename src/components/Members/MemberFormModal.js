// src/components/Members/MemberFormModal.js
import React from "react";

export default function MemberFormModal({
  show,
  onClose,
  onSubmit,
  editingMember,
  newMemberName,
  setNewMemberName,
  newMemberMobile,
  setNewMemberMobile,
  newMemberEmail,
  setNewMemberEmail,
  newMemberJoiningDate,
  setNewMemberJoiningDate,
  newMemberDesignation,
  setNewMemberDesignation,
  newMemberAddress,
  setNewMemberAddress
}) {
  if (!show) return null;

  const title = editingMember ? "Edit Member" : "Add Member";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-auto">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800 dark:text-gray-300">
            Close
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Full name"
            />
          </div>

{/* Mobile input with static +91 prefix */}
<div>
  <label className="block text-sm font-medium mb-1">Mobile (with country code)</label>
  <div className="flex">
    <div className="inline-flex items-center px-3 rounded-l border border-r-0 bg-gray-100 dark:bg-gray-700 text-sm">
      +91
    </div>

    <input
      type="tel"
      value={newMemberMobile}
      onChange={(e) => {
        // keep only digits while typing — no other logic here
        const digits = String(e.target.value || "").replace(/\D/g, "");
        setNewMemberMobile(digits);
      }}
      className="flex-1 p-2 border rounded-r"
      placeholder="10-digit mobile number (e.g., 9123456789)"
    />
  </div>
  <p className="text-xs text-gray-500 mt-1">
    We store mobile numbers with +91 prefix. Enter the 10-digit number only (no spaces).
  </p>
</div>

          <div>
            <label className="block text-sm font-medium mb-1">Email (optional)</label>
            <input
              type="email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Designation</label>
            <input
              type="text"
              value={newMemberDesignation}
              onChange={(e) => setNewMemberDesignation(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Joining Date</label>
            <input
              type="date"
              value={newMemberJoiningDate}
              onChange={(e) => setNewMemberJoiningDate(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Address (optional)</label>
<textarea
  value={newMemberAddress || ""}
  onChange={(e) => setNewMemberAddress(e.target.value)}
  className="w-full p-2 border rounded"
  placeholder="Optional address"
  rows={3}
/>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit()}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              type="button"
            >
              {editingMember ? "Save Changes" : "Add Member"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
