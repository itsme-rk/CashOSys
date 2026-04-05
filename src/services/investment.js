class InvestmentService {
    constructor() {
        this.investments = [];
    }

    // Add an investment
    addInvestment(investment) {
        this.investments.push(investment);
    }

    // Get all investments
    getInvestments() {
        return this.investments;
    }

    // Update an investment
    updateInvestment(id, updatedInvestment) {
        const index = this.investments.findIndex(inv => inv.id === id);
        if (index !== -1) {
            this.investments[index] = { ...this.investments[index], ...updatedInvestment };
        } else {
            throw new Error('Investment not found');
        }
    }

    // Calculate gains/losses
    calculateGainsLosses(investment) {
        const { purchasePrice, currentPrice, numberOfShares } = investment;
        const totalInvestment = purchasePrice * numberOfShares;
        const currentValue = currentPrice * numberOfShares;
        return currentValue - totalInvestment;
    }
}

module.exports = new InvestmentService();