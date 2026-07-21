import React, { useMemo, useState } from "react";
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

const formatMoney = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const toAmount = (value) => Number(value || 0);
const normalizeEmail = (value = "") => String(value).trim().toLowerCase();

const calculateMemberSavings = (transactions, memberId) =>
  transactions
    .filter((tx) => tx.memberId === memberId && tx.type === "Saving")
    .reduce((sum, tx) => sum + toAmount(tx.amount), 0);

const calculateOutstandingLoan = (loans, memberId) =>
  getActiveMemberLoans(loans, memberId).reduce(
    (sum, loan) => sum + toAmount(loan.outstandingAmount),
    0
  );

const getActiveMemberLoans = (loans, memberId) =>
  loans
    .filter(
      (loan) =>
        loan.memberId === memberId &&
        String(loan.status || "active").toLowerCase() !== "closed" &&
        toAmount(loan.outstandingAmount) > 0
    )
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

const calculatePendingInterest = (loans, memberId) =>
  loans
    .filter(
      (loan) =>
        loan.memberId === memberId &&
        String(loan.status || "active").toLowerCase() !== "closed"
    )
    .reduce(
      (sum, loan) =>
        sum +
        toAmount(
          loan.pendingInterest ??
            loan.interestDue ??
            loan.outstandingInterest ??
            loan.unpaidInterest
        ),
      0
    );

