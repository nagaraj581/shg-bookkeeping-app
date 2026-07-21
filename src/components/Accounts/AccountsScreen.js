import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";

const formatINR = (num) => {
  const n = Number(num) || 0;
  return n.toLocaleString("en-IN");
};

const normalizeType = (value) => String(value || "").trim().toLowerCase();

const getTransactionDateValue = (tx) => tx.date || tx._date || tx.createdAt || "";

const getMonthKey = (value) => {
  if (!value) return "Unknown";
  if (value && typeof value.toDate === "function") {
    const date = value.toDate();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof value === "object" && Number.isFinite(value.seconds)) {
    const date = new Date(value.seconds * 1000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text.slice(0, 7);
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
};

const toDateObject = (value) => {
  if (!value) return null;
  if (value && typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "object" && Number.isFinite(value.seconds)) {
    return new Date(value.seconds * 1000);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDateSortValue = (value) => {
  const date = toDateObject(value);
  return date ? date.getTime() : 0;
};

const formatDateLabel = (value) => {
  const date = toDateObject(value);
  if (!date) return "";
  return date.toLocaleDateString("en-IN");
};

const formatMonthLabel = (monthKey) => {
  if (!monthKey || monthKey === "Unknown") return "Unknown Month";
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

const getTodayInputValue = () => new Date().toISOString().split("T")[0];

const getAccountDepositForTransaction = (tx) => {
  const type = normalizeType(tx.type);
  const amount = Number(tx.amount || 0);

  if (type === "bank loan repayment") {
    return {
      account: "OD",
      amount:
        (Number(tx.principalRepaid || 0) || 0) + (Number(tx.interestRepaid || 0) || 0) || amount,
    };
  }

  if (type === "loan repayment") {
    const repaid =
      (Number(tx.principalRepaid || 0) || 0) + (Number(tx.interestRepaid || 0) || 0) || amount;
    const isBankRepayment = String(tx.loanType || "").toLowerCase().includes("bank");
    return { account: isBankRepayment ? "OD" : "SB", amount: repaid };
  }

  if (["saving", "general saving", "fine"].includes(type)) {
    return { account: "SB", amount };
  }

  return null;
};

const AccountsScreen = ({ transactions = [], sbBalance = 0, odBalance = 0, addTransaction }) => {
  const [selectedMonth, setSelectedMonth] = useState("ALL");
  const [pdfPreview, setPdfPreview] = useState(null);
  const [transferForm, setTransferForm] = useState({
    fromAccount: "OD",
    toAccount: "SB",
    amount: "",
    date: getTodayInputValue(),
    description: "",
  });
  const [isTransferring, setIsTransferring] = useState(false);

  const monthlyRows = useMemo(() => {
    const monthMap = {};

    transactions.forEach((tx) => {
      const deposit = getAccountDepositForTransaction(tx);
      if (!deposit || deposit.amount <= 0) return;

      const monthKey = getMonthKey(getTransactionDateValue(tx));
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          monthKey,
          monthLabel: formatMonthLabel(monthKey),
          sb: 0,
          od: 0,
          total: 0,
        };
      }

      if (deposit.account === "OD") {
        monthMap[monthKey].od += deposit.amount;
      } else {
        monthMap[monthKey].sb += deposit.amount;
      }
      monthMap[monthKey].total += deposit.amount;
    });

    return Object.values(monthMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [transactions]);

  const filteredRows = useMemo(() => {
    if (selectedMonth === "ALL") return monthlyRows;
    return monthlyRows.filter((row) => row.monthKey === selectedMonth);
  }, [monthlyRows, selectedMonth]);

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          acc.sb += row.sb;
          acc.od += row.od;
          acc.total += row.total;
          return acc;
        },
        { sb: 0, od: 0, total: 0 }
      ),
    [filteredRows]
  );

  const transferRows = useMemo(
    () =>
      transactions
        .filter((tx) => normalizeType(tx.type) === "account transfer")
        .map((tx) => ({
          id: tx.id || `${tx.date}-${tx.amount}-${tx.fromAccount}-${tx.toAccount}`,
          date: getTransactionDateValue(tx),
          fromAccount: String(tx.fromAccount || "").toUpperCase(),
          toAccount: String(tx.toAccount || "").toUpperCase(),
          amount: Number(tx.amount || 0),
          description: tx.description || "",
        }))
        .sort((a, b) => getDateSortValue(b.date) - getDateSortValue(a.date)),
    [transactions]
  );

  const getSourceBalance = (account) => (account === "OD" ? odBalance : sbBalance);

  const handleTransferChange = (field, value) => {
    setTransferForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "fromAccount") {
        next.toAccount = value === "OD" ? "SB" : "OD";
      }

      if (field === "toAccount") {
        next.fromAccount = value === "OD" ? "SB" : "OD";
      }

      return next;
    });
  };

  const handleTransferSubmit = async (event) => {
    event.preventDefault();

    if (!addTransaction) {
      alert("Transfer is not available yet. Please refresh and try again.");
      return;
    }

    const amount = Number(transferForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a transfer amount greater than 0.");
      return;
    }

    if (transferForm.fromAccount === transferForm.toAccount) {
      alert("Please select two different accounts.");
      return;
    }

    const sourceBalance = getSourceBalance(transferForm.fromAccount);
    if (amount > sourceBalance) {
      alert(
        `Cannot transfer more than the current ${transferForm.fromAccount} balance of Rs. ${formatINR(sourceBalance)}.`
      );
      return;
    }

    const description =
      transferForm.description.trim() ||
      `Transfer from ${transferForm.fromAccount} to ${transferForm.toAccount}`;

    setIsTransferring(true);
    const saved = await addTransaction({
      type: "Account Transfer",
      amount,
      fromAccount: transferForm.fromAccount,
      toAccount: transferForm.toAccount,
      date: transferForm.date || getTodayInputValue(),
      description,
      category: "Account Transfer",
    });
    setIsTransferring(false);

    if (saved) {
      setTransferForm((current) => ({
        ...current,
        amount: "",
        date: getTodayInputValue(),
        description: "",
      }));
      setPdfPreview(null);
    }
  };

  const buildPreviewRows = (account) => {
    if (account === "BOTH") {
      return filteredRows
        .filter((row) => row.sb > 0 || row.od > 0)
        .map((row) => ({
          monthLabel: row.monthLabel,
          sb: row.sb,
          od: row.od,
          total: row.total,
        }));
    }

    const rows = filteredRows
      .map((row) => ({
        monthLabel: row.monthLabel,
        amount: account === "OD" ? row.od : row.sb,
      }))
      .filter((row) => row.amount > 0);

    return rows;
  };

  const previewAccountPDF = (account) => {
    const accountName =
      account === "BOTH" ? "SB + OD Accounts" : account === "OD" ? "OD Account" : "SB Account";
    const rows = buildPreviewRows(account);

    if (rows.length === 0) {
      alert(`No ${accountName} monthly deposits found for the selected month.`);
      return;
    }

    const reportTotal = rows.reduce(
      (sum, row) => sum + (account === "BOTH" ? row.total : row.amount),
      0
    );
    const monthLabel = selectedMonth === "ALL" ? "All Months" : formatMonthLabel(selectedMonth);

    setPdfPreview({
      account,
      accountName,
      monthLabel,
      rows,
      total: reportTotal,
    });
  };

  const downloadPreviewPDF = () => {
    if (!pdfPreview) return;

    const { account, accountName, monthLabel, rows, total } = pdfPreview;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const left = 14;
    const right = pageWidth - 14;
    let y = 16;

    const drawHeader = () => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text(`KUDRADI SHG - ${accountName.toUpperCase()} MONTHLY DEPOSITS`, pageWidth / 2, y, {
        align: "center",
      });
      y += 8;
      pdf.setDrawColor(15, 23, 42);
      pdf.line(left, y, right, y);
      y += 8;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(`Month Filter: ${monthLabel}`, left, y);
      pdf.text(`Total Deposited: Rs. ${formatINR(total)}`, left + 92, y);
      y += 8;
    };

    const drawTableHeader = () => {
      pdf.setFillColor(15, 23, 42);
      pdf.rect(left, y, right - left, 8, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      if (account === "BOTH") {
        pdf.text("Month", left + 2, y + 5.5);
        pdf.text("SB Deposited", left + 54, y + 5.5);
        pdf.text("OD Deposited", left + 100, y + 5.5);
        pdf.text("Total", right - 28, y + 5.5);
      } else {
        pdf.text("Account", left + 2, y + 5.5);
        pdf.text("Month", left + 48, y + 5.5);
        pdf.text("Deposited", right - 42, y + 5.5);
      }
      pdf.setTextColor(0, 0, 0);
      y += 8;
    };

    drawHeader();
    drawTableHeader();

    rows.forEach((row, index) => {
      if (y > pageHeight - 22) {
        pdf.addPage();
        y = 16;
        drawHeader();
        drawTableHeader();
      }

      const fill = index % 2 === 0 ? 250 : 255;
      pdf.setFillColor(fill, fill, fill);
      pdf.rect(left, y, right - left, 8, "F");
      pdf.setFont("helvetica", "normal");
      if (account === "BOTH") {
        pdf.text(row.monthLabel, left + 2, y + 5.5);
        pdf.text(`Rs. ${formatINR(row.sb)}`, left + 54, y + 5.5);
        pdf.text(`Rs. ${formatINR(row.od)}`, left + 100, y + 5.5);
        pdf.text(`Rs. ${formatINR(row.total)}`, right - 28, y + 5.5);
      } else {
        pdf.text(account, left + 2, y + 5.5);
        pdf.text(row.monthLabel, left + 48, y + 5.5);
        pdf.text(`Rs. ${formatINR(row.amount)}`, right - 42, y + 5.5);
      }
      y += 8;
    });

    const totalPages = pdf.internal.getNumberOfPages();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    for (let page = 1; page <= totalPages; page += 1) {
      pdf.setPage(page);
      pdf.text(`Page ${page} of ${totalPages}`, pageWidth / 2, pageHeight - 8, {
        align: "center",
      });
      pdf.text("Generated by Nagaraj Acharya | Kudradi SHG", right, pageHeight - 8, {
        align: "right",
      });
    }

    const date = new Date().toISOString().split("T")[0];
    const safeMonth = selectedMonth === "ALL" ? "All_Months" : selectedMonth;
    pdf.save(`${account}_Monthly_Deposits_${safeMonth}_${date}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 pb-24 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Account Deposits
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                Monthly SB / OD Summary
              </h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setPdfPreview(null);
                  }}
                  className="w-full min-w-[180px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                >
                  <option value="ALL">All Months</option>
                  {monthlyRows.map((row) => (
                    <option key={row.monthKey} value={row.monthKey}>
                      {row.monthLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => previewAccountPDF("SB")}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Preview SB PDF
                </button>
                <button
                  onClick={() => previewAccountPDF("OD")}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  Preview OD PDF
                </button>
                <button
                  onClick={() => previewAccountPDF("BOTH")}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Preview SB + OD PDF
                </button>
              </div>
            </div>
          </div>
        </section>

        {pdfPreview && (
          <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  PDF Preview
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">
                  {pdfPreview.accountName} - {pdfPreview.monthLabel}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPdfPreview(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close Preview
                </button>
                <button
                  onClick={downloadPreviewPDF}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Download PDF
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Total Deposited
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-950">
                  Rs. {formatINR(pdfPreview.total)}
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-900 text-left text-xs uppercase tracking-[0.18em] text-slate-200">
                      {pdfPreview.account === "BOTH" ? (
                        <tr>
                          <th className="px-4 py-3">Month</th>
                          <th className="px-4 py-3 text-right">SB Deposited</th>
                          <th className="px-4 py-3 text-right">OD Deposited</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="px-4 py-3">Account</th>
                          <th className="px-4 py-3">Month</th>
                          <th className="px-4 py-3 text-right">Deposited</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {pdfPreview.rows.map((row, index) =>
                        pdfPreview.account === "BOTH" ? (
                          <tr
                            key={row.monthLabel}
                            className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                          >
                            <td className="border-t border-slate-100 px-4 py-3 font-medium text-slate-700">
                              {row.monthLabel}
                            </td>
                            <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-blue-700">
                              Rs. {formatINR(row.sb)}
                            </td>
                            <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-violet-700">
                              Rs. {formatINR(row.od)}
                            </td>
                            <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-slate-900">
                              Rs. {formatINR(row.total)}
                            </td>
                          </tr>
                        ) : (
                          <tr
                            key={row.monthLabel}
                            className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                          >
                            <td className="border-t border-slate-100 px-4 py-3 font-medium text-slate-700">
                              {pdfPreview.account}
                            </td>
                            <td className="border-t border-slate-100 px-4 py-3 text-slate-700">
                              {row.monthLabel}
                            </td>
                            <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-slate-900">
                              Rs. {formatINR(row.amount)}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
              SB Deposited
            </p>
            <p className="mt-2 text-2xl font-semibold text-blue-950">Rs. {formatINR(totals.sb)}</p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">
              OD Deposited
            </p>
            <p className="mt-2 text-2xl font-semibold text-violet-950">
              Rs. {formatINR(totals.od)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              Total Deposited
            </p>
            <p className="mt-2 text-2xl font-semibold">Rs. {formatINR(totals.total)}</p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Current SB Balance
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-950">Rs. {formatINR(sbBalance)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Current OD Balance
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-950">Rs. {formatINR(odBalance)}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Account Transfer
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">
              Move amount between SB and OD
            </h3>
          </div>

          <form onSubmit={handleTransferSubmit} className="grid gap-3 lg:grid-cols-6 lg:items-end">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                From
              </label>
              <select
                value={transferForm.fromAccount}
                onChange={(e) => handleTransferChange("fromAccount", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
              >
                <option value="OD">OD Account</option>
                <option value="SB">SB Account</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                To
              </label>
              <select
                value={transferForm.toAccount}
                onChange={(e) => handleTransferChange("toAccount", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
              >
                <option value="SB">SB Account</option>
                <option value="OD">OD Account</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Amount
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={transferForm.amount}
                onChange={(e) => handleTransferChange("amount", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Date
              </label>
              <input
                type="date"
                value={transferForm.date}
                onChange={(e) => handleTransferChange("date", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Note
              </label>
              <input
                type="text"
                value={transferForm.description}
                onChange={(e) => handleTransferChange("description", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                placeholder={`${transferForm.fromAccount} to ${transferForm.toAccount}`}
              />
            </div>

            <button
              type="submit"
              disabled={isTransferring}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {isTransferring ? "Saving..." : "Transfer Amount"}
            </button>
          </form>
        </section>

        {transferRows.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Transfer History
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">Recent account transfers</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900 text-left text-xs uppercase tracking-[0.18em] text-slate-200">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">From</th>
                    <th className="px-4 py-3">To</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {transferRows.slice(0, 10).map((row, index) => (
                    <tr key={row.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="border-t border-slate-100 px-4 py-3 text-slate-700">
                        {formatDateLabel(row.date)}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3 font-semibold text-violet-700">
                        {row.fromAccount}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3 font-semibold text-blue-700">
                        {row.toAccount}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-slate-900">
                        Rs. {formatINR(row.amount)}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3 text-slate-600">
                        {row.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase tracking-[0.18em] text-slate-200">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3 text-right">SB Deposited</th>
                  <th className="px-4 py-3 text-right">OD Deposited</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row, index) => (
                    <tr key={row.monthKey} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="border-t border-slate-100 px-4 py-3 font-medium text-slate-700">
                        {row.monthLabel}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-blue-700">
                        Rs. {formatINR(row.sb)}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-violet-700">
                        Rs. {formatINR(row.od)}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold text-slate-900">
                        Rs. {formatINR(row.total)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="border-t border-slate-100 px-4 py-8 text-center text-slate-500">
                      No SB or OD deposits found for the selected month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AccountsScreen;
