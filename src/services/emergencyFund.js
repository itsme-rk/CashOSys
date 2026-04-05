class EmergencyFund {
    constructor(initialBalance) {
        this.balance = initialBalance;
        this.transactions = [];
    }

    addFunds(amount) {
        this.balance += amount;
        this.transactions.push({ type: 'deposit', amount, date: new Date() });
    }

    withdrawFunds(amount) {
        if (amount > this.balance) {
            console.error('Insufficient balance');
            return;
        }
        this.balance -= amount;
        this.transactions.push({ type: 'withdrawal', amount, date: new Date() });
    }

    calculateSurvivalMonths(monthlyExpense) {
        if (monthlyExpense <= 0) {
            throw new Error("Monthly expense must be greater than zero.");
        }
        return this.balance / monthlyExpense;
    }

    getBalance() {
        return this.balance;
    }

    getTransactions() {
        return this.transactions;
    }
}

module.exports = EmergencyFund;
