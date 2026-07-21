import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import MemberLoanDetails from "./MemberLoanDetails";

const formatDate = (date) => {
  if (!date) return "";

  const d = new Date(date);

  return d
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
};

const SECTION_CARDS = [
  { key: "All", label: "All Details" },
  { key: "Saving", label: "Savings" },
  { key: "Loan Disbursed", label: "Loan Disbursed" },
  { key: "Loan Repayment", label: "Loan Repayment" },
  { key: "Fine", label: "Fine" },
  { key: "My Loans", label: "My Loans" },
];

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();

export default function MemberDashboard({
  members = [],
  transactions = [],
  loans = [],
  currentUserEmail,
  onLogout,
}) {
  const [typeFilter, setTypeFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchText, setSearchText] = useState("");

  const member = members.find(
    (m) => normalizeEmail(m.email) === normalizeEmail(currentUserEmail)
  );

  const memberTransactions = useMemo(() => {
    if (!member) return [];

    return transactions
      .filter((t) => t.memberId === member.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, member]);

  const filteredTransactions = useMemo(() => {
    return memberTransactions.filter((t) => {
      if (typeFilter !== "All" && t.type !== typeFilter) {
        return false;
      }

      if (fromDate && t.date < fromDate) {
        return false;
      }

      if (toDate && t.date > toDate) {
        return false;
      }

      if (searchText && !t.type.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [memberTransactions, typeFilter, fromDate, toDate, searchText]);

  const savingsTotal = useMemo(() => {
    return memberTransactions
      .filter((t) => t.type === "Saving")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [memberTransactions]);

  const finesTotal = useMemo(() => {
    return memberTransactions
      .filter((t) => t.type === "Fine")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [memberTransactions]);

  const loanPaid = useMemo(() => {
    return memberTransactions
      .filter((t) => t.type === "Loan Repayment")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [memberTransactions]);

  const loanBalance = useMemo(() => {
    return loans
      .filter((l) => l.memberId === member?.id)
      .reduce((sum, l) => sum + (Number(l.outstandingAmount) || 0), 0);
  }, [loans, member]);

  const sectionCounts = useMemo(
    () => ({
      All: memberTransactions.length,
      Saving: memberTransactions.filter((t) => t.type === "Saving").length,
      "Loan Disbursed": memberTransactions.filter((t) => t.type === "Loan Disbursed").length,
      "Loan Repayment": memberTransactions.filter((t) => t.type === "Loan Repayment").length,
      Fine: memberTransactions.filter((t) => t.type === "Fine").length,
      "My Loans": loans.filter((l) => l.memberId === member?.id).length,
    }),
    [memberTransactions, loans, member]
  );

  const showLoanSection = typeFilter === "My Loans";

  const downloadStatement = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const today = new Date().toLocaleDateString();

    doc.setFontSize(16);
    doc.text("SHG Member Statement", 105, 15, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Member: ${member.name}`, 14, 25);
    doc.text(`Generated: ${today}`, 150, 25);

    autoTable(doc, {
      startY: 35,
      head: [["Date", "Type", "Amount"]],
      body: filteredTransactions.map((t) => [
        formatDate(t.date),
        t.type,
        `Rs ${t.amount}`,
      ]),
    });

    doc.save(`${member.name}_SHG_Statement.pdf`);
  };

  if (!member) {
    return <div className="p-6">Member not found</div>;
  }

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold sm:text-2xl">Welcome {member.name}</h2>

        <button
          onClick={onLogout}
          className="w-full rounded bg-red-600 px-4 py-2 text-white transition hover:bg-red-700 sm:w-auto"
        >
          Log Out
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border-l-4 border-green-500 bg-white p-4 shadow-md">
          <div className="text-sm text-gray-500">Total Savings</div>
          <div className="text-2xl font-bold text-green-600">Rs {savingsTotal}</div>
        </div>

        <div className="rounded-xl border-l-4 border-yellow-500 bg-white p-4 shadow-md">
          <div className="text-sm text-gray-500">Fines Paid</div>
          <div className="text-2xl font-bold text-yellow-600">Rs {finesTotal}</div>
        </div>

        <div className="rounded-xl border-l-4 border-blue-500 bg-white p-4 shadow-md">
          <div className="text-sm text-gray-500">Loan Repaid</div>
          <div className="text-2xl font-bold text-blue-600">Rs {loanPaid}</div>
        </div>

        <div className="rounded-xl border-l-4 border-red-500 bg-white p-4 shadow-md">
          <div className="text-sm text-gray-500">Loan Balance</div>
          <div className="text-2xl font-bold text-red-600">Rs {loanBalance}</div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium text-gray-600">Quick Sections</div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {SECTION_CARDS.map((section) => {
              const isActive = typeFilter === section.key;

              return (
                <button
                  key={section.key}
                  onClick={() => setTypeFilter(section.key)}
                  className={`min-h-[88px] rounded-xl border p-4 text-left transition ${
                    isActive
                      ? "border-blue-600 bg-blue-600 text-white shadow"
                      : "border-gray-200 bg-white text-gray-900 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  <div className="text-sm font-semibold">{section.label}</div>
                  <div className={`mt-1 text-xs ${isActive ? "text-blue-100" : "text-gray-500"}`}>
                    {sectionCounts[section.key]} record(s)
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div>
                <label className="text-xs text-gray-500">Search</label>
                <input
                  type="text"
                  placeholder="Search type..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-40"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm sm:w-auto"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm sm:w-auto"
                />
              </div>
            </div>

            {typeFilter !== "My Loans" && (
              <button
                onClick={downloadStatement}
                className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 lg:w-auto"
              >
                Download Statement
              </button>
            )}
          </div>
        </div>
      </div>

      {typeFilter !== "My Loans" && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Transactions</h3>
            <span className="text-sm text-gray-500">{filteredTransactions.length} records</span>
          </div>

          <div className="rounded-2xl border bg-white shadow-sm">
            {filteredTransactions.length === 0 ? (
              <div className="py-12 text-center">
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <div className="mb-2 text-sm font-semibold uppercase tracking-wide">
                    No Records
                  </div>
                  <div className="text-sm font-medium">No records found</div>
                  <div className="mt-1 text-xs text-gray-400">
                    Try adjusting filters or date range
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3 p-3 sm:hidden">
                  {filteredTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-800">{tx.type}</div>
                          <div className="mt-1 text-xs text-gray-500">{formatDate(tx.date)}</div>
                        </div>
                        <div className="text-sm font-semibold text-gray-900">Rs {tx.amount}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                      <tr>
                        <th className="text-left px-6 py-3">Date</th>
                        <th className="text-left px-6 py-3">Type</th>
                        <th className="text-right px-6 py-3">Amount</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {filteredTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className="hover:bg-gray-50 transition duration-150"
                        >
                          <td className="px-6 py-4 text-gray-700">{formatDate(tx.date)}</td>
                          <td className="px-6 py-4 text-gray-600">{tx.type}</td>
                          <td className="px-6 py-4 text-right font-medium text-gray-800">Rs {tx.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {showLoanSection && (
        <MemberLoanDetails
          loans={loans}
          transactions={transactions}
          currentMemberId={member.id}
        />
      )}
    </div>
  );
}
