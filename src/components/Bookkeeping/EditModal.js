// src/components/Bookkeeping/EditModal.js
import React, { useEffect, useState } from "react";

// helper: format Date -> yyyy-mm-dd
function toDateInputValue(d) {
  if (!d) return "";

  try {
    // Firestore Timestamp
    if (typeof d.toDate === "function") d = d.toDate();

    // If it's an object with seconds (Firestore raw)
    if (typeof d === "object" && d.seconds) {
      d = new Date(d.seconds * 1000);
    }

    // Convert to Date if it's a string or number
    if (typeof d === "string" || typeof d === "number") {
      const parsed = new Date(d);
      if (!isNaN(parsed)) d = parsed;
    }

    // At this point, ensure it's a valid Date
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  } catch (err) {
    console.error("toDateInputValue error:", err, d);
    return "";
  }
}
export default function EditModal({ transaction: tx, onClose, onSave, members = [] }) {
  const [form, setForm] = useState({
    date: toDateInputValue(tx?.date || tx?._date),
    type: tx?.type || "",
    memberId: tx?.memberId || "",
    amount: tx?.amount ?? "",
    loanType: tx?.loanType || "",
    principalRepaid: tx?.principalRepaid ?? "",
    interestRepaid: tx?.interestRepaid ?? "",
    description: tx?.description ?? "",
  });

  useEffect(() => {
    setForm({
      date: toDateInputValue(tx?.date || tx?._date),
      type: tx?.type || "",
      memberId: tx?.memberId || "",
      amount: tx?.amount ?? "",
      loanType: tx?.loanType || "",
      principalRepaid: tx?.principalRepaid ?? "",
      interestRepaid: tx?.interestRepaid ?? "",
      description: tx?.description ?? "",
    });
  }, [tx]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const updates = {
      date: form.date ? new Date(form.date) : tx.date || new Date(),
      memberId: form.memberId || tx.memberId,
      type: form.type || tx.type,
      amount: form.amount === "" ? 0 : parseFloat(form.amount),
      loanType: form.loanType || "",
      description: form.description || "",
      principalRepaid: form.principalRepaid === "" ? 0 : parseFloat(form.principalRepaid),
      interestRepaid: form.interestRepaid === "" ? 0 : parseFloat(form.interestRepaid),
    };

    try {
      await onSave(updates);
    } catch (err) {
      console.error("Edit save error:", err);
      alert("Failed to save changes.");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <h3 className="m-0 text-lg font-semibold">Edit Transaction</h3>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Date, Member, Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control w-full border p-2 rounded"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">Member</label>
              <select
                className="form-control w-full border p-2 rounded"
                value={form.memberId}
                onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                required
              >
                <option value="">-- Select Member --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.fullName || m.displayName || m.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Type</label>
              <select
                className="form-control w-full border p-2 rounded"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option>Saving</option>
                <option>Loan Disbursed</option>
                <option>Loan Repayment</option>
                <option>Fine</option>
                <option>Expense</option>
                <option>General Saving</option>
              </select>
            </div>
          </div>

          {/* Amount + Loan Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="form-label">Amount</label>
              <input
                type="number"
                className="form-control w-full border p-2 rounded"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Loan Type</label>
              <select
                className="form-control w-full border p-2 rounded"
                value={form.loanType}
                onChange={(e) => setForm({ ...form, loanType: e.target.value })}
              >
                <option value="">-- None --</option>
                <option value="Book Loan">Book Loan</option>
                <option value="Bank Loan">Bank Loan</option>
              </select>
            </div>
          </div>

          {/* Loan Repayment Fields */}
          {form.type === "Loan Repayment" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Principal Repaid</label>
                <input
                  type="number"
                  className="form-control w-full border p-2 rounded"
                  value={form.principalRepaid}
                  onChange={(e) =>
                    setForm({ ...form, principalRepaid: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="form-label">Interest Repaid</label>
                <input
                  type="number"
                  className="form-control w-full border p-2 rounded"
                  value={form.interestRepaid}
                  onChange={(e) =>
                    setForm({ ...form, interestRepaid: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="form-label">Description</label>
            <textarea
              rows={2}
              className="form-control w-full border p-2 rounded"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Optional description or notes"
            />
          </div>

          {/* Buttons */}
          <div className="text-end pt-2">
            <button
              type="button"
              className="btn btn-secondary me-2"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
