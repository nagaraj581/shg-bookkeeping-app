import React, { useState, useEffect, useMemo } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Format number in Indian style (₹ 1,00,000)
const formatINR = (num) => {
  const n = Number(num) || 0;
  return n.toLocaleString("en-IN");
};


export default function ReportsScreen({
  members = [],
  transactions = [],
  loans = [],
  sbBalance = 0,
  odBalance = 0,
}) {
  const [selectedMember, setSelectedMember] = useState("ALL");
  const [includeSections, setIncludeSections] = useState({
    savings: true,
    repayments: true,
    loans: true,
  });

  const [totals, setTotals] = useState({
    savings: 0,
    generalSavings: 0,
    loansDisbursed: 0,
    loansRepaid: 0,
    expenses: 0,
    fines: 0,
  });

  const [savingsByMember, setSavingsByMember] = useState([]);
  const [repaymentsByMember, setRepaymentsByMember] = useState([]);
  const [outstandingLoans, setOutstandingLoans] = useState([]);
  const [loanFilter, setLoanFilter] = useState("ALL");
 const [showClosedLoans, setShowClosedLoans] = useState(() => {
  // load previous value if it exists
  const saved = localStorage.getItem("showClosedLoans");
  return saved ? JSON.parse(saved) : false;
});


  // ✅ Fixed PDF generation
const handleGeneratePDF = async () => {
  try {
    const validSections = [];

    // ✅ Only include open & selected sections
    const checkSection = (id, include) => {
      if (!include) return;
      const detailsEl = document.querySelector(`${id} details`);
      if (detailsEl && detailsEl.open) {
        validSections.push(document.querySelector(id));
      }
    };

    checkSection("#report-savings", includeSections.savings);
    checkSection("#report-repayments", includeSections.repayments);
    checkSection("#report-loans", includeSections.loans);

    if (validSections.length === 0) {
      alert("Please open at least one section to include in the PDF.");
      return;
    }

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginTop = 25;

    // ✅ Header for each page
    const drawHeader = (pdfInstance, pageNumber) => {
      const today = new Date().toLocaleDateString("en-IN");
      const title = "KUDRADI SHG REPORT";

      try {
        pdfInstance.addImage("/logo192.png", "PNG", 10, 5, 12, 12);
      } catch {
        console.warn("Logo not found or failed to load.");
      }

      pdfInstance.setFont("helvetica", "bold");
      pdfInstance.setFontSize(14);
      pdfInstance.text(title, pageWidth / 2, 12, { align: "center" });

      pdfInstance.setFont("helvetica", "normal");
      pdfInstance.setFontSize(10);
      pdfInstance.text(`Date: ${today}`, pageWidth - 20, 12, { align: "right" });
      pdfInstance.line(10, 18, pageWidth - 10, 18);
    };

    drawHeader(pdf, 1);
    let yPosition = marginTop;

    // ✅ Loop through each visible section
    for (let i = 0; i < validSections.length; i++) {
      const section = validSections[i];
      await new Promise((res) => setTimeout(res, 400));

      // 🧱 Clone section for stable rendering
      const cloned = section.cloneNode(true);
      document.body.appendChild(cloned);
      cloned.style.position = "absolute";
      cloned.style.left = "-9999px";
      cloned.style.width = "900px";
      cloned.style.background = "white";

      const canvas = await html2canvas(cloned, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: document.documentElement.scrollWidth,
      });
      document.body.removeChild(cloned);

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // ✅ Split if content is taller than one page
      if (imgHeight > pageHeight - marginTop) {
        const totalParts = Math.ceil(imgHeight / (pageHeight - marginTop));
        const partHeight = canvas.height / totalParts;

        for (let p = 0; p < totalParts; p++) {
          const partCanvas = document.createElement("canvas");
          const ctx = partCanvas.getContext("2d");
          partCanvas.width = canvas.width;
          partCanvas.height = partHeight;

          ctx.drawImage(
            canvas,
            0,
            p * partHeight,
            canvas.width,
            partHeight,
            0,
            0,
            canvas.width,
            partHeight
          );

          const partImgData = partCanvas.toDataURL("image/jpeg", 1.0);
          const partImgHeight = (partCanvas.height * imgWidth) / partCanvas.width;

          if (yPosition + partImgHeight > pageHeight - 20) {
            pdf.addPage();
            drawHeader(pdf, i + 1);
            yPosition = marginTop;
          }

          pdf.addImage(partImgData, "JPEG", 0, yPosition, imgWidth, partImgHeight);
          yPosition += partImgHeight + 10;
        }
      } else {
        // ✅ Normal short section
        if (yPosition + imgHeight > pageHeight - 20) {
          pdf.addPage();
          drawHeader(pdf, i + 1);
          yPosition = marginTop;
        }
        pdf.addImage(imgData, "JPEG", 0, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 10;
      }
    }

    // ✅ Footer with page numbers + credit
    const totalPages = pdf.internal.getNumberOfPages();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      // Page number (center)
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, {
        align: "center",
      });

      // Author credit (right-aligned)
      pdf.text(
        "Generated by Nagaraj Acharya — Kudradi SHG",
        pageWidth - 10,
        pageHeight - 10,
        { align: "right" }
      );
    }

    // ✅ Save file
    const date = new Date().toISOString().split("T")[0];
    pdf.save(`KUDRADI_SHG_Report_${date}.pdf`);
  } catch (err) {
    console.error("PDF generation error:", err);
    alert("Failed to generate PDF. Check console for details.");
  }
};

  // 🔹 Compute totals and savings breakdown
  useEffect(() => {
    let savings = 0,
      generalSavings = 0,
      loansDisbursed = 0,
      loansRepaid = 0,
      expenses = 0,
      fines = 0;

    let savingsMap = {};
    let repaymentsMap = {};

    transactions.forEach((t) => {
      const member =
        t.memberName ||
        members.find((m) => m.id === t.memberId)?.name ||
        "Unknown";

      if (selectedMember !== "ALL" && member !== selectedMember) return;
      const tType = (t.type || "").trim().toLowerCase();

      switch (tType) {
        case "saving":
          savings += Number(t.amount) || 0;
          savingsMap[member] =
            (savingsMap[member] || 0) + (Number(t.amount) || 0);
          break;

        case "general saving":
          generalSavings += Number(t.amount) || 0;
          break;

        case "fine":
          fines += Number(t.amount) || 0;
          break;

        case "loan disbursed":
          loansDisbursed += Number(t.amount) || 0;
          break;

        case "loan repayment":
          const repaid =
            (Number(t.principalRepaid) || 0) +
            (Number(t.interestRepaid) || 0);
          loansRepaid += repaid;
          repaymentsMap[member] =
            (repaymentsMap[member] || 0) + repaid;
          break;

        case "expense":
          expenses += Number(t.amount) || 0;
          break;

        default:
          break;
      }
    });

    setTotals({
      savings,
      generalSavings,
      loansDisbursed,
      loansRepaid,
      expenses,
      fines,
    });

    setSavingsByMember(
      Object.entries(savingsMap).map(([name, total]) => ({
        name,
        total,
      }))
    );
    setRepaymentsByMember(
      Object.entries(repaymentsMap).map(([name, total]) => ({
        name,
        total,
      }))
      
    );
    
    

const activeLoans = loans.filter((l) => {
  const outstanding = Number(l.outstandingAmount ?? 0);
  const status = (l.status || "").toLowerCase();

  // if toggle is ON, show all (both active and closed)
  if (showClosedLoans) return true;

  // otherwise, show only active loans with money due
  return status !== "closed" && outstanding > 0;
});

setOutstandingLoans(activeLoans);
  }, [selectedMember, transactions, loans, members, showClosedLoans]);
  useEffect(() => {
  localStorage.setItem("showClosedLoans", JSON.stringify(showClosedLoans));
}, [showClosedLoans]);

  const loanSummary = useMemo(() => {
    const list = Array.isArray(outstandingLoans)
      ? outstandingLoans
      : [];
    const isBook = (l) =>
      (l.loanType || "").toLowerCase().includes("book");
    const isBank = (l) =>
      (l.loanType || "").toLowerCase().includes("bank");
    const toNum = (x) => Number(x || 0);

    const bookList = list.filter(isBook);
    const bankList = list.filter(isBank);
    const bookTotal = bookList.reduce(
      (s, l) => s + toNum(l.outstandingAmount),
      0
    );
    const bankTotal = bankList.reduce(
      (s, l) => s + toNum(l.outstandingAmount),
      0
    );

    return {
      allCount: list.length,
      bookCount: bookList.length,
      bankCount: bankList.length,
      bookTotal,
      bankTotal,
      combined: bookTotal + bankTotal,
    };
  }, [outstandingLoans]);

  const loansToShow = useMemo(() => {
    if (!Array.isArray(outstandingLoans)) return [];
    if (loanFilter === "BOOK")
      return outstandingLoans.filter((l) =>
        (l.loanType || "").toLowerCase().includes("book")
      );
    if (loanFilter === "BANK")
      return outstandingLoans.filter((l) =>
        (l.loanType || "").toLowerCase().includes("bank")
      );
    return outstandingLoans;
  }, [outstandingLoans, loanFilter]);

  return (
    <div className="p-6 space-y-8">
      <h2 className="text-2xl font-bold">Reports</h2>

      {/* Filter + PDF options */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="mr-2 font-semibold">Select Member:</label>
          <select
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="ALL">All Members</option>
            {members.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <label className="font-semibold">Select Sections:</label>
        {["savings", "repayments", "loans"].map((key) => (
          <label key={key} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={includeSections[key]}
              onChange={(e) =>
                setIncludeSections({
                  ...includeSections,
                  [key]: e.target.checked,
                })
              }
            />
            {key === "savings"
              ? "Savings"
              : key === "repayments"
              ? "Loan Repayments"
              : "Outstanding Loans"}
          </label>
        ))}

        <button
          onClick={handleGeneratePDF}
          className="ml-auto px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          📄 Generate PDF Report
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-green-100 shadow rounded-lg p-4 text-center">
          <h3 className="text-sm font-semibold text-gray-700">
            Total Savings
          </h3>
          <p className="text-xl font-bold text-green-700">
            ₹ {formatINR(totals.savings)}
          </p>
        </div>
        <div className="bg-emerald-100 shadow rounded-lg p-4 text-center">
          <h3 className="text-sm font-semibold text-gray-700">
            General Savings
          </h3>
          <p className="text-xl font-bold text-emerald-700">
            ₹ {formatINR(totals.generalSavings)}
          </p>
        </div>
        <div className="bg-blue-100 shadow rounded-lg p-4 text-center">
          <h3 className="text-sm font-semibold text-gray-700">
            Total Loans Disbursed
          </h3>
          <p className="text-xl font-bold text-red-600">
           ₹ {formatINR(totals.loansDisbursed)}
          </p>
        </div>
        <div className="bg-yellow-100 shadow rounded-lg p-4 text-center">
          <h3 className="text-sm font-semibold text-gray-700">
            Loans Repaid
          </h3>
          <p className="text-xl font-bold text-blue-700">
            ₹ {formatINR(totals.loansRepaid)}
          </p>
        </div>
        <div className="bg-pink-50 shadow rounded-lg p-4 text-center">
          <h3 className="text-sm font-semibold text-gray-700">Expenses</h3>
          <p className="text-xl font-bold text-orange-700">
            ₹ {formatINR(totals.expenses)}
          </p>
        </div>
        <div className="bg-red-100 shadow rounded-lg p-4 text-center">
          <h3 className="text-sm font-semibold text-gray-700">Fines</h3>
          <p className="text-xl font-bold text-pink-700">
            ₹ {formatINR(totals.fines)}
          </p>
        </div>
      </div>

      {/* 💰 Savings by Member */}
      <div id="report-savings" className="bg-white shadow rounded-lg p-6">
        <details className="group" open>
          <summary className="flex justify-between items-center cursor-pointer list-none">
            <h3 className="text-lg font-bold">💰 Savings by Member</h3>
            <span className="text-gray-500 group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>
             <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border text-left">Member</th>
                  <th className="p-2 border text-right">Total Savings (₹)</th>
                </tr>
              </thead>
              <tbody>
                {savingsByMember.length ? (
                  savingsByMember.map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="p-2 border">{item.name}</td>
                      <td className="p-2 border text-green-600 text-right font-semibold">
                        ₹ {formatINR(item.total)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="2" className="p-2 text-center text-gray-500">
                      No data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      {/* 💵 Loan Repayments by Member */}
      <div id="report-repayments" className="bg-white shadow rounded-lg p-6">
        <details className="group">
          <summary className="flex justify-between items-center cursor-pointer list-none">
            <h3 className="text-lg font-bold">💵 Loan Repayments by Member</h3>
            <span className="text-gray-500 group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>
             <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border text-left">Member</th>
                  <th className="p-2 border text-right">Total Repaid (₹)</th>
                </tr>
              </thead>
              <tbody>
                {repaymentsByMember.length ? (
                  repaymentsByMember.map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="p-2 border">{item.name}</td>
                      <td className="p-2 border text-blue-600 text-right font-semibold">
                        ₹ {formatINR((item.total || 0))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="2" className="p-2 text-center text-gray-500">
                      No data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      {/* 💳 Outstanding Loans */}
      <div id="report-loans" className="bg-white shadow rounded-lg p-6">
        <details className="group">
          <summary className="flex justify-between items-center cursor-pointer list-none">
            <h3 className="text-lg font-bold">
              💳 Outstanding Loans{""}
              {selectedMember !== "ALL" && `for ${selectedMember}`}
            </h3>
            <span className="text-gray-500 group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>

<div className="mt-4">
  {/* ✅ Add this toggle block ABOVE the filter buttons */}
  <div className="flex items-center gap-2 mb-4">
    <label className="font-semibold text-gray-700">Show Closed Loans:</label>
    <input
      type="checkbox"
      checked={showClosedLoans}
      onChange={(e) => setShowClosedLoans(e.target.checked)}
      className="w-4 h-4 cursor-pointer"
    />
  </div>

  {/* 🔵 Filter pills (All / Book / Bank) with counts + totals */}
  <div className="flex flex-wrap gap-2 mb-4">
    <button
      onClick={() => setLoanFilter("ALL")}
      className={`px-3 py-1.5 rounded-full border text-sm ${
        loanFilter === "ALL"
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white hover:bg-blue-50"
      }`}
    >
      All ({loanSummary.allCount}) · ₹
      {loanSummary.combined.toLocaleString()}
    </button>
              <button
                onClick={() => setLoanFilter("BOOK")}
                className={`px-3 py-1.5 rounded-full border text-sm ${
                  loanFilter === "BOOK"
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white hover:bg-green-50"
                }`}
              >
                Book ({loanSummary.bookCount}) · ₹ 
                 ₹ {formatINR(loanSummary.bookTotal)}
              </button>
              <button
                onClick={() => setLoanFilter("BANK")}
                className={`px-3 py-1.5 rounded-full border text-sm ${
                  loanFilter === "BANK"
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white hover:bg-purple-50"
                }`}
              >
                Bank ({loanSummary.bankCount}) · ₹ 
                 ₹ {formatINR(loanSummary.bankTotal)}
              </button>
            </div>

            {loansToShow.length === 0 ? (
              <p className="text-gray-500">No active loans found.</p>
            ) : (
              <>
                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">Member</th>
                      <th className="p-2 border">Loan Type</th>
                      <th className="p-2 border">Principal (₹)</th>
                      <th className="p-2 border">Outstanding (₹)</th>
                      <th className="p-2 border">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loansToShow.map((loan, i) => (
                      <tr
                        key={loan.id || i}
                        className={
                          loan.loanType === "Book Loan"
                            ? "bg-green-100"
                            : loan.loanType === "Bank Loan"
                            ? "bg-red-100"
                            : ""
                        }
                      >
                        <td className="p-2 border">
                          {loan.memberName ||
                            members.find((m) => m.id === loan.memberId)?.name ||
                            "Unknown"}
                        </td>
                        <td className="p-2 border">{loan.loanType}</td>
                        <td className="p-2 border">₹ {formatINR(loan.principalAmount)}</td>
                        <td className="p-2 border text-red-600 font-semibold">
                          ₹ {formatINR(loan.outstandingAmount)}
                        </td>
                        <td className="p-2 border">
  {Number(loan.outstandingAmount ?? 0) === 0
    ? "closed"
    : (loan.status || "active")}
</td>

                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* 📊 Loan summary cards */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg p-3 bg-green-100">
                    <p className="font-semibold text-green-800">
                      📘 Book Loans Outstanding
                    </p>
                    <p className="text-xl font-bold text-green-700">
                      ₹ {formatINR(loanSummary.bookTotal)}
                    </p>
                  </div>

                  <div className="rounded-lg p-3 bg-purple-100">
                    <p className="font-semibold text-purple-800">
                      🏦 Bank Loans Outstanding
                    </p>
                    <p className="text-xl font-bold text-purple-700">
                      ₹ {formatINR(loanSummary.bankTotal)}
                    </p>
                  </div>

                  <div className="rounded-lg p-3 bg-blue-100">
                    <p className="font-semibold text-blue-800">
                      💰 Total Outstanding Loans
                    </p>
                    <p className="text-xl font-bold text-blue-700">
                      ₹ {formatINR(loanSummary.combined)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
