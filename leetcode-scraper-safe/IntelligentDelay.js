class IntelligentDelay {
    constructor() {
        this.baseDelay = 2000; // 2 seconds base
        this.maxDelay = 30000; // 30 seconds max
        this.jitterFactor = 0.3; // 30% randomization
        this.successStreak = 0;
        this.failureStreak = 0;
        this.recentResponseTimes = [];
        this.maxResponseTimeHistory = 10;
    }

    recordSuccess(responseTime = null) {
        this.successStreak++;
        this.failureStreak = 0;
        
        if (responseTime) {
            this.recentResponseTimes.push(responseTime);
            if (this.recentResponseTimes.length > this.maxResponseTimeHistory) {
                this.recentResponseTimes.shift();
            }
        }
    }

    recordFailure() {
        this.failureStreak++;
        this.successStreak = 0;
    }

    calculateDelay() {
        let delay = this.baseDelay;
        
        // Increase delay based on failure streak
        if (this.failureStreak > 0) {
            delay = Math.min(this.baseDelay * Math.pow(2, this.failureStreak), this.maxDelay);
        }
        
        // Decrease delay based on success streak (but keep minimum)
        if (this.successStreak > 5) {
            delay = Math.max(delay * 0.8, 1000);
        }
        
        // Adjust based on recent response times
        if (this.recentResponseTimes.length > 0) {
            const avgResponseTime = this.recentResponseTimes.reduce((a, b) => a + b, 0) / this.recentResponseTimes.length;
            if (avgResponseTime > 3000) { // If responses are slow
                delay *= 1.5;
            }
        }
        
        // Add jitter to avoid thundering herd
        const jitter = delay * this.jitterFactor * (Math.random() - 0.5);
        delay += jitter;
        
        return Math.round(Math.max(delay, 500)); // Minimum 500ms
    }

    async wait() {
        const delay = this.calculateDelay();
        console.log(`⏱ Intelligent delay: ${delay}ms (success: ${this.successStreak}, failures: ${this.failureStreak})`);
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    getStatus() {
        return {
            nextDelay: this.calculateDelay(),
            successStreak: this.successStreak,
            failureStreak: this.failureStreak,
            avgResponseTime: this.recentResponseTimes.length > 0 
                ? Math.round(this.recentResponseTimes.reduce((a, b) => a + b, 0) / this.recentResponseTimes.length)
                : null
        };
    }
}

module.exports = IntelligentDelay;
