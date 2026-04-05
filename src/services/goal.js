class GoalManagementService {
    constructor() {
        this.goals = [];
    }

    createGoal(name, targetAmount, dueDate) {
        const goal = {
            id: this.goals.length + 1,
            name,
            targetAmount,
            currentAmount: 0,
            dueDate,
            creationDate: new Date(),
        };
        this.goals.push(goal);
        return goal;
    }

    trackProgress(goalId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) {
            throw new Error('Goal not found');
        }
        return {
            name: goal.name,
            currentAmount: goal.currentAmount,
            targetAmount: goal.targetAmount,
            completionPercentage: this.calculateCompletionPercentage(goal)
        };
    }

    updateSavings(goalId, amount) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) {
            throw new Error('Goal not found');
        }
        goal.currentAmount += amount;
        return goal;
    }

    calculateCompletionPercentage(goal) {
        return (goal.currentAmount / goal.targetAmount) * 100;
    }
}

// Example usage:
const goalService = new GoalManagementService();
const newGoal = goalService.createGoal('New Car', 20000, '2026-12-31');
goalService.updateSavings(newGoal.id, 1500);
console.log(goalService.trackProgress(newGoal.id));
