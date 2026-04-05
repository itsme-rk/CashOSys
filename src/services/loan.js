class Loan {
    constructor(principal, rate, term) {
        this.principal = principal;
        this.rate = rate;
        this.term = term;
        this.payments = [];
        this.status = 'active';
    }

    calculateEMI() {
        const monthlyRate = this.rate / 12 / 100;
        const emi = (this.principal * monthlyRate * Math.pow(1 + monthlyRate, this.term)) / (Math.pow(1 + monthlyRate, this.term) - 1);
        return emi;
    }

    addPayment(amount) {
        if (this.status !== 'active') {
            throw new Error('Cannot add payment to a loan that is not active.');
        }
        this.payments.push(amount);
    }

    trackPayments() {
        return this.payments;
    }

    getStatus() {
        return this.status;
    }

    updateStatus(newStatus) {
        this.status = newStatus;
    }
}

module.exports = Loan;