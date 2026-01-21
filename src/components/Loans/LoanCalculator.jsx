import React, { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const formatINR = (num) =>
  Number(num || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formatRs = (num) => formatINR(num); // no ₹ symbol


const LoanCalculator = ({ members = [] }) => {
  const [loanAmount, setLoanAmount] = useState("");
  const [monthlyPrincipal, setMonthlyPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
const [selectedMemberId, setSelectedMemberId] = useState("");

  const today = new Date()
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");

    const selectedMember = members.find(m => m.id === selectedMemberId);
const memberName = selectedMember?.name || "__________";


  // 🔢 Repayment Schedule (Fixed Principal + Reducing Interest)
  const schedule = useMemo(() => {
    const P = Number(loanAmount);
    const MP = Number(monthlyPrincipal);
    const R = Number(interestRate) / 100;

    if (!P || !MP || !R) return [];

    const months = Math.ceil(P / MP);
    let balance = P;

    return Array.from({ length: months }, (_, i) => {
      const principal = balance >= MP ? MP : balance; // last month adjust
      const interest = balance * R;
      const total = principal + interest;
      const opening = balance;

      balance = Math.max(balance - principal, 0);

      return {
        month: i + 1,
        opening,
        principal,
        interest,
        total,
        closing: balance,
      };
    });
  }, [loanAmount, monthlyPrincipal, interestRate]);

  // 🔢 Totals
  const totals = useMemo(() => {
    return schedule.reduce(
      (acc, r) => {
        acc.principal += r.principal;
        acc.interest += r.interest;
        acc.total += r.total;
        return acc;
      },
      { principal: 0, interest: 0, total: 0 }
    );
  }, [schedule]);

  // 📄 PDF Generator (ONE PAGE)
const generatePDF = () => {
  if (schedule.length === 0) return;

  const doc = new jsPDF("p", "mm", "a4");

  // Title
 // Title (compressed)
doc.setFontSize(14);
doc.text("SHG Loan Repayment Schedule", 105, 14, { align: "center" });

doc.setFontSize(9);
doc.text("(All amounts in Rupees)", 105, 19, { align: "center" });

// Header row (2-column layout)
doc.setFontSize(10);
doc.text(`Member : ${memberName}`, 14, 28);
doc.text(`Date : ${today}`, 140, 28);

// Loan summary (single compact block)
doc.setFontSize(9);
doc.text(
  `Loan : Rs. ${formatINR(loanAmount)}    Principal : Rs. ${formatINR(monthlyPrincipal)}    Interest : ${interestRate}%    Tenure : ${schedule.length} months`,
  14,
  35
);


  // Table
autoTable(doc, {
  startY: 42,
  theme: "grid",

  head: [[
    "Month",
    "Opening",
    "Principal",
    "Interest",
    "Total",
    "Closing",
  ]],

  body: schedule.map((r) => [
    r.month,
    formatINR(r.opening),
    formatINR(r.principal),
    formatINR(r.interest),
    formatINR(r.total),
    formatINR(r.closing),
  ]),

  styles: {
    fontSize: 8,          // 🔽 smaller text
    cellPadding: 1.2,     // 🔽 tighter rows
    lineColor: [0, 0, 0],
    lineWidth: 0.08,
    minCellHeight: 5,     // 🔽 compact height
    valign: "middle",
  },

  headStyles: {
    fillColor: [230, 230, 230],
    textColor: 0,
    fontStyle: "bold",
    halign: "center",
    cellPadding: 1.5,
  },

  columnStyles: {
    0: { halign: "center", cellWidth: 14 }, // Month
    1: { halign: "right",  cellWidth: 28 }, // Opening
    2: { halign: "right",  cellWidth: 28 }, // Principal
    3: { halign: "right",  cellWidth: 24 }, // Interest
    4: { halign: "right",  cellWidth: 24 }, // Total
    5: { halign: "right",  cellWidth: 28 }, // Closing
  },

  margin: { left: 10, right: 10 }, // 🔽 tighter margins
});

  // ✅ DEFINE finalY FIRST
  const finalY = doc.lastAutoTable.finalY + 8;

  // Totals (USE finalY AFTER it exists)
 doc.setFontSize(11);
doc.setFont(undefined, "bold");
doc.text(`Total Principal : Rs. ${formatINR(totals.principal)}`, 14, finalY);
doc.text(`Total Interest  : Rs. ${formatINR(totals.interest)}`, 14, finalY + 7);
doc.text(`Grand Total     : Rs. ${formatINR(totals.total)}`, 14, finalY + 14);
doc.setFont(undefined, "normal");

  // Save
  doc.save(`Loan_Schedule_${memberName || "Member"}.pdf`);
};



  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold text-blue-700 mb-6">
        🧮 SHG Loan Calculator
      </h2>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <input
          type="number"
          placeholder="Loan Amount (₹)"
          value={loanAmount}
          onChange={(e) => setLoanAmount(e.target.value)}
          className="p-3 border rounded-md"
        />
        <input
          type="number"
          placeholder="Monthly Principal (₹)"
          value={monthlyPrincipal}
          onChange={(e) => setMonthlyPrincipal(e.target.value)}
          className="p-3 border rounded-md"
        />
        <input
          type="number"
          placeholder="Interest % (monthly)"
          value={interestRate}
          onChange={(e) => setInterestRate(e.target.value)}
          className="p-3 border rounded-md"
        />
      </div>

      <select
  value={selectedMemberId}
  onChange={(e) => setSelectedMemberId(e.target.value)}
  className="p-3 border rounded-md mb-3 w-full"
>
  <option value="">Select Member</option>
  {members.map((m) => (
    <option key={m.id} value={m.id}>
      {m.name}
    </option>
  ))}
</select>


      {schedule.length > 0 && (
        <div className="text-sm text-gray-600 mb-4">
          📅 Tenure: <strong>{schedule.length} months</strong>
        </div>
      )}

      {/* Table */}
      {schedule.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-300 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2">Month</th>
                  <th className="border p-2">Opening</th>
                  <th className="border p-2">Principal</th>
                  <th className="border p-2">Interest</th>
                  <th className="border p-2">Total</th>
                  <th className="border p-2">Closing</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((r) => (
                  <tr key={r.month}>
                    <td className="border p-2 text-center">{r.month}</td>
                    <td className="border p-2">₹{formatINR(r.opening)}</td>
                    <td className="border p-2">₹{formatINR(r.principal)}</td>
                    <td className="border p-2">₹{formatINR(r.interest)}</td>
                    <td className="border p-2 font-semibold">
                      ₹{formatINR(r.total)}
                    </td>
                    <td className="border p-2">₹{formatINR(r.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-green-100 rounded">
              Principal: ₹{formatINR(totals.principal)}
            </div>
            <div className="p-3 bg-yellow-100 rounded">
              Interest: ₹{formatINR(totals.interest)}
            </div>
            <div className="p-3 bg-blue-100 rounded font-bold">
              Total: ₹{formatINR(totals.total)}
            </div>
          </div>

          {/* PDF */}
          <button
            onClick={generatePDF}
            className="mt-6 px-6 py-2 bg-red-600 text-white rounded-md"
          >
            📄 Download PDF
          </button>
        </>
      )}
    </div>
  );
};

export default LoanCalculator;
