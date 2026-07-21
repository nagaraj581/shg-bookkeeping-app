import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const INITIAL_LOAN_REPAYMENT = {
  principal: "",
  interest: "",
  loanType: "",
};

const INITIAL_LOAN_DISBURSED = {
  amount: "",
  loanType: "",
};

const inputClassName =
  "min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

const sectionCardClassName =
  "rounded-2xl border p-4 sm:p-5";

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const TransactionForm = ({
  db,
  userId,
  shgId,
  members = [],
  loans = [],
  setAlertMessage,
  setShowAlert,
  onClose,
}) => {
  const [memberId, setMemberId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState("");
  const [fine, setFine] = useState("");
  const [loanRepayment, setLoanRepayment] = useState(INITIAL_LOAN_REPAYMENT);
  const [loanDisbursed, setLoanDisbursed] = useState(INITIAL_LOAN_DISBURSED);
  const [loading, setLoading] = useState(false);
  const [inlineMessage, setInlineMessage] = useState("");

  const projectId = db?.app?.options?.projectId || "shg-bookkeeping-app";

  const selectedMember = useMemo(
    () => members.find((member) => member.id === memberId) || null,
    [memberId, members]
  );

  const activeMembers = useMemo(
    () =>
      members.filter(
        (member) => String(member.status || "active").toLowerCase() !== "exited"
      ),
    [members]
  );

  const memberActiveLoans = useMemo(
    () =>
      (loans || []).filter(
        (loan) =>
          loan?.memberId === memberId &&
          loan?.status === "active" &&
          Number(loan?.outstandingAmount || 0) > 0
      ),
    [loans, memberId]
  );

  const [selectedRepaymentLoanId, setSelectedRepaymentLoanId] = useState("");

  const selectedRepaymentLoan = useMemo(
    () => memberActiveLoans.find((loan) => loan.id === selectedRepaymentLoanId) || null,
    [memberActiveLoans, selectedRepaymentLoanId]
  );

  const memberLoanSummary = useMemo(() => {
    if (!memberId) {
      return null;
    }

    const activeCount = memberActiveLoans.length;
    const totalOutstanding = memberActiveLoans.reduce(
      (sum, loan) => sum + Number(loan?.outstandingAmount || 0),
      0
    );
    const totalPrincipal = memberActiveLoans.reduce(
      (sum, loan) => sum + Number(loan?.principalAmount || 0),
      0
    );

    return {
      activeCount,
      totalOutstanding,
      totalPrincipal,
    };
  }, [memberId, memberActiveLoans]);

  useEffect(() => {
    if (!memberId) {
      setSelectedRepaymentLoanId("");
      setLoanRepayment(INITIAL_LOAN_REPAYMENT);
      return;
    }

    if (memberActiveLoans.length === 1) {
      const onlyLoan = memberActiveLoans[0];
      setSelectedRepaymentLoanId(onlyLoan.id);
      setLoanRepayment((prev) => ({ ...prev, loanType: onlyLoan.loanType || "" }));
      return;
    }

    setSelectedRepaymentLoanId("");
    setLoanRepayment((prev) => ({ ...prev, loanType: "" }));
  }, [memberId, memberActiveLoans]);

  const resetForm = () => {
    setMemberId("");
    setDate(new Date().toISOString().split("T")[0]);
    setSaving("");
    setFine("");
    setLoanRepayment(INITIAL_LOAN_REPAYMENT);
    setLoanDisbursed(INITIAL_LOAN_DISBURSED);
    setSelectedRepaymentLoanId("");
  };

  const showMessage = (message) => {
    setInlineMessage(message);
    if (setAlertMessage) {
      setAlertMessage(message);
    }
    if (setShowAlert) {
      setShowAlert(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!db || !userId || !shgId) {
      showMessage("App not ready. Please try again.");
      return;
    }

    if (!memberId || !date) {
      showMessage("Please select a member and date.");
      return;
    }

    const memberName = selectedMember?.name || "";
    const normalizedDate = date;
    const txRef = collection(
      db,
      `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/transactions`
    );
    const loansRef = collection(
      db,
      `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/loans`
    );

    const savingValue = parseFloat(saving) || 0;
    const fineValue = parseFloat(fine) || 0;
    const principal = parseFloat(loanRepayment.principal) || 0;
    const interest = parseFloat(loanRepayment.interest) || 0;
    const loanDisbursedAmount = parseFloat(loanDisbursed.amount) || 0;
    const hasRepayment = principal > 0 || interest > 0;
    const hasDisbursal = loanDisbursedAmount > 0;
    let savedCount = 0;

    if ([savingValue, fineValue, principal, interest, loanDisbursedAmount].some((value) => value < 0)) {
      showMessage("Amounts cannot be negative.");
      return;
    }

    if (hasRepayment && !selectedRepaymentLoan) {
      showMessage("This member has no active loan selected for repayment.");
      return;
    }

    if (
      hasRepayment &&
      selectedRepaymentLoan &&
      principal > Number(selectedRepaymentLoan.outstandingAmount || 0)
    ) {
      showMessage("Principal repaid cannot be more than the selected loan outstanding.");
      return;
    }

    setLoading(true);
    setInlineMessage("");

    try {
      if (savingValue > 0) {
        await addDoc(txRef, {
          type: "Saving",
          memberId,
          memberName,
          amount: savingValue,
          savingType: "Monthly Saving",
          loanType: null,
          principalRepaid: 0,
          interestRepaid: 0,
          category: null,
          description: "Monthly Saving",
          date: normalizedDate,
          createdAt: serverTimestamp(),
          recordedBy: userId,
        });
        savedCount += 1;
      }

      if (fineValue > 0) {
        await addDoc(txRef, {
          type: "Fine",
          memberId,
          memberName,
          amount: fineValue,
          savingType: null,
          loanType: null,
          principalRepaid: 0,
          interestRepaid: 0,
          category: "Fine",
          description: "Fine Payment",
          date: normalizedDate,
          createdAt: serverTimestamp(),
          recordedBy: userId,
        });
        savedCount += 1;
      }

      if (hasRepayment) {
        const totalRepayment = principal + interest;
        const newOutstanding = Math.max(
          0,
          Number(selectedRepaymentLoan.outstandingAmount || 0) - principal
        );
        const newTotalRepaid =
          Number(selectedRepaymentLoan.totalRepaid || 0) + totalRepayment;
        const nextStatus = newOutstanding <= 0 ? "closed" : "active";

        await updateDoc(
          doc(
            db,
            `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/loans/${selectedRepaymentLoan.id}`
          ),
          {
            outstandingAmount: newOutstanding,
            totalRepaid: newTotalRepaid,
            status: nextStatus,
            updatedAt: serverTimestamp(),
          }
        );

        await addDoc(txRef, {
          type: "Loan Repayment",
          memberId,
          memberName,
          loanId: selectedRepaymentLoan.id,
          amount: totalRepayment,
          savingType: null,
          loanType: selectedRepaymentLoan.loanType || loanRepayment.loanType || "",
          principalRepaid: principal,
          interestRepaid: interest,
          category: null,
          description: "Loan Repayment",
          date: normalizedDate,
          createdAt: serverTimestamp(),
          recordedBy: userId,
        });
        savedCount += 1;
      }

      if (hasDisbursal) {
        const newLoanRef = doc(loansRef);
        const normalizedLoanType = loanDisbursed.loanType || "Book Loan";

        await setDoc(newLoanRef, {
          id: newLoanRef.id,
          memberId,
          memberName,
          loanType: normalizedLoanType,
          principalAmount: loanDisbursedAmount,
          outstandingAmount: loanDisbursedAmount,
          totalRepaid: 0,
          interestRate: null,
          termMonths: null,
          date: normalizedDate,
          description: "Loan Disbursed",
          status: "active",
          createdAt: serverTimestamp(),
          recordedBy: userId,
        });

        await addDoc(txRef, {
          type: "Loan Disbursed",
          loanId: newLoanRef.id,
          memberId,
          memberName,
          amount: loanDisbursedAmount,
          savingType: null,
          loanType: normalizedLoanType,
          principalRepaid: 0,
          interestRepaid: 0,
          category: null,
          description: "Loan Disbursed",
          date: normalizedDate,
          createdAt: serverTimestamp(),
          recordedBy: userId,
        });
        savedCount += 1;
      }

      if (savedCount === 0) {
        showMessage("No transactions entered.");
        return;
      }

      const successMessage = `${savedCount} transaction(s) saved successfully!`;
      showMessage(successMessage);
      resetForm();

      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error("Error saving transactions:", error);
      showMessage("Error while saving transactions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl rounded-2xl bg-white p-4 shadow-lg sm:p-6">
      <div className="mb-5 sm:mb-6">
        <h2 className="text-xl font-bold text-blue-700 sm:text-2xl">SHG Monthly Entry Form</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          Add saving, fine, loan repayment, and loan disbursal for one member in a single save.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Member</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className={inputClassName}
              required
            >
              <option value="">Select Member</option>
              {activeMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClassName}
              style={{ WebkitAppearance: "none" }}
              required
            />
          </div>
        </div>

        {selectedMember && memberLoanSummary && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Selected Member
              </p>
              <p className="mt-1 break-words text-base font-semibold text-slate-800">
                {selectedMember.name}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Active Loans
              </p>
              <p className="mt-1 text-base font-semibold text-slate-800">
                {memberLoanSummary.activeCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total Outstanding
              </p>
              <p className="mt-1 text-base font-semibold text-slate-800">
                {formatCurrency(memberLoanSummary.totalOutstanding)}
              </p>
            </div>
          </div>
        )}

        <div className={`${sectionCardClassName} border-blue-100 bg-blue-50`}>
          <h3 className="mb-3 text-base font-semibold text-blue-800 sm:text-lg">Saving and Fine</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Saving Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={saving}
                onChange={(e) => setSaving(e.target.value)}
                onWheel={(e) => e.target.blur()}
                placeholder="e.g. 500"
                className={inputClassName}
                inputMode="decimal"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fine Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={fine}
                onChange={(e) => setFine(e.target.value)}
                onWheel={(e) => e.target.blur()}
                placeholder="e.g. 250"
                className={inputClassName}
                inputMode="decimal"
              />
            </div>
          </div>
        </div>

        <div className={`${sectionCardClassName} border-emerald-100 bg-emerald-50`}>
          <h3 className="mb-3 text-base font-semibold text-emerald-800 sm:text-lg">Loan Repayment</h3>
          {memberId && memberActiveLoans.length === 0 && (
            <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
              This member has no active loan to repay.
            </p>
          )}
          {memberActiveLoans.length > 0 && (
            <div className="mb-3 rounded-lg bg-white/80 px-3 py-2 text-sm text-gray-700">
              Outstanding:
              {" "}
              {selectedRepaymentLoan
                ? `${formatCurrency(selectedRepaymentLoan.outstandingAmount)} for ${selectedRepaymentLoan.loanType || "Loan"}`
                : `${memberActiveLoans.length} active loan(s) found`}
            </div>
          )}
          {selectedRepaymentLoan && (
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <div className="rounded-lg bg-white/80 px-3 py-2 text-sm text-gray-700">
                <span className="font-semibold text-gray-900">Loan Type:</span>{" "}
                {selectedRepaymentLoan.loanType || "Loan"}
              </div>
              <div className="rounded-lg bg-white/80 px-3 py-2 text-sm text-gray-700">
                <span className="font-semibold text-gray-900">Original Amount:</span>{" "}
                {formatCurrency(selectedRepaymentLoan.principalAmount)}
              </div>
              <div className="rounded-lg bg-white/80 px-3 py-2 text-sm text-gray-700">
                <span className="font-semibold text-gray-900">Repaid So Far:</span>{" "}
                {formatCurrency(selectedRepaymentLoan.totalRepaid)}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {memberActiveLoans.length > 1 && (
              <div className="md:col-span-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Active Loan
                </label>
                <select
                  value={selectedRepaymentLoanId}
                  onChange={(e) => {
                    const nextLoan =
                      memberActiveLoans.find((loan) => loan.id === e.target.value) || null;
                    setSelectedRepaymentLoanId(e.target.value);
                    setLoanRepayment((prev) => ({
                      ...prev,
                      loanType: nextLoan?.loanType || "",
                    }));
                  }}
                  className={inputClassName}
                >
                  <option value="">Select Active Loan</option>
                  {memberActiveLoans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {`${loan.loanType || "Loan"} - Outstanding ₹${Number(
                        loan.outstandingAmount || 0
                      ).toLocaleString("en-IN")}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Loan Type</label>
              <select
                value={loanRepayment.loanType}
                onChange={(e) =>
                  setLoanRepayment((prev) => ({ ...prev, loanType: e.target.value }))
                }
                className={inputClassName}
                disabled={Boolean(selectedRepaymentLoan)}
              >
                <option value="">None</option>
                <option value="Book Loan">Book Loan</option>
                <option value="Bank Loan">Bank Loan</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Principal Repaid
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={loanRepayment.principal}
                onChange={(e) =>
                  setLoanRepayment((prev) => ({ ...prev, principal: e.target.value }))
                }
                onWheel={(e) => e.target.blur()}
                placeholder="e.g. 3000"
                className={inputClassName}
                inputMode="decimal"
                disabled={!selectedRepaymentLoan && memberActiveLoans.length === 0}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Interest Repaid
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={loanRepayment.interest}
                onChange={(e) =>
                  setLoanRepayment((prev) => ({ ...prev, interest: e.target.value }))
                }
                onWheel={(e) => e.target.blur()}
                placeholder="e.g. 200"
                className={inputClassName}
                inputMode="decimal"
                disabled={!selectedRepaymentLoan && memberActiveLoans.length === 0}
              />
            </div>
          </div>
        </div>

        <div className={`${sectionCardClassName} border-red-100 bg-red-50`}>
          <h3 className="mb-3 text-base font-semibold text-red-800 sm:text-lg">Loan Disbursed</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Loan Type</label>
              <select
                value={loanDisbursed.loanType}
                onChange={(e) =>
                  setLoanDisbursed((prev) => ({ ...prev, loanType: e.target.value }))
                }
                className={inputClassName}
              >
                <option value="">None</option>
                <option value="Book Loan">Book Loan</option>
                <option value="Bank Loan">Bank Loan</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Loan Amount Disbursed
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={loanDisbursed.amount}
                onChange={(e) =>
                  setLoanDisbursed((prev) => ({ ...prev, amount: e.target.value }))
                }
                onWheel={(e) => e.target.blur()}
                placeholder="e.g. 5000"
                className={inputClassName}
                inputMode="decimal"
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0">
          <button
            type="submit"
            disabled={loading}
            className="min-h-[52px] w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Saving..." : "Save All Transactions"}
          </button>
        </div>
      </form>

      {inlineMessage && (
        <p
          className={`mt-4 text-sm font-medium ${
            /successfully/i.test(inlineMessage)
              ? "text-green-700"
              : /no transactions/i.test(inlineMessage)
                ? "text-amber-700"
                : "text-red-700"
          }`}
        >
          {inlineMessage}
        </p>
      )}
    </div>
  );
};

export default TransactionForm;