export default function MemberExitScreen({
  members = [],
  transactions = [],
  loans = [],
  db = null,
  userId = "",
  shgId = "",
  setAlertMessage = () => {},
  setShowAlert = () => {},
  setConfirmAction = () => {},
  setCurrentPage = () => {},
}) {
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [exitDate, setExitDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [savingExit, setSavingExit] = useState(false);

  const activeMembers = useMemo(
    () =>
      members.filter(
        (member) => String(member.status || "active").toLowerCase() !== "exited"
      ),
    [members]
  );

  const selectedMember = activeMembers.find((member) => member.id === selectedMemberId);

  const settlement = useMemo(() => {
    const totalSavings = calculateMemberSavings(transactions, selectedMemberId);
    const outstandingLoan = calculateOutstandingLoan(loans, selectedMemberId);
    const pendingInterest = calculatePendingInterest(loans, selectedMemberId);
    const totalDues = outstandingLoan + pendingInterest;
    const balance = totalSavings - totalDues;
    const savingsAppliedToLoan = Math.min(totalSavings, outstandingLoan);

    return {
      totalSavings,
      outstandingLoan,
      pendingInterest,
      totalDues,
      savingsAppliedToLoan,
      payableToMember: Math.max(0, balance),
      collectFromMember: Math.max(0, -balance),
    };
  }, [loans, selectedMemberId, transactions]);

  const approveExit = async () => {
    const showResultAfterConfirm = (message) => {
      setAlertMessage(message);
      setTimeout(() => setShowAlert(true), 0);
    };

    if (!db || !userId || !shgId) {
      showResultAfterConfirm("App not ready. Please try again.");
      return;
    }

    if (!selectedMember) {
      showResultAfterConfirm("Please select a member.");
      return;
    }

    setSavingExit(true);

    try {
      const projectId = db?.app?.options?.projectId || "shg-bookkeeping-app";
      const basePath = `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}`;
      const activeLoans = getActiveMemberLoans(loans, selectedMemberId);
      let remainingAdjustment = settlement.savingsAppliedToLoan;

      const loanAdjustments = activeLoans
        .map((loan) => {
          if (remainingAdjustment <= 0) return null;

          const currentOutstanding = toAmount(loan.outstandingAmount);
          const adjustedAmount = Math.min(remainingAdjustment, currentOutstanding);
          remainingAdjustment -= adjustedAmount;

          return {
            loanId: loan.id,
            loanType: loan.loanType || "Loan",
            adjustedAmount,
            outstandingBefore: currentOutstanding,
            outstandingAfter: Math.max(0, currentOutstanding - adjustedAmount),
          };
        })
        .filter(Boolean);

      const batch = writeBatch(db);
      const exitsRef = doc(collection(db, `${basePath}/member_exits`));
      const auditTxRef = doc(collection(db, `${basePath}/transactions`));
      const memberRef = doc(db, `${basePath}/members/${selectedMemberId}`);
      const memberEmail = normalizeEmail(selectedMember.email);

      batch.set(exitsRef, {
        memberId: selectedMemberId,
        memberName: selectedMember.name || "",
        exitDate,
        reason: reason.trim() || "Leaving group",
        totalSavings: settlement.totalSavings,
        outstandingLoan: settlement.outstandingLoan,
        pendingInterest: settlement.pendingInterest,
        totalDues: settlement.totalDues,
        savingsAppliedToLoan: settlement.savingsAppliedToLoan,
        payableToMember: settlement.payableToMember,
        collectFromMember: settlement.collectFromMember,
        loanAdjustments,
        status: "approved",
        createdAt: serverTimestamp(),
        recordedBy: userId,
      });

      batch.set(auditTxRef, {
        type: "Member Exit Adjustment",
        memberId: selectedMemberId,
        memberName: selectedMember.name || "",
        amount: settlement.savingsAppliedToLoan,
        date: exitDate,
        category: "Member Exit",
        description: "Member savings adjusted against outstanding loan at exit.",
        savingType: null,
        loanAdjustments,
        createdAt: serverTimestamp(),
        recordedBy: userId,
      });

      loanAdjustments.forEach((adjustment) => {
        const loanRef = doc(db, `${basePath}/loans/${adjustment.loanId}`);
        batch.update(loanRef, {
          outstandingAmount: adjustment.outstandingAfter,
          status: adjustment.outstandingAfter <= 0 ? "closed" : "active",
          exitAdjustedAmount: adjustment.adjustedAmount,
          exitSettlementId: exitsRef.id,
          updatedAt: serverTimestamp(),
        });
      });

      batch.update(memberRef, {
        status: "exited",
        exitDate,
        exitReason: reason.trim() || "Leaving group",
        exitSettlementId: exitsRef.id,
        exitSettlementSummary: {
          totalSavings: settlement.totalSavings,
          outstandingLoan: settlement.outstandingLoan,
          pendingInterest: settlement.pendingInterest,
          savingsAppliedToLoan: settlement.savingsAppliedToLoan,
          payableToMember: settlement.payableToMember,
          collectFromMember: settlement.collectFromMember,
        },
        updatedAt: serverTimestamp(),
      });

      if (memberEmail) {
        batch.delete(doc(db, `artifacts/${projectId}/users/${userId}/member_access/${memberEmail}`));
      }

      await batch.commit();

      showResultAfterConfirm(
        `Exit approved for ${selectedMember.name}.\nSavings adjusted to loan: ${formatMoney(
          settlement.savingsAppliedToLoan
        )}\nBalance payable: ${formatMoney(
          settlement.payableToMember
        )}\nBalance to collect: ${formatMoney(settlement.collectFromMember)}`
      );
      setCurrentPage("members");
    } catch (error) {
      console.error("approveExit error:", error);
      showResultAfterConfirm(`Error approving exit: ${error.message || error}`);
    } finally {
      setSavingExit(false);
    }
  };

  const requestApproveExit = () => {
    if (!selectedMember) {
      setAlertMessage("Please select a member.");
      setShowAlert(true);
      return;
    }

    setAlertMessage(
      `Approve exit for ${selectedMember.name}?\n\nSavings adjusted to loan: ${formatMoney(
        settlement.savingsAppliedToLoan
      )}\nBalance payable: ${formatMoney(
        settlement.payableToMember
      )}\nBalance to collect: ${formatMoney(settlement.collectFromMember)}`
    );
    setConfirmAction(() => approveExit);
    setShowAlert(true);
  };

  return (
    <div className="animate-fade-in rounded-xl bg-white p-4 shadow-lg dark:bg-gray-800 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-blue-800 dark:text-blue-300">
            Member Exit
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Check savings, loan dues, and final balance before a member leaves.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCurrentPage("members")}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          Back to Members
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">
            Select Member
          </span>
          <select
            value={selectedMemberId}
            onChange={(event) => setSelectedMemberId(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">Choose member</option>
            {activeMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">
            Exit Date
          </span>
          <input
            type="date"
            value={exitDate}
            onChange={(event) => setExitDate(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">
            Reason
          </span>
          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Leaving group"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </label>
      </div>

      <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
        {!selectedMember ? (
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Select a member to see the exit settlement.
          </p>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-sm text-blue-700 dark:text-blue-200">Settlement for</p>
              <h3 className="text-xl font-bold text-blue-950 dark:text-white">
                {selectedMember.name}
              </h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryBox label="Total Savings" value={formatMoney(settlement.totalSavings)} />
              <SummaryBox label="Outstanding Loan" value={formatMoney(settlement.outstandingLoan)} />
              <SummaryBox label="Pending Interest" value={formatMoney(settlement.pendingInterest)} />
              <SummaryBox label="Total Dues" value={formatMoney(settlement.totalDues)} />
            </div>

            <div className="mt-4 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
              {settlement.payableToMember > 0 ? (
                <p className="text-lg font-bold text-green-700 dark:text-green-300">
                  Balance payable to member: {formatMoney(settlement.payableToMember)}
                </p>
              ) : settlement.collectFromMember > 0 ? (
                <p className="text-lg font-bold text-red-700 dark:text-red-300">
                  Balance still to collect: {formatMoney(settlement.collectFromMember)}
                </p>
              ) : (
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  No balance payable or collectable after adjustment.
                </p>
              )}
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Savings will first be adjusted against pending loan and interest.
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Approving will mark this member as exited and stop new savings or loans.
              </p>
              <button
                type="button"
                onClick={requestApproveExit}
                disabled={savingExit}
                className="rounded-lg bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingExit ? "Saving Exit..." : "Approve Exit"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="h-20" aria-hidden="true" />
    </div>
  );
}

const SummaryBox = ({ label, value }) => (
  <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
    <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
      {label}
    </p>
    <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
  </div>
);
