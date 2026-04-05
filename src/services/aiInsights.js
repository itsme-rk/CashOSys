// aiInsights.js

class AIInsights {
    constructor(geminiApi) {
        this.geminiApi = geminiApi;
    }

    async generateInsights(data) {
        // Function to generate insights based on data
        try {
            const insights = await this.geminiApi.analyze(data);
            return insights;
        } catch (error) {
            console.error('Error generating insights:', error);
            throw error;
        }
    }

    async detectAnomalies(data) {
        // Function to detect anomalies in the provided data
        try {
            const anomalies = await this.geminiApi.detect(data);
            return anomalies;
        } catch (error) {
            console.error('Error detecting anomalies:', error);
            throw error;
        }
    }

    async saveSuggestions(suggestions) {
        // Function to save generated suggestions
        try {
            await this.geminiApi.save(suggestions);
        } catch (error) {
            console.error('Error saving suggestions:', error);
            throw error;
        }
    }
}

module.exports = AIInsights;