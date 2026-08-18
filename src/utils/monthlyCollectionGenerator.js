const SAVING_AMOUNT = 500;
const INTEREST_RATE = 1; // 1%
const PENALTY_AMOUNT = 250;

function getPrincipalAmount(loanAmount) {
  const amount = Number(loanAmount) || 0;

  if (amount <= 0) return 0;
  if (amount <= 30000) return 1000;
  if (amount <= 60000) return 2000;

  return 3000;
}

const getPreviousMonth = (currentMonthStr) => {
  const [year, month] = currentMonthStr.split("-").map(Number);
  const currentMonthDate = new Date(year, month - 1, 1);
  currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
  const prevYear = currentMonthDate.getFullYear();
  const prevMonth = String(currentMonthDate.getMonth() + 1).padStart(2, "0");
  return `${prevYear}-${prevMonth}`;
};

const normalizeType = (value) => String(value || "").trim().toLowerCase();

export function generateMonthlyCollection(
  members = [],
  loans = [],
  transactions = [],
  selectedMonth
) {
  const previousMonth = getPreviousMonth(selectedMonth);

  return members
    .filter(
      (member) => String(member.status || "active").toLowerCase() !== "exited"
    )
    .map((member, index) => {
      const previousMonthPayments = transactions.filter((tx) => {
        if (tx.memberId !== member.id) return false;
        const txDate = new Date(tx.date);
        return (
          txDate.getFullYear() === parseInt(previousMonth.split("-")[0]) &&
          txDate.getMonth() === parseInt(previousMonth.split("-")[1]) - 1
        );
      });

      const memberLoans = loans.filter((loan) => {
        if (loan.status === "closed") return false;
        if ((loan.outstandingAmount || 0) <= 0) return false;

        if (loan.memberId && member.id) {
          return loan.memberId === member.id;
        }

        return (
          String(loan.memberName || "").trim() ===
          String(member.name || "").trim()
        );
      });

      let principal = 0;
      let interest = 0;
      let saving = SAVING_AMOUNT;
      let penalty = 0;

      memberLoans.forEach((loan) => {
        principal += getPrincipalAmount(loan.principalAmount);
        interest += Math.round(
          (Number(loan.outstandingAmount || 0) * INTEREST_RATE) / 100
        );
      });

      const paidSavingsLastMonth = previousMonthPayments.some(
        (tx) => normalizeType(tx.type) === "saving" && (Number(tx.amount) || 0) > 0
      );
      const paidInterestLastMonth = previousMonthPayments.some(
        (tx) =>
          normalizeType(tx.type) === "loan repayment" &&
          (Number(tx.interestRepaid) || 0) > 0
      );
      const paidAnythingLastMonth = previousMonthPayments.some(
        (tx) => (Number(tx.amount) || 0) > 0
      );

      if (!paidSavingsLastMonth) {
        saving *= 2;
      }
      if (!paidInterestLastMonth) {
        interest *= 2;
      }
      if (!paidAnythingLastMonth) {
        penalty = PENALTY_AMOUNT;
      }

      return {
        slNo: index + 1,
        memberName: member.name,
        saving,
        principal,
        interest,
        penalty,
        total: saving + principal + interest + penalty,
      };
    });
}