// src/components/Bookkeeping/BookkeepingScreen.js
import React, { useMemo, useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { query } from "firebase/firestore";
import { writeBatch } from "firebase/firestore"; // ⬅️ add at top with other imports


import {
  addDoc,
  collection,
  getDocs,
  where,
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import TransactionTable from "./TransactionTable";

/**
 * Props expected:
 * - members, transactions, loans
 * - selectedMemberId, setSelectedMemberId, savingAmount, setSavingAmount, savingDate, setSavingDate, savingType, setSavingType, recordSaving
 * - selectedLoanId, setSelectedLoanId, principalRepaymentAmount, setPrincipalRepaymentAmount, interestRepaymentAmount, setInterestRepaymentAmount, repaymentDate, setRepaymentDate, recordLoanRepayment
 * - expenseAmount, setExpenseAmount, expenseDate, setExpenseDate, expenseDescription, setExpenseDescription, expenseCategory, setExpenseCategory, recordExpense
 * - openEditTransaction(tx), handleDeleteTransaction(tx)
 * - db, shgId, userId, setAlertMessage, setShowAlert, getMemberName
 */

const APP_ID = "shg-bookkeeping-app";

const bankIcon = "🏦";
const bookIcon = "📘";

const BookkeepingScreen = (props) => {
  const {
    members = [],
    loans = [],

    // saving
    selectedMemberId,
    setSelectedMemberId,
    savingAmount,
    setSavingAmount,
    savingDate,
    setSavingDate,
    savingType,
    setSavingType,
    // repayment
    selectedLoanId,
    setSelectedLoanId,
    principalRepaymentAmount,
    setPrincipalRepaymentAmount,
    interestRepaymentAmount,
    setInterestRepaymentAmount,
    repaymentDate,
    setRepaymentDate,
    recordLoanRepayment,
    
    // expense
    expenseAmount,
    setExpenseAmount,
    expenseDate,
    setExpenseDate,
    expenseDescription,
    setExpenseDescription,
    expenseCategory,
    setExpenseCategory,
    recordExpense,
    // table hooks

    // helpers / firebase
    db,
    shgId,
    userId,
    setAlertMessage,
    setShowAlert,
    fetchTransactions,
    getMemberName,
  } = props;

  // debug log for loans
  useEffect(() => {
    console.log("BOOKKEEPING: loans:", loans);
  }, [loans]);

  // Local loan form state
  const [loanMemberId, setLoanMemberId] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanInterestRate, setLoanInterestRate] = useState("");
  const [loanTermMonths, setLoanTermMonths] = useState("");
  const [loanType, setLoanType] = useState("");
  const [loanDate, setLoanDate] = useState("");
  const [loanDescription, setLoanDescription] = useState("");

  // ⬇️ import preview/upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);

  const [generalSavingAmount, setGeneralSavingAmount] = useState("");
  const [generalSavingSource, setGeneralSavingSource] = useState("");
  const [generalSavingDate, setGeneralSavingDate] = useState("");
  const [generalSavingDescription, setGeneralSavingDescription] = useState("");

  // ⬇️ used to force the <input type="file" /> to fully reset (lets same filename re-trigger onChange)
  const [fileInputKey, setFileInputKey] = useState(0);
  // Month selector state (defaults to current month)
const now = new Date();
const [filterYear, setFilterYear] = useState(now.getFullYear());
const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1); // 1-12

// Call parent if available (preferred), else fallback to fetchTransactions()
useEffect(() => {
  const load = async () => {
    if (typeof props.fetchTransactionsByMonth === "function") {
      await props.fetchTransactionsByMonth(filterYear, filterMonth);
    } else if (typeof fetchTransactions === "function") {
      // optional: change your existing fetch to accept a month/year later
      await fetchTransactions();
    }
  };
  load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [filterYear, filterMonth]);


  // default appId used in your Firestore layout (matches console screenshots)
  const APP_ID = "shg-bookkeeping-app";

  // derive active loans for select (safe)
  const activeLoans = (loans || []).filter(
    (l) => l && l.status === "active" && Number(l.outstandingAmount) > 0
  );

  // members memo
  const membersOptions = useMemo(
    () => members.map((m) => ({ id: m.id, name: m.name })),
    [members]
  );

  const recordGeneralSaving = async () => {
    if (!db || !userId || !shgId) {
      setAlertMessage("App not ready: DB/user/SHG not initialized.");
      setShowAlert(true);
      return;
    }

    if (!generalSavingAmount || Number(generalSavingAmount) <= 0) {
      setAlertMessage("Enter a valid saving amount.");
      setShowAlert(true);
      return;
    }

    try {
      const txColRef = collection(
        db,
        "artifacts",
        APP_ID,
        "users",
        userId,
        "shg_groups",
        shgId,
        "transactions"
      );

      const isoDate = generalSavingDate || new Date().toISOString().split("T")[0];

      const txData = {
        type: "General Saving",
        memberId: null,
        source: generalSavingSource || "Other",
        amount: Number(generalSavingAmount),
        date: isoDate,
        description: generalSavingDescription || "",
        createdAt: serverTimestamp(),
        recordedBy: userId,
      };

      await addDoc(txColRef, txData);

      setAlertMessage("General saving recorded successfully!");
      setShowAlert(true);

      // clear form fields
      setGeneralSavingAmount("");
      setGeneralSavingDate("");
      setGeneralSavingDescription("");
      setGeneralSavingSource("");
    } catch (err) {
      console.error("recordGeneralSaving error:", err);
      setAlertMessage(`Error: ${err.message || err}`);
      setShowAlert(true);
    }
  };

  // record loan disbursement
  const recordLoanDisbursement = async () => {
    if (!db || !userId || !shgId) {
      setAlertMessage("App not ready: DB/user/SHG not initialized.");
      setShowAlert(true);
      return;
    }
    if (!loanMemberId || !loanAmount || Number(loanAmount) <= 0) {
      setAlertMessage("Select member and enter a valid loan amount.");
      setShowAlert(true);
      return;
    }

    try {
      // collections
      const loansColRef = collection(
        db, "artifacts", APP_ID, "users", userId, "shg_groups", shgId, "loans"
      );
      const txColRef = collection(
        db, "artifacts", APP_ID, "users", userId, "shg_groups", shgId, "transactions"
      );

      // create loan doc with auto Firestore id
      const newLoanRef = doc(loansColRef);
      const isoDate = (loanDate && loanDate.slice) ? loanDate : new Date().toISOString().split("T")[0];

      const loanData = {
        id: newLoanRef.id,
        memberId: loanMemberId,
        loanType: loanType || "Book Loan",
        principalAmount: Number(loanAmount),
        outstandingAmount: Number(loanAmount),
        totalRepaid: 0,
        interestRate: loanInterestRate ? Number(loanInterestRate) : null,
        termMonths: loanTermMonths ? parseInt(loanTermMonths, 10) : null,
        date: isoDate,
        description: loanDescription || "",
        status: "active",
        createdAt: serverTimestamp(),
        recordedBy: userId,
      };
      await setDoc(newLoanRef, loanData);

      // matching transaction (keeps only Firestore loanId)
      await addDoc(txColRef, {
        type: "Loan Disbursed",
        loanId: newLoanRef.id,
        memberId: loanMemberId,
        amount: Number(loanAmount),
        loanType: loanType || "Book Loan",
        date: isoDate,
        description: loanDescription || "",
        createdAt: serverTimestamp(),
        recordedBy: userId,
      });

      setAlertMessage("Loan disbursed successfully.");
      setShowAlert(true);

      // clear fields
      setLoanMemberId("");
      setLoanAmount("");
      setLoanInterestRate("");
      setLoanTermMonths("");
      setLoanDate("");
      setLoanDescription("");
      setLoanType("");
    } catch (err) {
      console.error("recordLoanDisbursement error:", err);
      setAlertMessage(`Error recording loan: ${err.message || err}`);
      setShowAlert(true);
    }
  };


// ✳️ Super-fast, safe XLSX import with batching & 1-time loan prefetch
const importXLSXRows = async () => {
  if (!uploadedFile) {
    alert("Please choose a file first.");
    return;
  }

  try {
    const txColRef = collection(
      db, "artifacts", APP_ID, "users", userId, "shg_groups", shgId, "transactions"
    );
    const loansColRef = collection(
      db, "artifacts", APP_ID, "users", userId, "shg_groups", shgId, "loans"
    );

    // 1) Prefetch all ACTIVE loans once → build a fast lookup
    const activeLoansSnap = await getDocs(loansColRef);
    const activeLoanMap = new Map(); // key: `${memberId}|${loanTypeLower}`
    activeLoansSnap.forEach(d => {
      const L = d.data();
      const status = (L.status || "").toLowerCase();
      if (status === "active" && Number(L.outstandingAmount || 0) > 0) {
        const k = `${L.memberId}|${(L.loanType || "").toLowerCase()}`;
        activeLoanMap.set(k, { ref: d.ref, data: L });
      }
    });

    // 2) Utilities
    const toISO = (raw) => {
      if (!raw) return new Date().toISOString().split("T")[0];
      if (typeof raw === "number" || !isNaN(Number(raw))) {
        const excelSerial = Number(raw);
        const excelEpoch = Date.UTC(1899, 11, 30);
        const msPerDay = 86400000;
        const utcDate = new Date(
          excelEpoch + (excelSerial - (excelSerial >= 60 ? 1 : 0)) * msPerDay
        );
        return utcDate.toISOString().split("T")[0];
      }
      if (typeof raw === "string" && /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(raw.trim())) {
        const [d, m, y] = raw.trim().split(/[-/]/).map(n => parseInt(n, 10));
        return new Date(Date.UTC(y, m - 1, d)).toISOString().split("T")[0];
      }
      const parsed = new Date(raw);
      return !isNaN(parsed) ? parsed.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
    };

    // 3) Batch in chunks (≤ 500 ops). We’ll use 450 to leave room for updates.
    let batch = writeBatch(db);
    let ops = 0;
    let importedCount = 0;

    const commitBatch = async () => {
      if (ops > 0) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    };

    for (let i = 0; i < previewData.length; i++) {
      const row = previewData[i];

      const type = row.Type || row.type;
      const rawMember = row.MemberName || row.memberName;
      const member = members.find(m => (m.name || "").toLowerCase() === (rawMember || "").toLowerCase());
      if (!member) {
        console.warn(`Skipping row ${i + 1}: Unknown member "${rawMember}"`);
        continue;
      }

      const dateISO = toISO(row.Date || row.date);
      const baseTx = {
        type,
        memberId: member.id,
        date: dateISO,
        description: row.Description || row.description || "",
        createdAt: serverTimestamp(),
        recordedBy: userId,
      };

      const loanTypeRaw = (row["Loan Type"] || row.loanType || "").trim();
      const normalizedLoanType = loanTypeRaw
        ? loanTypeRaw.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
        : "";

      // ---- LOAN REPAYMENT / DISBURSED ----
      if (type === "Loan Repayment" || type === "Loan Disbursed") {
        const loanTypeLower = (normalizedLoanType || "").toLowerCase();
        const key = `${member.id}|${loanTypeLower}`;

        // LOAN REPAYMENT
        if (type === "Loan Repayment") {
          const principal = Number(row["Principal Repaid"] ?? row.principalRepaid ?? 0) || 0;
          const interest  = Number(row["Interest Repaid"]  ?? row.interestRepaid  ?? 0) || 0;
          const total = principal + interest;

          const txDocRef = doc(txColRef);
          batch.set(txDocRef, {
            ...baseTx,
            loanType: normalizedLoanType,
            principalRepaid: principal,
            interestRepaid: interest,
            amount: total,
          });
          ops++;

          // Update matched loan (from our prefetch map)
          const match = activeLoanMap.get(key);
          if (match) {
            const L = match.data;
            const newOutstanding = Math.max(0, Number(L.outstandingAmount || 0) - principal);
            const newTotalRepaid = Number(L.totalRepaid || 0) + total;

            batch.update(match.ref, {
              outstandingAmount: newOutstanding,
              totalRepaid: newTotalRepaid,
              status: newOutstanding === 0 ? "closed" : "active",
              updatedAt: serverTimestamp(),
            });
            ops++;

            // If closed, remove from map so future rows don't try to update again
            if (newOutstanding === 0) activeLoanMap.delete(key);
            else {
              // keep map in sync for subsequent rows
              match.data.outstandingAmount = newOutstanding;
              match.data.totalRepaid = newTotalRepaid;
            }
          } else {
            console.warn(`No active loan found for ${member.name} (${normalizedLoanType}) on row ${i + 1}`);
          }
        }

        // LOAN DISBURSED
        if (type === "Loan Disbursed") {
          const principalAmount = Number(row.Amount ?? row.amount ?? 0) || 0;
          if (principalAmount <= 0) {
            console.warn(`Skipping invalid loan amount for ${member.name} on row ${i + 1}`);
          } else {
            // create loan
            const newLoanRef = doc(loansColRef);
            batch.set(newLoanRef, {
              id: newLoanRef.id,
              memberId: member.id,
              loanType: normalizedLoanType || "Book Loan",
              principalAmount,
              outstandingAmount: principalAmount,
              totalRepaid: 0,
              status: "active",
              date: dateISO,
              description: row.Description || "",
              createdAt: serverTimestamp(),
              recordedBy: userId,
            });
            ops++;

            // matching transaction
            const txDocRef = doc(txColRef);
            batch.set(txDocRef, {
              ...baseTx,
              loanId: newLoanRef.id,
              loanType: normalizedLoanType || "Book Loan",
              amount: principalAmount,
              type: "Loan Disbursed",
            });
            ops++;

            // also add to activeLoanMap so same import can repay later rows
            const newKey = `${member.id}|${((normalizedLoanType || "Book Loan")).toLowerCase()}`;
            activeLoanMap.set(newKey, {
              ref: newLoanRef,
              data: {
                memberId: member.id,
                loanType: normalizedLoanType || "Book Loan",
                outstandingAmount: principalAmount,
                totalRepaid: 0,
                status: "active",
              },
            });
          }
        }
      }
      // ---- OTHER TRANSACTIONS ----
      else {
        const amount = Number(row.Amount ?? row.amount ?? 0) || 0;
        const txDocRef = doc(txColRef);
        batch.set(txDocRef, {
          ...baseTx,
          amount,
          ...(normalizedLoanType ? { loanType: normalizedLoanType } : {}),
        });
        ops++;
      }

      importedCount++;

      // Commit chunk
      if (ops >= 450) {
        await commitBatch();
      }
    }

    // Final commit
    await commitBatch();

    console.log(`✅ Import finished. ${importedCount} transactions imported.`);
    alert(`XLSX import finished. ${importedCount} rows imported.`);

    setPreviewData([]);
    setUploadedFile(null);

    if (typeof fetchTransactions === "function") {
      await fetchTransactions(); // parent refresh
    }
  } catch (error) {
    console.error("Error importing XLSX:", error);
    alert("Error importing XLSX: " + (error.message || error));
  }

  // Reset file input so same filename can re-trigger
  setFileInputKey(k => k + 1);
  setUploadedFile(null);
  setPreviewData([]);
};

// ✳️ CACHE-BUSTED FILE READER — only this function and the input below changed
// 🔥 Ultimate cache-proof Excel loader
const handleXLSXFileChange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  console.log("📁 File selected:", file.name, file.lastModified);

  // Full hard reset
  setUploadedFile(null);
  setPreviewData([]);

  // Make this file unique to kill any memory reuse
  const uniqueTag = `${crypto.randomUUID()}_${Date.now()}`;
  const uniqueFile = new File([file], uniqueTag, { type: file.type });

  // Recreate reader each time (not reused)
  const reader = new FileReader();

  reader.onload = (evt) => {
    try {
      const buffer = evt.target.result;
      const wb = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
        cellNF: false,
        cellText: false,
      });

      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, {
        defval: "",
        raw: false,
        dateNF: "yyyy-mm-dd",
      });

      console.log("✅ Read fresh Excel:", {
        uniqueTag,
        rows: data.length,
        firstRow: data[0],
      });

      setUploadedFile(uniqueFile);
      setPreviewData(data);

      // force UI refresh of <input type="file">
      setFileInputKey((k) => k + 1);

      // fully dispose reader
      reader.abort();
    } catch (err) {
      console.error("❌ Parse error:", err);
      alert("Failed to parse Excel: " + (err.message || err));
      setPreviewData([]);
      setUploadedFile(null);
    }
  };

  reader.onerror = (err) => {
    console.error("⚠️ FileReader error:", err);
    alert("Error reading file: " + (err.message || err));
    setPreviewData([]);
    setUploadedFile(null);
  };

  // 🚫 async microdelay prevents sync cache reuse
  await new Promise((r) => setTimeout(r, 25));

  reader.readAsArrayBuffer(uniqueFile);
};

