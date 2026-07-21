// src/components/Bookkeeping/TransactionTable.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import EditModal from "./EditModal";
import AlertModal from "../Shared/AlertModal";

// Format number in Indian style (₹ 1,00,000)
const formatINR = (num) => {
  const n = Number(num) || 0;
  return n.toLocaleString("en-IN");
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const TransactionTable = ({
  members,
  loans = [],
  transactions = [],
  shgId,
  projectId,
  userId,
  userRole = "admin",
}) => {
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

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

  const filtered = useMemo(() => {
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

    return list;
  }, [memberFilter, typeFilter, filterMonth, filterYear, dateFrom, dateTo, transactions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const paginatedRows = filtered.slice(pageStart, pageEnd);

  useEffect(() => {
    setCurrentPage(1);
  }, [memberFilter, typeFilter, filterMonth, filterYear, dateFrom, dateTo, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
    const ids = paginatedRows.map((t) => t.id);
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
                userId,
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

  const handleDelete = (tx) => {
  setAlertMessage("Delete this transaction? This cannot be undone.");

  setConfirmAction(() => async () => {
    try {
      const txRef = doc(
        db,
        "artifacts",
        projectId,
        "users",
        userId,
        "shg_groups",
        shgId,
        "transactions",
        tx.id
      );

      // Reverse this repayment from the loan before deleting the transaction.
      if (tx.type === "Loan Repayment" && tx.loanId) {
        const loanRef = doc(
          db,
          "artifacts",
          projectId,
          "users",
          userId,
          "shg_groups",
          shgId,
          "loans",
          tx.loanId
        );

        const loanSnap = await getDoc(loanRef);

        if (loanSnap.exists()) {
          const loan = loanSnap.data();

          const principal = Number(tx.principalRepaid || 0);
          const interest = Number(tx.interestRepaid || 0);

          const oldOutstanding = Number(loan.outstandingAmount || 0);
          const oldTotalRepaid = Number(loan.totalRepaid || 0);

          const newOutstanding = oldOutstanding + principal;
          const newTotalRepaid = Math.max(
            0,
            oldTotalRepaid - (principal + interest)
          );
          const newStatus = newOutstanding > 0 ? "active" : "closed";

          await updateDoc(loanRef, {
            outstandingAmount: newOutstanding,
            totalRepaid: newTotalRepaid,
            status: newStatus,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // ✅ Now delete transaction
      await deleteDoc(txRef);
    } catch (err) {
      console.error("Delete error:", err);
      setAlertMessage("Failed to delete transaction.");
    }
  });
};

  const handleSaveEditWithLoanMove = async (updates) => {
    try {
      const txRef = doc(
        db,
        "artifacts",
        projectId,
        "users",
        userId,
        "shg_groups",
        shgId,
        "transactions",
        editing.id
      );

      if (updates.type === "Loan Repayment") {
        const oldLoanId = editing.loanId || null;
        const newLoanId = updates.loanId || editing.loanId || null;
        const oldPrincipal = parseFloat(editing.principalRepaid || 0);
        const oldInterest = parseFloat(editing.interestRepaid || 0);
        const newPrincipal = parseFloat(updates.principalRepaid || 0);
        const newInterest = parseFloat(updates.interestRepaid || 0);

        updates.amount = newPrincipal + newInterest;

        const applyLoanDelta = async (loanId, principalDelta, interestDelta) => {
          if (!loanId) return;

          const loanRef = doc(
            db,
            "artifacts",
            projectId,
            "users",
            userId,
            "shg_groups",
            shgId,
            "loans",
            loanId
          );

          const loanSnap = await getDoc(loanRef);
          if (!loanSnap.exists()) {
            throw new Error(`Loan not found for ID ${loanId}`);
          }

          const loan = loanSnap.data();
          let nextOutstanding =
            Number(loan.outstandingAmount || 0) - Number(principalDelta || 0);
          let nextTotalRepaid =
            Number(loan.totalRepaid || 0) +
            Number(principalDelta || 0) +
            Number(interestDelta || 0);

          if (nextOutstanding < 0) nextOutstanding = 0;
          if (nextTotalRepaid < 0) nextTotalRepaid = 0;

          const nextStatus = nextOutstanding <= 0 ? "closed" : "active";

          await updateDoc(loanRef, {
            outstandingAmount: nextOutstanding,
            totalRepaid: nextTotalRepaid,
            status: nextStatus,
            updatedAt: serverTimestamp(),
          });
        };

        if (oldLoanId) {
          await applyLoanDelta(oldLoanId, -oldPrincipal, -oldInterest);
        }

        if (newLoanId) {
          await applyLoanDelta(newLoanId, newPrincipal, newInterest);
        }
      }

      await updateDoc(txRef, updates);
      setEditing(null);
    } catch (err) {
      console.error("Update transaction error:", err);
      setAlertMessage("Failed to update transaction.");
    }
  };

  const getDisplayLoanId = (tx) => {
    if (tx.loanId) return tx.loanId;
    if (tx.type !== "Loan Disbursed") return "";

    const txDate = (() => {
      const d = toJsDate(tx.date);
      if (!d || Number.isNaN(d.getTime())) return "";
      return d.toISOString().slice(0, 10);
    })();

    const matches = loans.filter((loan) => {
      const loanDate = (() => {
        const d = toJsDate(loan.date);
        if (!d || Number.isNaN(d.getTime())) {
          return typeof loan.date === "string" ? loan.date.slice(0, 10) : "";
        }
        return d.toISOString().slice(0, 10);
      })();

      return (
        loan.memberId === tx.memberId &&
        String(loan.loanType || "").trim().toLowerCase() ===
          String(tx.loanType || "").trim().toLowerCase() &&
        Number(loan.principalAmount || 0) === Number(tx.amount || 0) &&
        loanDate === txDate
      );
    });

    return matches.length === 1 ? matches[0].id : "";
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
        LoanId: getDisplayLoanId(t),
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

  return (
    <div ref={tableRef} className="mt-6">
      {/* ✅ Summary Counters */}
      <div className="flex justify-between items-center mb-2 text-sm text-gray-700">
        <span>
Total transactions: <strong>{formatINR(filtered.length)}</strong>
          {filtered.length > 0 && (
            <span className="ml-2 text-gray-500">
              Showing {formatINR(pageStart + 1)}-{formatINR(pageEnd)}
            </span>
          )}
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
          <option value="Account Transfer">Account Transfer</option>
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
        {userRole === "admin" && (
          <>
            <button
              onClick={selectAllOnPage}
              className="px-3 py-1 bg-gray-200 rounded"
            >
              Select Page
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
          </>
        )}
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
    {userRole === "admin" && <th className="border p-2"></th>}
    <th className="border p-2">Date</th>
    <th className="border p-2">Type</th>
    <th className="border p-2">Member</th>
    <th className="border p-2">Amount</th>

    {/* Hidden on small screens */}
    <th className="border p-2 hidden md:table-cell">Loan Type</th>
    <th className="border p-2 hidden xl:table-cell">Loan ID</th>
    <th className="border p-2 hidden lg:table-cell">Principal Repaid</th>
    <th className="border p-2 hidden lg:table-cell">Interest Repaid</th>
    <th className="border p-2 hidden md:table-cell">Description</th>

    {userRole === "admin" && <th className="border p-2">Actions</th>}
  </tr>
</thead>
          <tbody>
            {paginatedRows.length > 0 ? (
            paginatedRows.map((t) => {
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
                  {userRole === "admin" && (
                    <td className="border p-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(t.id)}
                        onChange={() => toggleSelect(t.id)}
                      />
                    </td>
                  )}
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
                  <td className="border p-2 hidden xl:table-cell font-mono text-[11px]">{getDisplayLoanId(t)}</td>
                  <td className="border p-2 hidden lg:table-cell">{t.principalRepaid || ""}</td>
                   <td className="border p-2 hidden lg:table-cell">{t.interestRepaid || ""}</td>
                  <td className="border p-2 hidden md:table-cell">{t.description || ""}</td>
                  {userRole === "admin" && (
                    <td className="border p-2">
                      <button
                        onClick={() => setEditing(t)}
                        className="px-2 py-1 text-xs sm:text-sm bg-yellow-500 text-white rounded mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        className="px-2 py-1 text-xs sm:text-sm bg-red-500 text-white rounded"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              );
            })
            ) : (
              <tr>
                <td
                  colSpan={userRole === "admin" ? 11 : 10}
                  className="border p-6 text-center text-gray-500"
                >
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded border p-2"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage <= 1}
            className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="font-medium text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage >= totalPages}
            className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
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

      {userRole === "admin" && editing && (
        <EditModal
          transaction={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveEditWithLoanMove}
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
