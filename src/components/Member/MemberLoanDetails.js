import React, { useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const parseDateValue = (value) => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatIndianDate = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return value || "";

  return parsed
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
};

export default function MemberLoanDetails({
  loans = [],
  transactions = [],
  currentMemberId,
}) {
  const memberLoans = useMemo(() => {
    return loans.filter((l) => l.memberId === currentMemberId);
  }, [loans, currentMemberId]);

  const sortedMemberLoans = useMemo(() => {
    return [...memberLoans].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [memberLoans]);

  const loanCards = useMemo(() => {
    return sortedMemberLoans.map((loan) => {
      const totalLoan = Number(
        loan.principalAmount ||
          loan.loanAmount ||
          loan.principal ||
          loan.amount ||
          loan.outstandingAmount ||
          loan.balance ||
          0
      );

      const outstanding = Number(loan.outstandingAmount || loan.balance || 0);
      const repaid = Math.max(0, totalLoan - outstanding);
      const isActive = outstanding > 0;
      const loanStart = parseDateValue(loan.date);
      const loanStartPlusOne = loanStart ? new Date(loanStart) : null;

      if (loanStartPlusOne) {
        loanStartPlusOne.setDate(loanStartPlusOne.getDate() + 1);
      }

      let cumulativePrincipal = 0;
      const paymentHistory = transactions
        .filter((tx) => {
          if (tx.type !== "Loan Repayment" || tx.loanId !== loan.id) {
            return false;
          }

          const txDate = parseDateValue(tx.date);
          if (!txDate || !loanStartPlusOne) {
            return false;
          }

          return txDate >= loanStartPlusOne;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((tx) => {
          const principalPaid = Number(tx.principalRepaid || 0);
          const interestPaid = Number(tx.interestRepaid || 0);
          const totalPaid = Number(tx.amount || principalPaid + interestPaid || 0);

          cumulativePrincipal += principalPaid;

          return {
            id: tx.id,
            date: tx.date,
            principalPaid,
            interestPaid,
            totalPaid,
            remainingOutstanding: Math.max(0, totalLoan - cumulativePrincipal),
          };
        });

      return {
        loan,
        totalLoan,
        outstanding,
        repaid,
        isActive,
        cardClass: isActive ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200",
        paymentHistory,
      };
    });
  }, [sortedMemberLoans, transactions]);

  const downloadLoanCardsPdf = () => {
    const doc = new jsPDF("p", "mm", "a4");

    doc.setFontSize(16);
    doc.text("SHG Loan Details", 14, 15);

    let currentY = 24;

    loanCards.forEach((item, index) => {
      if (index > 0) {
        currentY += 6;
      }

      doc.setFontSize(12);
      doc.text(`Loan ${index + 1}`, 14, currentY);
      currentY += 2;

      autoTable(doc, {
        startY: currentY + 2,
        theme: "grid",
        head: [["Loan Amount", "Disbursed Date", "Loan ID", "Repaid", "Outstanding", "Status"]],
        body: [[
          `Rs ${item.totalLoan}`,
          formatIndianDate(item.loan.date),
          item.loan.id || "-",
          `Rs ${item.repaid}`,
          `Rs ${item.outstanding}`,
          item.isActive ? "Active" : "Closed",
        ]],
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [29, 78, 216] },
      });

      currentY = doc.lastAutoTable.finalY + 4;

      if (item.paymentHistory.length > 0) {
        autoTable(doc, {
          startY: currentY,
          theme: "grid",
          head: [["Date", "Principal Paid", "Interest Paid", "Total Paid", "Remaining Outstanding"]],
          body: item.paymentHistory.map((row) => [
            formatIndianDate(row.date),
            `Rs ${row.principalPaid}`,
            `Rs ${row.interestPaid}`,
            `Rs ${row.totalPaid}`,
            `Rs ${row.remainingOutstanding}`,
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [5, 150, 105] },
        });

        currentY = doc.lastAutoTable.finalY + 6;
      } else {
        doc.setFontSize(9);
        doc.text("No linked repayment transactions found for this loan yet.", 14, currentY);
        currentY += 8;
      }

      if (currentY > 240 && index < loanCards.length - 1) {
        doc.addPage();
        currentY = 18;
      }
    });

    doc.save("member-loan-details.pdf");
  };

  if (!loanCards.length) {
    return (
      <div className="p-4 sm:p-6">
        <h2 className="text-xl font-bold">Loan Details</h2>
        <div className="mt-6 flex flex-col items-center text-gray-400">
          <div className="mb-2 text-sm font-semibold uppercase tracking-wide">No Loans</div>
          <div className="text-sm font-medium">No loans found</div>
          <div className="mt-1 text-xs">Loans will appear here once created</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold sm:text-2xl">My Loans</h2>
        <button
          onClick={downloadLoanCardsPdf}
          className="w-full rounded bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700 sm:w-auto"
        >
          Export Loans PDF
        </button>
      </div>

      {loanCards.map((item) => {
        const { loan, totalLoan, outstanding, repaid, isActive, cardClass, paymentHistory } = item;

        return (
          <div
            key={loan.id}
            className={`rounded-2xl border p-5 shadow-sm transition duration-200 hover:shadow-md ${cardClass}`}
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
              <div>
                <div className="text-sm text-gray-500">Loan Amount</div>
                <div className="font-bold">Rs {totalLoan}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Disbursed Date</div>
                <div className="font-bold">{formatIndianDate(loan.date)}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Loan ID</div>
                <div className="break-all font-bold">{loan.id || "-"}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Repaid</div>
                <div className="font-bold text-green-600">Rs {repaid}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Outstanding</div>
                <div className="font-bold text-red-600">Rs {outstanding}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Status</div>
                <div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      isActive
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-600"
                    }`}
                  >
                    {isActive ? "Active" : "Closed"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="mb-3 text-md font-semibold text-gray-800">
                Payment History
              </h3>

              {paymentHistory.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-gray-400">
                  <div className="text-sm font-medium">No repayment history</div>
                </div>
              ) : (
                <div>
                  <div className="space-y-3 sm:hidden">
                    {paymentHistory.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-gray-100 bg-white/70 p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-gray-800">
                            {formatIndianDate(row.date)}
                          </div>
                          <div className="text-sm font-semibold text-red-600">
                            Rs {row.remainingOutstanding}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-gray-600">
                          <div>
                            <div className="text-gray-400">Principal</div>
                            <div className="mt-1 font-medium text-gray-800">Rs {row.principalPaid}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Interest</div>
                            <div className="mt-1 font-medium text-gray-800">Rs {row.interestPaid}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Total</div>
                            <div className="mt-1 font-medium text-gray-800">Rs {row.totalPaid}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                        <tr>
                          <th className="text-left px-4 py-3">Date</th>
                          <th className="text-right px-4 py-3">Principal</th>
                          <th className="text-right px-4 py-3">Interest</th>
                          <th className="text-right px-4 py-3">Total</th>
                          <th className="text-right px-4 py-3">Balance</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {paymentHistory.map((row) => (
                          <tr
                            key={row.id}
                            className="hover:bg-gray-50 transition duration-150"
                          >
                            <td className="px-4 py-3 text-gray-700">
                              {formatIndianDate(row.date)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              Rs {row.principalPaid}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              Rs {row.interestPaid}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              Rs {row.totalPaid}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-red-600">
                              Rs {row.remainingOutstanding}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
