// src/components/Bookkeeping/TransactionTable.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import EditModal from "./EditModal";
import AlertModal from "../Shared/AlertModal";

// Format number in Indian style (₹ 1,00,000)
const formatINR = (num) => {
  const n = Number(num) || 0;
  return n.toLocaleString("en-IN");
};


const TransactionTable = ({ members, shgId, projectId }) => {
  const [transactions, setTransactions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [memberFilter, setMemberFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editing, setEditing] = useState(null);
  const [alertMessage, setAlertMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");

  const tableRef = useRef();

  // Convert Firestore Timestamp or string to JS Date
  const toJsDate = (val) => {
    if (!val) return null;
    try {
      if (typeof val.toDate === "function") return val.toDate();
      return new Date(val);
    } catch {
      return null;
    }
  };

  // Load transactions from Firestore
  useEffect(() => {
    if (!auth.currentUser || !projectId || !shgId) return;

    const txCol = collection(
      db,
      "artifacts",
      projectId,
      "users",
      auth.currentUser.uid,
      "shg_groups",
      shgId,
      "transactions"
    );
    const q = query(txCol, orderBy("date", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setTransactions(list);
        setLoading(false);
      },
      (err) => {
        console.error("transactions onSnapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [projectId, shgId]);

  // Apply filters (month, year, etc.)
  useEffect(() => {
    let list = [...transactions];

    list.sort((a, b) => {
      const da = toJsDate(a.date);
      const db = toJsDate(b.date);
      return db - da;
    });

    if (memberFilter) list = list.filter((t) => t.memberId === memberFilter);
    if (typeFilter) list = list.filter((t) => t.type === typeFilter);

    if (filterMonth || filterYear) {
      list = list.filter((t) => {
        const d = toJsDate(t.date);
        if (!d) return false;
        const matchMonth = filterMonth ? d.getMonth() + 1 === Number(filterMonth) : true;
        const matchYear = filterYear ? d.getFullYear() === Number(filterYear) : true;
        return matchMonth && matchYear;
      });
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter((t) => t.date && toJsDate(t.date) && toJsDate(t.date) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((t) => t.date && toJsDate(t.date) && toJsDate(t.date) <= to);
    }

    setFiltered(list);
  }, [memberFilter, typeFilter, filterMonth, filterYear, dateFrom, dateTo, transactions]);

  const clearAllFilters = () => {
    setMemberFilter("");
    setTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setFilterMonth("");
    setFilterYear("");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllOnPage = () => {
    const ids = filtered.map((t) => t.id);
    setSelectedIds(ids);
  };

  const clearSelection = () => setSelectedIds([]);

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) {
      setAlertMessage("No transactions selected.");
      return;
    }
    setAlertMessage(
      `Delete ${selectedIds.length} selected transaction(s)? This cannot be undone.`
    );
    setConfirmAction(() => async () => {
      try {
        const deletes = selectedIds.map((id) =>
          deleteDoc(
            doc(
              db,
              "artifacts",
              projectId,
              "users",
              auth.currentUser.uid,
              "shg_groups",
              shgId,
              "transactions",
              id
            )
          )
        );
        await Promise.all(deletes);
        setSelectedIds([]);
      } catch (err) {
        console.error("Bulk delete error:", err);
        setAlertMessage("Failed to delete selected transactions.");
      }
    });
  };

  const handleDelete = (id) => {
    setAlertMessage("Delete this transaction? This cannot be undone.");
    setConfirmAction(() => async () => {
      try {
        await deleteDoc(
          doc(
            db,
            "artifacts",
            projectId,
            "users",
            auth.currentUser.uid,
            "shg_groups",
            shgId,
            "transactions",
            id
          )
        );
      } catch (err) {
        console.error("Delete error:", err);
        setAlertMessage("Failed to delete transaction.");
      }
    });
  };

  const handleSaveEdit = async (updates) => {
    try {
      const txRef = doc(
        db,
        "artifacts",
        projectId,
        "users",
        auth.currentUser.uid,
        "shg_groups",
        shgId,
        "transactions",
        editing.id
      );
      await updateDoc(txRef, updates);
      setEditing(null);
    } catch (err) {
      console.error("Update transaction error:", err);
      setAlertMessage("Failed to update transaction.");
    }
  };

  const exportToXlsx = (onlyRepayments = false) => {
    const rows = filtered
      .filter((t) => !onlyRepayments || t.type === "Loan Repayment")
      .map((t) => ({
        Date: t.date && toJsDate(t.date) ? format(toJsDate(t.date), "dd-MM-yyyy") : "",
        Type: t.type,
        Member: members.find((m) => m.id === t.memberId)?.name || t.memberId || "",
        Amount: t.amount ?? "",
        PrincipalRepaid: t.principalRepaid ?? "",
        InterestRepaid: t.interestRepaid ?? "",
        LoanType: t.loanType ?? "",
        Description: t.description ?? "",
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    const fname = onlyRepayments
      ? `repayments_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`
      : `transactions_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
    XLSX.writeFile(wb, fname);
  };

  const columns = useMemo(
    () => [
      { header: "Date", accessor: "date" },
      { header: "Type", accessor: "type" },
      { header: "Member", accessor: "memberId" },
      { header: "Amount", accessor: "amount" },
      { header: "Loan Type", accessor: "loanType" },
      { header: "Principal Repaid", accessor: "principalRepaid" },
      { header: "Interest Repaid", accessor: "interestRepaid" },
      { header: "Description", accessor: "description" },
    ],
    []
  );

  if (loading) return <div>Loading transactions...</div>;

  return (
    <div ref={tableRef} className="mt-6">
      {/* ✅ Summary Counters */}
      <div className="flex justify-between items-center mb-2 text-sm text-gray-700">
        <span>
Total transactions: <strong>{formatINR(filtered.length)}</strong>
        </span>
        {selectedIds.length > 0 && (
          <span className="text-blue-600 font-semibold">
            {selectedIds.length} selected
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {/* Member Filter */}
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="border rounded p-2"
        >
          <option value="">All Members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border rounded p-2"
        >
          <option value="">All Types</option>
          <option value="Loan Disbursed">Loan Disbursed</option>
          <option value="Loan Repayment">Loan Repayment</option>
          <option value="Saving">Saving</option>
          <option value="General Saving">General Saving</option>
          <option value="Expense">Expense</option>
          <option value="Fine">Fine</option>
        </select>

        {/* Month + Year */}
        <label className="ml-2 font-semibold">Month:</label>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All</option>
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2000, i, 1).toLocaleString("en", { month: "long" })}
            </option>
          ))}
        </select>

        <label className="ml-2 font-semibold">Year:</label>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All</option>
          {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(
            (y) => (
              <option key={y} value={y}>
                {y}
              </option>
            )
          )}
        </select>

        {/* Buttons */}
        <button
          onClick={clearAllFilters}
          className="px-4 py-2 bg-orange-500 text-white rounded"
        >
          Clear Filters
        </button>
        <button
          onClick={selectAllOnPage}
          className="px-3 py-1 bg-gray-200 rounded"
        >
          Select All
        </button>
        <button
          onClick={clearSelection}
          className="px-3 py-1 bg-gray-200 rounded"
        >
          Clear Selection
        </button>
        <button
          onClick={handleBulkDelete}
          className="px-3 py-1 bg-red-500 text-white rounded"
        >
          Delete Selected
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {(() => {
          const totals = {
            Savings: 0,
            GeneralSavings: 0,
            LoansDisbursed: 0,
            LoanRepayments: 0,
            Fines: 0,
          };

          filtered.forEach((t) => {
            const amt = Number(t.amount) || 0;
            if (t.type === "Saving") totals.Savings += amt;
            else if (t.type === "General Saving") totals.GeneralSavings += amt;
            else if (t.type === "Loan Disbursed") totals.LoansDisbursed += amt;
            else if (t.type === "Loan Repayment") totals.LoanRepayments += amt;
            else if (t.type === "Fine") totals.Fines += amt;
          });

          const items = [
            { label: "Savings", value: totals.Savings, color: "bg-gray-100" },
            {
              label: "General Savings",
              value: totals.GeneralSavings,
              color: "bg-emerald-100",
            },
            {
              label: "Loans Disbursed",
              value: totals.LoansDisbursed,
              color: "bg-green-100",
            },
            {
              label: "Loan Repayments",
              value: totals.LoanRepayments,
              color: "bg-yellow-100",
            },
            { label: "Fines", value: totals.Fines, color: "bg-red-100" },
          ];

          return items.map((i) => (
            <div
              key={i.label}
              className={`p-3 rounded-lg shadow border text-center ${i.color}`}
            >
              <p className="text-sm text-gray-600">{i.label}</p>
              <p className="text-lg font-semibold">
                ₹ {formatINR(i.value)}

              </p>
            </div>
          ));
        })()}
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-2 sm:mx-0">
  <table className="w-full border-collapse text-xs sm:text-sm">
<thead>
  <tr>
    <th className="border p-2"></th>
    <th className="border p-2">Date</th>
    <th className="border p-2">Type</th>
    <th className="border p-2">Member</th>
    <th className="border p-2">Amount</th>

    {/* Hidden on small screens */}
    <th className="border p-2 hidden md:table-cell">Loan Type</th>
    <th className="border p-2 hidden lg:table-cell">Principal Repaid</th>
    <th className="border p-2 hidden lg:table-cell">Interest Repaid</th>
    <th className="border p-2 hidden md:table-cell">Description</th>

    <th className="border p-2">Actions</th>
  </tr>
</thead>
          <tbody>
            {filtered.map((t) => {
              let rowClass = "";
              if (
                t.type === "Loan Disbursed" &&
                t.loanType === "Book Loan"
              )
                rowClass = "bg-green-300";
              else if (
                t.type === "Loan Disbursed" &&
                t.loanType === "Bank Loan"
              )
                rowClass = "bg-red-200";
              else if (t.type === "Loan Repayment")
                rowClass = "bg-yellow-200";
              else if (t.type === "Saving")
                rowClass = "bg-gray-100";
              else if (t.type === "General Saving")
                rowClass = "bg-emerald-100";
              else if (t.type === "Fine") rowClass = "bg-red-200";
              else if (t.type === "Expense") rowClass = "bg-red-500";

              return (
                <tr key={t.id} className={rowClass}>
                  <td className="border p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(t.id)}
                      onChange={() => toggleSelect(t.id)}
                    />
                  </td>
                  <td className="border p-2">
                    {t.date && toJsDate(t.date)
                      ? format(toJsDate(t.date), "dd-MM-yyyy")
                      : ""}
                  </td>
                  <td className="border p-2">{t.type}</td>
                  <td className="border p-2">
                    {members.find((m) => m.id === t.memberId)?.name ||
                      t.memberId}
                  </td>
                  <td className="border p-2 text-right">{t.amount}</td>
                  <td className="border p-2 hidden md:table-cell">{t.loanType || ""}</td>
                  <td className="border p-2 hidden lg:table-cell">{t.principalRepaid || ""}</td>
                   <td className="border p-2 hidden lg:table-cell">{t.interestRepaid || ""}</td>
                  <td className="border p-2 hidden md:table-cell">{t.description || ""}</td>
                  <td className="border p-2">
                    <button
                      onClick={() => setEditing(t)}
                      className="px-2 py-1 text-xs sm:text-sm bg-yellow-500 text-white rounded mr-2"

                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="px-2 py-1 text-xs sm:text-sm bg-red-500 text-white rounded"

                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2 mt-4 mb-20">
        <button
          onClick={() => exportToXlsx(false)}
          className="px-4 py-3 bg-green-600 text-white rounded text-lg"
        >
          Export Transactions
        </button>
        <button
          onClick={() => exportToXlsx(true)}
          className="px-4 py-3 bg-blue-600 text-white rounded text-lg"
        >
          Export Loan Repayments
        </button>
      </div>

      {editing && (
        <EditModal
          transaction={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
          members={members}
        />
      )}

      <AlertModal
        show={!!alertMessage}
        message={alertMessage}
        onClose={() => setAlertMessage("")}
        confirmAction={confirmAction}
        confirmLabel="Confirm"
      />
    </div>
  );
};

export default TransactionTable;
