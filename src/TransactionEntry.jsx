// TransactionEntry.jsx
import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/*
Props:
  db, userId, shgId, getCurrentProjectId, members (array [{id, name}]),
  onSaved(optional) - callback after successful save
  setAlertMessage, setShowAlert (from your App)
*/
export default function TransactionEntry({
  db, userId, shgId, getCurrentProjectId, members = [],
  onSaved = () => {}, setAlertMessage, setShowAlert
}) {
  const [memberId, setMemberId] = useState('');
  const [type, setType] = useState('Saving');
  const [category, setCategory] = useState('Monthly Saving');
  const [amount, setAmount] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [interestAmount, setInterestAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [savingType, setSavingType] = useState('Monthly Saving');
  const [savingSubType, setSavingSubType] = useState('');

  const transactionTypes = [
    'Saving',
    'Fine',
    'Expense',
    'Loan Disbursed',
    'Loan Repayment',
    'Bank Loan Principal',
    'Bank Loan Interest',
    'Book Loan Principal',
    'Book Loan Interest'
  ];

  const resetForm = () => {
    setMemberId('');
    setType('Saving');
    setCategory('Monthly Saving');
    setAmount('');
    setPrincipalAmount('');
    setInterestAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setSavingType('Monthly Saving');
    setSavingSubType('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db || !userId || !shgId) {
      setAlertMessage && setAlertMessage("Database or SHG not ready.");
      setShowAlert && setShowAlert(true);
      return;
    }
    if (!amount || isNaN(parseFloat(amount))) {
      setAlertMessage && setAlertMessage("Enter a valid amount.");
      setShowAlert && setShowAlert(true);
      return;
    }

    try {
      const projectId = getCurrentProjectId();
      const tx = {
        type,
        category: category || '', 
        memberId: memberId || null,
        memberName: memberId ? (members.find(m=>m.id===memberId)?.name || '') : '',
        amount: parseFloat(amount),
        principalAmount: principalAmount ? parseFloat(principalAmount) : undefined,
        interestAmount: interestAmount ? parseFloat(interestAmount) : undefined,
        date,
        description: description ? description.trim() : '',
        createdAt: serverTimestamp(),
        recordedBy: userId,
      };

      await addDoc(collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/transactions`), tx);

      setAlertMessage && setAlertMessage("Transaction recorded successfully!");
      setShowAlert && setShowAlert(true);
      resetForm();
      onSaved && onSaved(tx);
    } catch (err) {
      console.error("Error saving transaction:", err);
      setAlertMessage && setAlertMessage(`Error: ${err.message}`);
      setShowAlert && setShowAlert(true);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border rounded bg-white">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Member (optional)</label>
          <select value={memberId} onChange={(e)=>setMemberId(e.target.value)} className="w-full p-2 border rounded">
            <option value="">-- None / Group --</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Transaction Type</label>
          <select value={type} onChange={(e)=>setType(e.target.value)} className="w-full p-2 border rounded">
            {transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Date</label>
          <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full p-2 border rounded" />
        </div>

        <div className="md:col-span-3">
          <label className="block text-sm font-medium">Amount (₹)</label>
          <input value={amount} onChange={(e)=>setAmount(e.target.value)} className="w-full p-2 border rounded" placeholder="0.00" />
        </div>

        <div className="md:col-span-3">
          <label className="block text-sm font-medium">Category / Subtype</label>
          <input value={category} onChange={(e)=>setCategory(e.target.value)} className="w-full p-2 border rounded" placeholder="Monthly Saving, Penalty, etc." />
        </div>

        {/* optional principal/interest split fields (useful for repayments) */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium">Principal Amount (optional)</label>
          <input value={principalAmount} onChange={(e)=>setPrincipalAmount(e.target.value)} className="w-full p-2 border rounded" placeholder="0.00" />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium">Interest Amount (optional)</label>
          <input value={interestAmount} onChange={(e)=>setInterestAmount(e.target.value)} className="w-full p-2 border rounded" placeholder="0.00" />
        </div>

        <div className="md:col-span-6">
          <label className="block text-sm font-medium">Description (optional)</label>
          <input value={description} onChange={(e)=>setDescription(e.target.value)} className="w-full p-2 border rounded" placeholder="Notes" />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Record Transaction</button>
      </div>
    </form>
  );
}
