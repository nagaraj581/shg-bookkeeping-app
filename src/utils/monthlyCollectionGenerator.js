const SAVING_AMOUNT = 500;
const INTEREST_RATE = 1; // 1%

function getPrincipalAmount(loanAmount) {
  const amount = Number(loanAmount) || 0;

  if (amount <= 0) return 0;
  if (amount <= 30000) return 1000;
  if (amount <= 60000) return 2000;

  return 3000;
}

export function generateMonthlyCollection(members = [], loans = []) {
  return members
    .filter(
      (member) => String(member.status || "active").toLowerCase() !== "exited"
    )
    .map((member, index) => {
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

      memberLoans.forEach((loan) => {
        principal += getPrincipalAmount(loan.principalAmount);
        interest += Math.round((Number(loan.outstandingAmount || 0) * INTEREST_RATE) / 100);
      });

      const penalty = 0;

      return {
        slNo: index + 1,
        memberName: member.name,
        saving: SAVING_AMOUNT,
        principal,
        interest,
        penalty,
        total:
          SAVING_AMOUNT +
          principal +
          interest +
          penalty,
      };
    });
}