const transactionTableRef = useRef();

return (
  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg animate-fade-in space-y-6">
    <h2 className="text-3xl font-extrabold text-blue-800 dark:text-blue-300">
      Bookkeeping
    </h2>

    {/* Import / CSV controls */}
    <section className="p-4 border rounded-md bg-gray-50 dark:bg-gray-700">
      <h3 className="font-semibold mb-2">Import Monthly Excel / CSV</h3>
     <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* 🧩 Cache-proof file input */}
        <input
          key={fileInputKey}
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            const input = e.target;
            if (!input.files?.length) return;

            const file = input.files[0];
            const uniqueFile = new File([file], `${Date.now()}_${file.name}`, {
              type: file.type,
            });

            // Reset states before parsing
            setUploadedFile(null);
            setPreviewData([]);

            const reader = new FileReader();
            reader.onload = (evt) => {
              try {
                const wb = XLSX.read(evt.target.result, {
                  type: "array",
                  cellDates: true,
                  cellNF: false,
                  cellText: false,
                });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, {
                  defval: "",
                  raw: false,
                  dateNF: "yyyy-mm-dd",
                });

                console.log("✅ Fresh import success:", {
                  name: uniqueFile.name,
                  modified: uniqueFile.lastModified,
                  rows: data.length,
                  firstRow: data[0],
                });

                setUploadedFile(uniqueFile);
                setPreviewData(data);
              } catch (err) {
                console.error("❌ Excel parse error:", err);
                alert("Failed to parse Excel file: " + (err.message || err));
                setPreviewData([]);
                setUploadedFile(null);
              }
            };

            reader.readAsArrayBuffer(uniqueFile);

            // 🧹 Force reset actual <input> element
            input.value = "";
          }}
          className="p-1"
        />

        <button
          onClick={() => console.log(previewData)}
          className="px-3 py-2 bg-blue-600 text-white rounded-md"
        >
          Import Preview Rows
        </button>

        <button
          onClick={importXLSXRows}
          className="px-3 py-2 bg-green-600 text-white rounded-md"
        >
          Import Entire File
        </button>

        {/* ✅ Clear button also clears input memory */}
        <button
          onClick={() => {
            setUploadedFile(null);
            setPreviewData([]);
            setFileInputKey((k) => k + 1);

            const input = document.querySelector('input[type="file"]');
            if (input) input.value = ""; // full browser reset
            console.log("🧹 Cleared file input + cache reset");
          }}
          className="px-3 py-2 bg-gray-300 rounded-md"
        >
          Clear
        </button>
      </div>

      {previewData.length > 0 && (
        <div className="overflow-x-auto max-h-60 border rounded p-2 bg-white dark:bg-gray-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {Object.keys(previewData[0]).map((key) => (
                  <th
                    key={key}
                    className="border px-2 py-1 bg-gray-200 dark:bg-gray-700"
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.slice(0, 5).map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((val, j) => (
                    <td key={j} className="border px-2 py-1">
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {previewData.length > 5 && (
            <p className="mt-1 text-xs text-gray-500">
              Showing first 5 rows of {previewData.length}
            </p>
          )}
        </div>
      )}
    </section>

      {/* Record Saving */}
      <section className="p-4 border rounded-md bg-blue-50 dark:bg-blue-900/10">
        <h3 className="font-semibold mb-3">Record Saving</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          >
            <option value="">Select Member</option>
            {membersOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={savingType}
            onChange={(e) => setSavingType(e.target.value)}
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          >
            <option>Monthly Saving</option>
            <option>Additional Saving</option>
            <option>Fine</option>
          </select>

          <input
            type="number"
            value={savingAmount}
            onChange={(e) => setSavingAmount(e.target.value)}
            placeholder="Amount (₹)"
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />

          <input
            type="date"
            value={savingDate}
            onChange={(e) => setSavingDate(e.target.value)}
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />
        </div>
        <div className="mt-3">
          <button
            onClick={async () => {
              if (!db || !userId || !shgId) {
                setAlertMessage("Internal error: DB / user / SHG not initialized");
                setShowAlert(true);
                return;
              }
              if (!selectedMemberId || !savingAmount) {
                setAlertMessage("Please select a member and enter amount.");
                setShowAlert(true);
                return;
              }
              try {
                const txColRef = collection(
                  db,
                  "artifacts",
                  APP_ID,
                  "users",
                  userId,
                  "shg_groups",
                  shgId,
                  "transactions"
                );
                await addDoc(txColRef, {
                  type: savingType === "Fine" ? "Fine" : "Saving",
                  savingType,
                  memberId: selectedMemberId,
                  amount: parseFloat(savingAmount),
                  date: savingDate || new Date().toISOString().split("T")[0],
                  createdAt: serverTimestamp(),
                  recordedBy: userId,
                });
                setAlertMessage("Saving recorded successfully!");
                setShowAlert(true);
                setSelectedMemberId("");
                setSavingAmount("");
                setSavingDate("");
                setSavingType("Monthly Saving");
              } catch (err) {
                console.error("Error recording saving:", err);
                setAlertMessage("Failed to record saving.");
                setShowAlert(true);
              }
            }}
            className="w-full py-3 bg-green-600 text-white rounded-md"
          >
            Record Saving
          </button>
        </div>
      </section>

      <div className="bg-pink-200 shadow rounded-lg p-4 mt-6">
        <h3 className="text-lg font-bold mb-4">Record General Saving (Donation/Bank)</h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          <input
            type="number"
            value={generalSavingAmount}
            onChange={(e) => setGeneralSavingAmount(e.target.value)}
            placeholder="Amount"
            className="border p-2 rounded w-full"
          />

          <input
            type="text"
            value={generalSavingSource}
            onChange={(e) => setGeneralSavingSource(e.target.value)}
            placeholder="Source (e.g., Donation, Bank)"
            className="border p-2 rounded w-full"
          />

          <input
            type="date"
            value={generalSavingDate}
            onChange={(e) => setGeneralSavingDate(e.target.value)}
            className="border p-2 rounded w-full"
          />

          <input
            type="text"
            value={generalSavingDescription}
            onChange={(e) => setGeneralSavingDescription(e.target.value)}
            placeholder="Description"
            className="border p-2 rounded w-full"
          />

          <button
            onClick={recordGeneralSaving}
            className="px-4 py-2 bg-green-600 text-white rounded w-full"
          >
            Save General Saving
          </button>
        </div>
      </div>

      {/* Record Loan Disbursement */}
      <section className="p-4 border rounded-md bg-orange-200 dark:bg-red-900/10">
        <h3 className="font-semibold mb-3">Record Loan Disbursement</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={loanMemberId}
            onChange={(e) => setLoanMemberId(e.target.value)}
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          >
            <option value="">Select Member</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={loanAmount}
            onChange={(e) => setLoanAmount(e.target.value)}
            placeholder="Loan Amount (₹)"
            min="0"
            step="0.01"
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />

          <input
            type="number"
            value={loanInterestRate}
            onChange={(e) => setLoanInterestRate(e.target.value)}
            placeholder="Interest Rate (%) — optional"
            min="0"
            step="0.01"
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />

          <input
            type="date"
            value={loanDate}
            onChange={(e) => setLoanDate(e.target.value)}
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <input
            type="number"
            value={loanTermMonths}
            onChange={(e) => setLoanTermMonths(e.target.value)}
            placeholder="Term (months) — optional"
            min="0"
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />

          <select
            value={loanType}
            onChange={(e) => setLoanType(e.target.value)}
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          >
            <option value="">Select Loan Type</option>
            <option value="Book Loan">Book Loan</option>
            <option value="Bank Loan">Bank Loan</option>
          </select>

          <input
            type="text"
            value={loanDescription}
            onChange={(e) => setLoanDescription(e.target.value)}
            placeholder="Description (Optional)"
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />
        </div>

        <div className="mt-3">
          <button
            onClick={recordLoanDisbursement}
            className="w-full py-3 bg-blue-600 text-white rounded-md"
          >
            Disburse Loan
          </button>
        </div>
      </section>

      {/* Record Loan Repayment */}
      <section className="p-4 border rounded-md bg-yellow-50 dark:bg-yellow-900/10">
        <h3 className="font-semibold mb-3">Record Loan Repayment</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={selectedLoanId}
            onChange={(e) => setSelectedLoanId(e.target.value)}
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          >
            <option value="">Select Active Loan</option>

            {activeLoans.map((l) => {
              const isBank = l.loanType === "Bank Loan";
              const icon = isBank ? "🏦" : "📘";
              const color = isBank ? "blue" : "black";
              const fontWeight = isBank ? "600" : "normal";

              return (
                <option
                  key={l.id}
                  value={l.id}
                  style={{ color, fontWeight }}
                >
                  {`${icon} ${getMemberName ? getMemberName(l.memberId) : l.memberId} — ₹${Number(
                    l.principalAmount
                  ).toLocaleString()} (${l.loanType || "Loan"}), Outstanding — ₹${Number(
                    l.outstandingAmount
                  ).toLocaleString()}`}
                </option>
              );
            })}
          </select>

          <input
            type="number"
            value={principalRepaymentAmount}
            onChange={(e) => setPrincipalRepaymentAmount(e.target.value)}
            placeholder="Principal Repaid (₹)"
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />

          <input
            type="number"
            value={interestRepaymentAmount}
            onChange={(e) => setInterestRepaymentAmount(e.target.value)}
            placeholder="Interest Repaid (₹)"
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />

          <input
            type="date"
            value={repaymentDate}
            onChange={(e) => setRepaymentDate(e.target.value)}
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />
        </div>

        <div className="mt-3">
          <button
            onClick={recordLoanRepayment}
            className="w-full py-3 bg-green-700 text-white rounded-md"
          >
            Record Repayment
          </button>
        </div>
      </section>

      {/* Record Expense */}
      <section className="p-4 border rounded-md bg-pink-100 dark:bg-pink-900/10">
        <h3 className="font-semibold mb-3">Record Expense</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="number"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            placeholder="Amount (₹)"
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />
          <select
            value={expenseCategory}
            onChange={(e) => setExpenseCategory(e.target.value)}
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          >
            <option>Stationery</option>
            <option>Meeting</option>
            <option>Fees</option>
            <option>Other</option>
          </select>
          <input
            type="text"
            value={expenseDescription}
            onChange={(e) => setExpenseDescription(e.target.value)}
            placeholder="Description (Optional)"
            className="p-2 border rounded-md bg-white dark:bg-gray-700"
          />
        </div>
        <div className="mt-3">
          <button
            onClick={recordExpense}
            className="w-full py-3 bg-red-600 text-white rounded-md"
          >
            Record Expense
          </button>
        </div>
      </section>

      {/* Transactions table */}
      <section className="p-4 border rounded-md bg-gray-50 dark:bg-gray-700">
        <h3 className="font-semibold mb-3">Transactions & History</h3>

<TransactionTable
  ref={transactionTableRef}
  userId={userId}
  shgId={shgId}
  members={members}
  projectId={db.app.options.projectId}
  selectedMonth={filterMonth}
  selectedYear={filterYear}
/>
      </section>
    </div>
  );
};
export default BookkeepingScreen;
