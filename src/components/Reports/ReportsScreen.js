import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { generateMonthlyCollection } from "../../utils/monthlyCollectionGenerator";

const formatINR = (num) => {
  const n = Number(num) || 0;
  return n.toLocaleString("en-IN");
};

const formatDisplayDate = (value) => {
  if (!value) return "-";
  if (typeof value === "object") {
    if (typeof value.toDate === "function") {
      const d = value.toDate();
      return d.toLocaleDateString("en-GB");
    }
    if (value.seconds != null) {
      const ms = Number(value.seconds) * 1000 + Math.floor((Number(value.nanoseconds) || 0) / 1e6);
      const d = new Date(ms);
      return d.toLocaleDateString("en-GB");
    }
  }

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}/${month}/${year}`;
  }
  if (/^\d+$/.test(text)) {
    const d = new Date(Number(text));
    if (!isNaN(d)) return d.toLocaleDateString("en-GB");
  }

  return text;
};

const getSortableDate = (value) => {
  if (!value) return 0;
  if (typeof value === "object") {
    if (typeof value.toDate === "function") {
      return value.toDate().getTime();
    }
    if (value.seconds != null) {
      return value.seconds * 1000;
    }
  }
  return new Date(value).getTime();
};

const normalizeType = (value) => String(value || "").trim().toLowerCase();

const getExitAdjustmentForLoan = (tx, loanId) => {
  if (normalizeType(tx.type) !== "member exit adjustment" || !Array.isArray(tx.loanAdjustments)) {
    return null;
  }
  return tx.loanAdjustments.find((adjustment) => adjustment.loanId === loanId) || null;
};

const getLoanStatementPrincipal = (tx, loanId) => {
  const exitAdjustment = getExitAdjustmentForLoan(tx, loanId);
  if (exitAdjustment) {
    return Number(exitAdjustment.adjustedAmount || 0);
  }
  return Number(tx.principalRepaid || 0);
};

const getLoanStatementInterest = (tx) => Number(tx.interestRepaid || 0);

const getLoanStatus = (loan) => {
  const outstanding = Number(loan?.outstandingAmount || 0);
  if (outstanding <= 0) return "Closed";
  return String(loan?.status || "active").toLowerCase() === "closed" ? "Closed" : "Active";
};

const getLoanOptionLabel = (loan) => {
  const description = loan.description ? ` | ${loan.description}` : "";
  return `${loan.loanType || "Loan"} | ₹${formatINR(loan.principalAmount)} | ${formatDisplayDate(
    loan.date
  )}${description}`;
};

const sectionLabelMap = {
  savings: "Savings",
  repayments: "Loan Repayments",
  loans: "Outstanding Loans",
};

const statCardStyles = [
  { shell: "border-emerald-200 bg-emerald-50/90", eyebrow: "text-emerald-700", value: "text-emerald-900" },
  { shell: "border-sky-200 bg-sky-50/90", eyebrow: "text-sky-700", value: "text-sky-900" },
  { shell: "border-violet-200 bg-violet-50/90", eyebrow: "text-violet-700", value: "text-violet-900" },
  { shell: "border-amber-200 bg-amber-50/90", eyebrow: "text-amber-700", value: "text-amber-900" },
  { shell: "border-rose-200 bg-rose-50/90", eyebrow: "text-rose-700", value: "text-rose-900" },
  { shell: "border-orange-200 bg-orange-50/90", eyebrow: "text-orange-700", value: "text-orange-900" },
];

function SectionCard({ id, title, subtitle, defaultOpen = false, children, rightSlot }) {
  return (
    <section
      id={id}
      className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/95 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.35)] backdrop-blur"
    >
      <details className="group" open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {subtitle}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{title}</h3>
          </div>
          <div className="flex items-center gap-3">
            {rightSlot}
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition group-open:rotate-180">
              <span className="text-sm">▼</span>
            </div>
          </div>
        </summary>
        <div className="border-t border-slate-100 px-5 py-4">{children}</div>
      </details>
    </section>
  );
}

export default function ReportsScreen({
  members = [],
  transactions = [],
  loans = [],
  sbBalance = 0,
  odBalance = 0,
  handleGenerate = () => {},
  handleSaveMonthlySheet = () => {},
}) {
  const [selectedMember, setSelectedMember] = useState("ALL");
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [loanStatementPreviewReady, setLoanStatementPreviewReady] = useState(false);
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
    const saved = localStorage.getItem("showClosedLoans");
    return saved ? JSON.parse(saved) : false;
  });
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });

  const selectedMemberRecord = useMemo(
    () => members.find((member) => member.name === selectedMember) || null,
    [members, selectedMember]
  );

  const selectedMemberLoans = useMemo(() => {
    if (!selectedMemberRecord) return [];
    return loans
      .filter((loan) => {
        if (loan.memberId && selectedMemberRecord.id) {
          return loan.memberId === selectedMemberRecord.id;
        }
        return (loan.memberName || "").trim() === selectedMemberRecord.name;
      })
      .sort((a, b) => {
        const dateA = String(a.date || "");
        const dateB = String(b.date || "");
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return String(b.id || "").localeCompare(String(a.id || ""));
      });
  }, [loans, selectedMemberRecord]);

  const selectedLoanRecord = useMemo(
    () => selectedMemberLoans.find((loan) => loan.id === selectedLoanId) || null,
    [selectedLoanId, selectedMemberLoans]
  );

  const selectedLoanRepayments = useMemo(() => {
    if (!selectedLoanId) return [];
    return transactions
      .filter((tx) => {
        if (normalizeType(tx.type) === "loan repayment" && tx.loanId === selectedLoanId) {
          return true;
        }
        return Boolean(getExitAdjustmentForLoan(tx, selectedLoanId));
      })
      .sort((a, b) => getSortableDate(a.date) - getSortableDate(b.date));
  }, [selectedLoanId, transactions]);

  const selectedLoanStatementSummary = useMemo(
    () =>
      selectedLoanRepayments.reduce(
        (acc, tx) => {
          const principal = getLoanStatementPrincipal(tx, selectedLoanId);
          const interest = getLoanStatementInterest(tx);
          acc.principal += principal;
          acc.interest += interest;
          acc.total += principal + interest;
          return acc;
        },
        { principal: 0, interest: 0, total: 0 }
      ),
    [selectedLoanId, selectedLoanRepayments]
  );

  const updateMonthlyRow = (index, field, value) => {
    setMonthlyRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = {
          ...row,
          [field]: Number(value) || 0,
        };
        updated.total = updated.saving + updated.principal + updated.interest + updated.penalty;
        return updated;
      })
    );
  };

  useEffect(() => {
    if (selectedMember === "ALL") {
      setSelectedLoanId("");
      return;
    }
    if (selectedLoanId && selectedMemberLoans.some((loan) => loan.id === selectedLoanId)) {
      return;
    }
    setSelectedLoanId(selectedMemberLoans[0]?.id || "");
  }, [selectedLoanId, selectedMember, selectedMemberLoans]);

  useEffect(() => {
    setLoanStatementPreviewReady(false);
  }, [selectedMember, selectedLoanId]);

  // Clean Isolation & Print Optimization Engine
  const exportElementToPDF = async (element, titleText, orientation = "p") => {
    const isLandscape = orientation === "l";
    const pdf = new jsPDF(orientation, "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginTop = 22;

    const drawHeader = (pdfInstance) => {
      const today = new Date().toLocaleDateString("en-IN");
      pdfInstance.setFont("helvetica", "bold");
      pdfInstance.setFontSize(14);
      pdfInstance.text(titleText, pageWidth / 2, 12, { align: "center" });

      pdfInstance.setFont("helvetica", "normal");
      pdfInstance.setFontSize(10);
      pdfInstance.text(`Date: ${today}`, pageWidth - 20, 12, { align: "right" });
      pdfInstance.line(10, 18, pageWidth - 10, 18);
    };

    if (!isLandscape) {
      drawHeader(pdf);
    }

    await new Promise((res) => setTimeout(res, 300));
    const cloned = element.cloneNode(true);
    
    const actionControls = cloned.querySelector(".no-print");
    if (actionControls) actionControls.remove();

    // Flatten DOM native inputs into perfectly clean displays text strings
    cloned.querySelectorAll("input").forEach((input) => {
      if (input.type === "number") {
        const span = document.createElement("span");
        const numericVal = Number(input.value) || 0;
        span.textContent = numericVal > 0 ? numericVal.toLocaleString("en-IN") : "-";
        span.style.display = "block";
        span.style.width = "100%";
        span.style.textAlign = "right";
        span.style.paddingRight = "6px";
        span.style.fontSize = "13px";
        span.style.fontWeight = "600";
        span.style.color = "#334155";
        input.replaceWith(span);
      }
    });

    // Inject gorgeous landscape style layers straight into the rendering scope safely
    if (isLandscape) {
      const dynamicStyles = document.createElement("style");
      dynamicStyles.innerHTML = `
        .monthly-sheet { padding: 16mm 10mm 10mm 10mm !important; width: 297mm !important; background: #ffffff !important; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important; }
        .sheet-header { border-bottom: 3px solid #0284c7 !important; padding-bottom: 16px !important; margin-bottom: 24px !important; text-align: left !important; position: relative; }
        .sheet-header h2 { font-size: 32px !important; color: #0f172a !important; letter-spacing: 0.5px !important; margin: 0 !important; font-weight: 800 !important; }
        .sheet-header h3 { font-size: 14px !important; color: #0284c7 !important; font-weight: 700 !important; letter-spacing: 2px !important; margin: 6px 0 0 0 !important; text-transform: uppercase !important; }
        .sheet-header p { position: absolute; right: 0; bottom: 16px; font-size: 16px !important; font-weight: 700 !important; color: #0f172a !important; background: #e0f2fe !important; padding: 6px 16px !important; border-radius: 9999px !important; margin: 0 !important; }
        .monthly-sheet table { width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; margin-top: 15px !important; border: 1px solid #e2e8f0 !important; border-radius: 12px !important; overflow: hidden !important; }
        .monthly-sheet th { background: #0f172a !important; color: #ffffff !important; font-size: 12px !important; text-transform: uppercase !important; letter-spacing: 1px !important; padding: 14px 10px !important; font-weight: 700 !important; border: none !important; }
        .monthly-sheet td { padding: 12px 10px !important; font-size: 13px !important; border-bottom: 1px solid #f1f5f9 !important; border-right: none !important; border-left: none !important; color: #334155 !important; }
        .monthly-sheet tbody tr:nth-child(even) { background: #f8fafc !important; }
        .monthly-sheet tbody tr:last-child td { border-bottom: none !important; }
        .monthly-sheet td:last-child { color: #059669 !important; font-weight: 700 !important; font-size: 14px !important; }
        .monthly-sheet tfoot td { background: #f1f5f9 !important; font-weight: 800 !important; color: #0f172a !important; font-size: 14px !important; padding: 14px 10px !important; border-top: 2px solid #cbd5e1 !important; }
        .monthly-sheet tfoot tr td:last-child { color: #059669 !important; font-size: 16px !important; }
      `;
      cloned.appendChild(dynamicStyles);
    }

    document.body.appendChild(cloned);
    cloned.style.position = "absolute";
    cloned.style.left = "-9999px";
    
    if (isLandscape) {
      cloned.style.width = "297mm";
      cloned.style.padding = "0mm";
      cloned.style.margin = "0mm";
    } else {
      cloned.style.width = "820px";
      cloned.style.padding = "0";
      cloned.style.margin = "0";
    }
    cloned.style.boxShadow = "none";
    cloned.classList.add("pdf-export-mode");

    const canvas = await html2canvas(cloned, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: isLandscape ? cloned.offsetWidth : document.documentElement.scrollWidth,
    });
    document.body.removeChild(cloned);

    const imgData = canvas.toDataURL("image/jpeg", 1.0);
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let yPosition = isLandscape ? 0 : marginTop;

    if (!isLandscape && imgHeight > pageHeight - yPosition) {
      const totalParts = Math.ceil(imgHeight / (pageHeight - yPosition));
      const partHeight = canvas.height / totalParts;

      for (let p = 0; p < totalParts; p += 1) {
        const partCanvas = document.createElement("canvas");
        const ctx = partCanvas.getContext("2d");
        partCanvas.width = canvas.width;
        partCanvas.height = partHeight;

        ctx.drawImage(canvas, 0, p * partHeight, canvas.width, partHeight, 0, 0, canvas.width, partHeight);
        const partImgData = partCanvas.toDataURL("image/jpeg", 1.0);
        const partImgHeight = (partCanvas.height * imgWidth) / partCanvas.width;

        if (yPosition + partImgHeight > pageHeight - 14) {
          pdf.addPage();
          drawHeader(pdf);
          yPosition = marginTop;
        }

        pdf.addImage(partImgData, "JPEG", 0, yPosition, imgWidth, partImgHeight);
        yPosition += partImgHeight + 4;
      }
    } else {
      pdf.addImage(imgData, "JPEG", 0, yPosition, imgWidth, Math.min(imgHeight, pageHeight));
    }

    const totalPages = pdf.internal.getNumberOfPages();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    for (let i = 1; i <= totalPages; i += 1) {
      pdf.setPage(i);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
      pdf.text("Generated by Nagaraj Acharya | Kudradi SHG", pageWidth - 10, pageHeight - 8, { align: "right" });
    }

    const stringPDF = pdf.output("bloburl");
    window.open(stringPDF, "_blank");
  };

  const handleGeneratePDF = async () => {
    try {
      const validSections = [];
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

      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "20px";

      validSections.forEach((sec) => {
        const clone = sec.cloneNode(true);
        const details = clone.querySelector("details");
        if (details) details.setAttribute("open", "true");
        container.appendChild(clone);
      });

      await exportElementToPDF(container, "KUDRADI SHG REPORT", "p");
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate dashboard PDF.");
    }
  };

  const handleMonthlySheetPDF = async () => {
    const targetElement = document.querySelector(".monthly-sheet");
    if (!targetElement) {
      alert("Monthly Collection Sheet view not found.");
      return;
    }
    try {
      const printableMonth = new Date(selectedMonth + "-01").toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });
      await exportElementToPDF(
        targetElement,
        `KUDRADI SHG - ${printableMonth.toUpperCase()}`,
        "l"
      );
    } catch (err) {
      console.error("Monthly sheet PDF generation error:", err);
      alert("Failed to export Monthly Collection Sheet PDF layout view.");
    }
  };

  const handleGenerateLoanStatementPDF = () => {
    if (!selectedMemberRecord || !selectedLoanRecord) {
      alert("Please select a member and a loan first.");
      return;
    }

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const left = 14;
    const right = pageWidth - 14;
    const isClosedLoan = Number(selectedLoanRecord.outstandingAmount || 0) <= 0;
    const closedOnDate =
      isClosedLoan && selectedLoanRepayments.length > 0
        ? formatDisplayDate(selectedLoanRepayments[selectedLoanRepayments.length - 1].date)
        : "";
    const footerNote = closedOnDate
      ? `Loan closed on: ${closedOnDate}. Thank you for your timely repayment.`
      : "Thank you for your repayment record with Kudradi SHG.";
    let y = 16;

    const drawHeader = () => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text("KUDRADI SHG - LOAN REPAYMENT STATEMENT", pageWidth / 2, y, { align: "center" });
      y += 8;
      pdf.setDrawColor(15, 23, 42);
      pdf.line(left, y, right, y);
      y += 8;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const detailLines = [
        `Member: ${selectedMemberRecord.name}`,
        `Loan ID: ${selectedLoanRecord.id || "-"}`,
        `Loan Type: ${selectedLoanRecord.loanType || "-"}`,
        `Loan Amount: Rs. ${formatINR(selectedLoanRecord.principalAmount)}`,
        `Loan Date: ${formatDisplayDate(selectedLoanRecord.date)}`,
        `Status: ${getLoanStatus(selectedLoanRecord)}`,
        `Principal Repaid: Rs. ${formatINR(selectedLoanStatementSummary.principal)}`,
        `Interest Repaid: Rs. ${formatINR(selectedLoanStatementSummary.interest)}`,
        `Total Paid: Rs. ${formatINR(selectedLoanStatementSummary.total)}`,
        `Outstanding: Rs. ${formatINR(selectedLoanRecord.outstandingAmount)}`,
      ];

      detailLines.forEach((line, index) => {
        const x = index % 2 === 0 ? left : left + 92;
        const rowY = y + Math.floor(index / 2) * 7;
        pdf.text(line, x, rowY);
      });

      y += Math.ceil(detailLines.length / 2) * 7 + 4;
    };

    const drawTableHeader = () => {
      pdf.setFillColor(15, 23, 42);
      pdf.rect(left, y, right - left, 8, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("Date", left + 2, y + 5.5);
      pdf.text("Principal", left + 52, y + 5.5);
      pdf.text("Interest", left + 96, y + 5.5);
      pdf.text("Total", left + 138, y + 5.5);
      pdf.setTextColor(0, 0, 0);
      y += 8;
    };

    drawHeader();
    drawTableHeader();

    if (selectedLoanRepayments.length === 0) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text("No repayment transactions are linked to this loan.", left + 2, y + 6);
      y += 12;
    } else {
      selectedLoanRepayments.forEach((tx, index) => {
        if (y > pageHeight - 20) {
          pdf.addPage();
          y = 16;
          drawHeader();
          drawTableHeader();
        }

        const principal = getLoanStatementPrincipal(tx, selectedLoanId);
        const interest = getLoanStatementInterest(tx);
        const total = principal + interest;
        const fill = index % 2 === 0 ? 250 : 255;
        pdf.setFillColor(fill, fill, fill);
        pdf.rect(left, y, right - left, 8, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(formatDisplayDate(tx.date), left + 2, y + 5.5);
        pdf.text(`Rs. ${formatINR(principal)}`, left + 52, y + 5.5);
        pdf.text(`Rs. ${formatINR(interest)}`, left + 96, y + 5.5);
        pdf.text(`Rs. ${formatINR(total)}`, left + 138, y + 5.5);
        y += 8;
      });
// Draw Total Row (Professional Style)
if (y > pageHeight - 24) {
  pdf.addPage();
  y = 16;
  drawHeader();
  drawTableHeader();
}

// double separator line
pdf.setDrawColor(120);
pdf.setLineWidth(0.3);
pdf.line(left, y, right, y);
pdf.line(left, y + 1.2, right, y + 1.2);

y += 3;

pdf.setFont("helvetica", "bold");
pdf.setFontSize(9);
pdf.setTextColor(0, 0, 0);

pdf.text("TOTAL", left + 2, y + 4);

pdf.text(
  `Rs. ${formatINR(selectedLoanStatementSummary.principal)}`,
  left + 52,
  y + 4,
  { align: "left" }
);

pdf.text(
  `Rs. ${formatINR(selectedLoanStatementSummary.interest)}`,
  left + 96,
  y + 4,
  { align: "left" }
);

pdf.text(
  `Rs. ${formatINR(selectedLoanStatementSummary.total)}`,
  left + 138,
  y + 4,
  { align: "left" }
);

// bottom separator
pdf.line(left, y + 6, right, y + 6);

y += 10;    }

    const totalPages = pdf.internal.getNumberOfPages();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    for (let page = 1; page <= totalPages; page += 1) {
      pdf.setPage(page);
      pdf.text(footerNote, left, pageHeight - 14);
      pdf.text(`Page ${page} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    }

    const stringPDF = pdf.output("bloburl");
    window.open(stringPDF, "_blank");
  };

  const handleLoanStatementAction = () => {
    if (!selectedMemberRecord || !selectedLoanRecord) {
      alert("Please select a member and a loan first.");
      return;
    }
    if (!loanStatementPreviewReady) {
      setLoanStatementPreviewReady(true);
      return;
    }
    handleGenerateLoanStatementPDF();
  };

  useEffect(() => {
    let savings = 0;
    let generalSavings = 0;
    let loansDisbursed = 0;
    let loansRepaid = 0;
    let expenses = 0;
    let fines = 0;

    const savingsMap = {};
    const repaymentsMap = {};

    transactions.forEach((t) => {
      const member = t.memberName || members.find((m) => m.id === t.memberId)?.name || "Unknown";
      if (selectedMember !== "ALL" && member !== selectedMember) return;
      const tType = String(t.type || "").trim().toLowerCase();

      switch (tType) {
        case "saving":
          savings += Number(t.amount) || 0;
          savingsMap[member] = (savingsMap[member] || 0) + (Number(t.amount) || 0);
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
        case "loan repayment": {
          const repaid = (Number(t.principalRepaid) || 0) + (Number(t.interestRepaid) || 0);
          loansRepaid += repaid;
          repaymentsMap[member] = (repaymentsMap[member] || 0) + repaid;
          break;
        }
        case "expense":
          expenses += Number(t.amount) || 0;
          break;
        default:
          break;
      }
    });

    setTotals({ savings, generalSavings, loansDisbursed, loansRepaid, expenses, fines });

    setSavingsByMember(
      Object.entries(savingsMap)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
    );

    setRepaymentsByMember(
      Object.entries(repaymentsMap)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
    );

    const activeLoans = loans.filter((loan) => {
      const matchesMember =
        selectedMember === "ALL" ||
        (loan.memberName || members.find((m) => m.id === loan.memberId)?.name || "Unknown") === selectedMember;

      if (!matchesMember) return false;
      if (showClosedLoans) return true;

      const outstanding = Number(loan.outstandingAmount ?? 0);
      const status = String(loan.status || "").toLowerCase();
      return status !== "closed" && outstanding > 0;
    });

    setOutstandingLoans(activeLoans);
  }, [selectedMember, transactions, loans, members, showClosedLoans]);

  useEffect(() => {
    localStorage.setItem("showClosedLoans", JSON.stringify(showClosedLoans));
  }, [showClosedLoans]);

  const loanSummary = useMemo(() => {
    const isBook = (loan) => String(loan.loanType || "").toLowerCase().includes("book");
    const isBank = (loan) => String(loan.loanType || "").toLowerCase().includes("bank");
    const toNum = (value) => Number(value || 0);

    const bookList = outstandingLoans.filter(isBook);
    const bankList = outstandingLoans.filter(isBank);
    const bookTotal = bookList.reduce((sum, loan) => sum + toNum(loan.outstandingAmount), 0);
    const bankTotal = bankList.reduce((sum, loan) => sum + toNum(loan.outstandingAmount), 0);

    return {
      allCount: outstandingLoans.length,
      bookCount: bookList.length,
      bankCount: bankList.length,
      bookTotal,
      bankTotal,
      combined: bookTotal + bankTotal,
    };
  }, [outstandingLoans]);

  const loansToShow = useMemo(() => {
    if (loanFilter === "BOOK") {
      return outstandingLoans.filter((loan) => String(loan.loanType || "").toLowerCase().includes("book"));
    }
    if (loanFilter === "BANK") {
      return outstandingLoans.filter((loan) => String(loan.loanType || "").toLowerCase().includes("bank"));
    }
    return outstandingLoans;
  }, [loanFilter, outstandingLoans]);

  const monthlyCollection = useMemo(() => {
    return generateMonthlyCollection(members, loans);
  }, [members, loans]);

  useEffect(() => {
    setMonthlyRows(monthlyCollection);
  }, [monthlyCollection]);

  const accountSummary = [
    { label: "Savings", value: totals.savings, hint: "Member savings collected" },
    { label: "General Savings", value: totals.generalSavings, hint: "Other savings inflow" },
    { label: "Loans Disbursed", value: totals.loansDisbursed, hint: "Amount issued to members" },
    { label: "Loan Repayments", value: totals.loansRepaid, hint: "Principal + interest recovered" },
    { label: "Expenses", value: totals.expenses, hint: "Recorded outgoing costs" },
    { label: "Fines", value: totals.fines, hint: "Fine collections received" },
  ];

  const compactAccountCards = [
    { label: "SB Balance", value: sbBalance, tone: "bg-slate-900 text-white" },
    { label: "OD Balance", value: odBalance, tone: "bg-white text-slate-900 border border-slate-200" },
    { label: "Outstanding Loans", value: loanSummary.combined, tone: "bg-amber-50 text-amber-950 border border-amber-200" },
  ];

  return (
    <div className="report-root relative overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#f5f7fb_55%,_#eef2f7_100%)] p-3 sm:p-4 lg:p-5">
      <style>{`
        .pdf-export-mode { border-radius: 0 !important; background: #ffffff !important; box-shadow: none !important; }
        .pdf-export-mode .report-section { box-shadow: none !important; border-radius: 0 !important; }
        .pdf-export-mode table { font-size: 13px !important; }
        .pdf-export-mode th, .pdf-export-mode td { padding-top: 6px !important; padding-bottom: 6px !important; }

        .report-root .monthly-sheet-container { width: 100% !important; overflow-x: auto; }
        .report-root .monthly-sheet { max-width: 100% !important; width: 100% !important; margin: 0 auto !important; box-shadow: none !important; padding: 4px !important; }

        .report-root .overflow-hidden.rounded-2xl.border table { border-collapse: separate; border-spacing: 0; width: 100%; background: transparent; }
        .report-root thead th { background: #0f172a; color: #e6eef8; font-weight: 700; letter-spacing: 0.08em; }
        .report-root th, .report-root td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; }
        .report-root tbody tr:hover { background: rgba(15,23,42,0.03); }
        .report-root .overflow-hidden.rounded-2xl.border { box-shadow: 0 6px 20px rgba(15,23,42,0.06); }
      `}</style>

      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-sky-100 blur-3xl" />
        <div className="absolute right-10 top-12 h-52 w-52 rounded-full bg-emerald-100 blur-3xl" />
      </div>

      <div className="relative space-y-4">
        <section className="report-hero overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/90 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.4)] backdrop-blur">
          <div className="grid gap-4 px-5 py-5 lg:grid-cols-[1.5fr,0.95fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">Financial Reporting</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Reports Dashboard</h2>
              <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-600">
                Review savings, repayments, balances, and outstanding loans in one polished workspace. Filter by member, export snapshots, and manage records smoothly.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {compactAccountCards.map((card) => (
                <div key={card.label} className={`rounded-2xl px-4 py-3 shadow-sm ${card.tone}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">{card.label}</p>
                  <p className="mt-1.5 text-xl font-semibold">₹ {formatINR(card.value)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="report-filters rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,280px),minmax(260px,340px),auto,auto]">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Member Scope</label>
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                >
                  <option value="ALL">All Members</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.name}>{member.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Loan Statement</label>
                <select
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  disabled={selectedMember === "ALL" || selectedMemberLoans.length === 0}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {selectedMember === "ALL" ? (
                    <option value="">Select a member first</option>
                  ) : selectedMemberLoans.length === 0 ? (
                    <option value="">No loans found for this member</option>
                  ) : (
                    selectedMemberLoans.map((loan) => (
                      <option key={loan.id} value={loan.id}>{getLoanOptionLabel(loan)}</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Included Sections</p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(includeSections).map((key) => {
                    const active = includeSections[key];
                    return (
                      <label
                        key={key}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                          active ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-500"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={(e) => setIncludeSections((prev) => ({ ...prev, [key]: e.target.checked }))}
                          className="h-4 w-4 accent-sky-600"
                        />
                        {sectionLabelMap[key]}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <button
                  onClick={handleLoanStatementAction}
                  disabled={!selectedMemberRecord || !selectedLoanRecord}
                  className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {loanStatementPreviewReady ? "Preview Loan Statement PDF" : "Load Statement Preview"}
                </button>
                <button
                  onClick={handleGeneratePDF}
                  className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Preview PDF Dashboard
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="report-stats grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {accountSummary.map((item, index) => {
            const style = statCardStyles[index % statCardStyles.length];
            return (
              <article key={item.label} className={`report-stat-card rounded-[22px] border p-4 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] ${style.shell}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${style.eyebrow}`}>{item.label}</p>
                <p className={`mt-2 text-2xl font-semibold tracking-tight ${style.value}`}>₹ {formatINR(item.value)}</p>
                <p className="mt-1.5 text-xs text-slate-500 sm:text-sm">{item.hint}</p>
              </article>
            );
          })}
        </section>

        {loanStatementPreviewReady && selectedMemberRecord && selectedLoanRecord && (
          <section className="overflow-hidden rounded-[24px] border border-emerald-200/80 bg-white/95 shadow-[0_18px_48px_-34px_rgba(5,150,105,0.28)]">
            <div className="border-b border-emerald-100 bg-emerald-50/70 px-5 py-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Loan Statement Preview</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{selectedMemberRecord.name}</h3>
                </div>
                <p className="text-sm font-medium text-emerald-800">Clicking button again generates interactive tab preview.</p>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Loan ID</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedLoanRecord.id}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Loan Type</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedLoanRecord.loanType || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Loan Amount</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Rs. {formatINR(selectedLoanRecord.principalAmount)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Status</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{getLoanStatus(selectedLoanRecord)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Outstanding</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Rs. {formatINR(selectedLoanRecord.outstandingAmount)}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Principal Repaid</p>
                  <p className="mt-1 text-lg font-semibold text-sky-900">Rs. {formatINR(selectedLoanStatementSummary.principal)}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Interest Repaid</p>
                  <p className="mt-1 text-lg font-semibold text-amber-900">Rs. {formatINR(selectedLoanStatementSummary.interest)}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Total Paid</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-900">Rs. {formatINR(selectedLoanStatementSummary.total)}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-slate-900 text-left text-xs uppercase tracking-[0.2em] text-slate-200">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Principal</th>
                        <th className="px-4 py-3 text-right">Interest</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLoanRepayments.length > 0 ? (
                        selectedLoanRepayments.map((tx, index) => {
                          const principal = getLoanStatementPrincipal(tx, selectedLoanId);
                          const interest = getLoanStatementInterest(tx);
                          const total = principal + interest;
                          return (
                            <tr key={tx.id || `${tx.date}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="border-t border-slate-100 px-4 py-3 font-medium text-slate-700">{formatDisplayDate(tx.date)}</td>
                              <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-sky-700">Rs. {formatINR(principal)}</td>
                              <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-amber-700">Rs. {formatINR(interest)}</td>
                              <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-emerald-700">Rs. {formatINR(total)}</td>
                            </tr>
                          );
                        })
                        
                      ) : (
                        
                        <tr>
                          <td colSpan={4} className="border-t border-slate-100 px-4 py-8 text-center text-slate-500">No repayment transactions are linked to this loan.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        <SectionCard
          id="report-savings"
          title="Savings By Member"
          subtitle="Collection Summary"
          defaultOpen={false}
          rightSlot={
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {savingsByMember.length} Members
            </span>
          }
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-900 text-left text-xs uppercase tracking-[0.2em] text-slate-200">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3 text-right">Total Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {savingsByMember.length > 0 ? (
                    savingsByMember.map((item, index) => (
                      <tr key={item.name} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="border-t border-slate-100 px-4 py-3 font-medium text-slate-700">{item.name}</td>
                        <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-emerald-700">₹ {formatINR(item.total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="border-t border-slate-100 px-4 py-8 text-center text-slate-500">No savings data available for the selected view.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="report-repayments"
          title="Loan Repayments By Member"
          subtitle="Recovery Summary"
          rightSlot={
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              ₹ {formatINR(totals.loansRepaid)}
            </span>
          }
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-900 text-left text-xs uppercase tracking-[0.2em] text-slate-200">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3 text-right">Total Repaid</th>
                  </tr>
                </thead>
                <tbody>
                  {repaymentsByMember.length > 0 ? (
                    repaymentsByMember.map((item, index) => (
                      <tr key={item.name} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="border-t border-slate-100 px-4 py-3 font-medium text-slate-700">{item.name}</td>
                        <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-sky-700">₹ {formatINR(item.total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="border-t border-slate-100 px-4 py-8 text-center text-slate-500">No repayment data available for the selected view.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="report-loans"
          title={`Outstanding Loans${selectedMember !== "ALL" ? ` For ${selectedMember}` : ""}`}
          subtitle="Live Portfolio"
          rightSlot={
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                <input
                  type="checkbox"
                  checked={showClosedLoans}
                  onChange={(e) => setShowClosedLoans(e.target.checked)}
                  className="h-4 w-4 accent-slate-900"
                />
                Show Closed
              </label>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setLoanFilter("ALL")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${loanFilter === "ALL" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                All {loanSummary.allCount} | ₹ {formatINR(loanSummary.combined)}
              </button>
              <button
                onClick={() => setLoanFilter("BOOK")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${loanFilter === "BOOK" ? "bg-emerald-700 text-white" : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
              >
                Book {loanSummary.bookCount} | ₹ {formatINR(loanSummary.bookTotal)}
              </button>
              <button
                onClick={() => setLoanFilter("BANK")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${loanFilter === "BANK" ? "bg-rose-700 text-white" : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"}`}
              >
                Bank {loanSummary.bankCount} | ₹ {formatINR(loanSummary.bankTotal)}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Book Loans</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-900">₹ {formatINR(loanSummary.bookTotal)}</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">Bank Loans</p>
                <p className="mt-2 text-2xl font-semibold text-rose-900">₹ {formatINR(loanSummary.bankTotal)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Total Outstanding</p>
                <p className="mt-2 text-2xl font-semibold">₹ {formatINR(loanSummary.combined)}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-slate-900 text-left text-xs uppercase tracking-[0.2em] text-slate-200">
                    <tr>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Loan Type</th>
                      <th className="px-4 py-3 text-right">Loan Amount</th>
                      <th className="px-4 py-3 text-right">Outstanding</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loansToShow.length > 0 ? (
                      loansToShow.map((loan, index) => {
                        const statusText = Number(loan.outstandingAmount ?? 0) === 0 ? "closed" : loan.status || "active";
                        return (
                          <tr key={loan.id || index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <td className="border-t border-slate-100 px-4 py-3 font-medium text-slate-700">
                              {loan.memberName || members.find((m) => m.id === loan.memberId)?.name || "Unknown"}
                            </td>
                            <td className="border-t border-slate-100 px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                                  String(loan.loanType || "").toLowerCase().includes("book") ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {loan.loanType}
                              </span>
                            </td>
                            <td className="border-t border-slate-100 px-4 py-3 text-right font-medium text-slate-700">₹ {formatINR(loan.principalAmount)}</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-rose-700">₹ {formatINR(loan.outstandingAmount)}</td>
                            <td className="border-t border-slate-100 px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                                  statusText === "closed" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {statusText}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="border-t border-slate-100 px-4 py-8 text-center text-slate-500">No loans found for the current filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="report-monthly"
          title="📋 Monthly Collection Sheet"
          subtitle="WhatsApp Reminder"
          defaultOpen={true}
        >
          <div className="monthly-sheet-container">
            <div className="monthly-sheet">
              <div className="no-print mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="font-semibold text-slate-700 text-sm">Target Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleGenerate(selectedMonth)}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Generate
                  </button>
                  <button
                    onClick={() => handleSaveMonthlySheet(selectedMonth, monthlyRows)}
                    className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleMonthlySheetPDF}
                    className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
                  >
                    Preview PDF Statement
                  </button>
                </div>
              </div>

              <div className="sheet-header">
                <h2>KUDRADI SHG</h2>
                <h3>MONTHLY COLLECTION SHEET</h3>
                <p>
                  {new Date(selectedMonth + "-01").toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="overflow-x-auto w-full">
                <table>
                  <thead>
                    <tr>
                      <th>Sl</th>
                      <th>Member Name</th>
                      <th>Saving</th>
                      <th>Principal</th>
                      <th>Interest</th>
                      <th>Penalty</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.map((row, index) => (
                      <tr key={row.slNo || index}>
                        <td>{row.slNo}</td>
                        <td>{row.memberName}</td>
                        <td>
                          <input
                            type="number"
                            value={row.saving || ""}
                            onChange={(e) => updateMonthlyRow(index, "saving", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={row.principal || ""}
                            onChange={(e) => updateMonthlyRow(index, "principal", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={row.interest || ""}
                            onChange={(e) => updateMonthlyRow(index, "interest", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={row.penalty || ""}
                            onChange={(e) => updateMonthlyRow(index, "penalty", e.target.value)}
                          />
                        </td>
                        <td>₹ {formatINR(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>TOTAL</td>
                      <td>₹ {formatINR(monthlyRows.reduce((a, b) => a + b.saving, 0))}</td>
                      <td>₹ {formatINR(monthlyRows.reduce((a, b) => a + b.principal, 0))}</td>
                      <td>₹ {formatINR(monthlyRows.reduce((a, b) => a + b.interest, 0))}</td>
                      <td>₹ {formatINR(monthlyRows.reduce((a, b) => a + b.penalty, 0))}</td>
                      <td>₹ {formatINR(monthlyRows.reduce((a, b) => a + b.total, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}