import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";

const TransactionForm = ({ db, userId, shgId, onClose }) => {
  const [members, setMembers] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "",
    memberId: "",
    amount: "",
    loanType: "",
    principalRepaid: "",
    interestRepaid: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);

  const projectId = db?.app?.options?.projectId || "shg-bookkeeping-app";

  // 🔹 Fetch members dynamically for the logged-in SHG
  useEffect(() => {
    const fetchMembers = async () => {
      if (!db || !userId || !shgId) return;
      try {
        const membersRef = collection(
          db,
          `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/members`
        );
        const snapshot = await getDocs(membersRef);
        const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setMembers(list);
      } catch (error) {
        console.error("Error fetching members:", error);
      }
    };
    fetchMembers();
  }, [db, userId, shgId]);

  // 🔹 Auto-calc Amount for Loan Repayment
  useEffect(() => {
    if (formData.type === "Loan Repayment") {
      const p = Number(formData.principalRepaid) || 0;
      const i = Number(formData.interestRepaid) || 0;
      setFormData((prev) => ({ ...prev, amount: p + i }));
    }
  }, [formData.principalRepaid, formData.interestRepaid, formData.type]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db || !userId || !shgId) {
      alert("⚠️ App not ready. Please try again.");
      return;
    }

    setLoading(true);
    try {
      const txRef = collection(
        db,
        `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/transactions`
      );

      await addDoc(txRef, {
        ...formData,
        amount: Number(formData.amount) || 0,
        principalRepaid: Number(formData.principalRepaid) || 0,
        interestRepaid: Number(formData.interestRepaid) || 0,
        createdAt: serverTimestamp(),
      });

      alert("✅ Transaction saved successfully!");
      setFormData({
        date: new Date().toISOString().split("T")[0],
        type: "",
        memberId: "",
        amount: "",
        loanType: "",
        principalRepaid: "",
        interestRepaid: "",
        description: "",
      });
      if (onClose) onClose();
    } catch (err) {
      console.error("Error adding transaction:", err);
      alert("❌ Failed to save transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded-2xl shadow">
      <h2 className="text-xl font-semibold mb-4">Add New Transaction</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block font-medium">Date</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className="w-full border rounded p-2"
            required
          />
        </div>

        <div>
          <label className="block font-medium">Type</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full border rounded p-2"
            required
          >
            <option value="">Select Type</option>
            <option>Saving</option>
            <option>Fine</option>
            <option>Loan Disbursed</option>
            <option>Loan Repayment</option>
          </select>
        </div>

        <div>
          <label className="block font-medium">Member</label>
          <select
            name="memberId"
            value={formData.memberId}
            onChange={handleChange}
            className="w-full border rounded p-2"
            required
          >
            <option value="">Select Member</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium">Amount</label>
          <input
            type="number"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            className="w-full border rounded p-2"
            required
            readOnly={formData.type === "Loan Repayment"}
          />
        </div>

        {(formData.type === "Loan Repayment" || formData.type === "Loan Disbursed") && (
          <div>
            <label className="block font-medium">Loan Type</label>
            <select
              name="loanType"
              value={formData.loanType}
              onChange={handleChange}
              className="w-full border rounded p-2"
              required
            >
              <option value="">Select Loan Type</option>
              <option value="Book Loan">Book Loan</option>
              <option value="Bank Loan">Bank Loan</option>
            </select>
          </div>
        )}

        {formData.type === "Loan Repayment" && (
          <>
            <div>
              <label className="block font-medium">Principal Repaid</label>
              <input
                type="number"
                name="principalRepaid"
                value={formData.principalRepaid}
                onChange={handleChange}
                className="w-full border rounded p-2"
              />
            </div>
            <div>
              <label className="block font-medium">Interest Repaid</label>
              <input
                type="number"
                name="interestRepaid"
                value={formData.interestRepaid}
                onChange={handleChange}
                className="w-full border rounded p-2"
              />
            </div>
          </>
        )}

        <div>
          <label className="block font-medium">Description</label>
          <input
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full"
        >
          {loading ? "Saving..." : "Save Transaction"}
        </button>
      </form>
    </div>
  );
};

export default TransactionForm;
