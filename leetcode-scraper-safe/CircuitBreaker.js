class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000, monitorWindow = 300000) {
        this.threshold = threshold; // failures before opening
        this.timeout = timeout; // ms to wait before trying again
        this.monitorWindow = monitorWindow; // 5 minute sliding window
        this.failures = [];
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.nextAttempt = 0;
        this.successCount = 0;
    }

    async execute(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error(`Circuit breaker OPEN. Next attempt in ${Math.ceil((this.nextAttempt - Date.now()) / 1000)}s`);
            }
            this.state = 'HALF_OPEN';
            this.successCount = 0;
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.successCount++;
        
        if (this.state === 'HALF_OPEN' && this.successCount >= 3) {
            this.state = 'CLOSED';
            this.failures = [];
            console.log('✓ Circuit breaker CLOSED - Service recovered');
        }
    }

    onFailure() {
        const now = Date.now();
        this.failures.push(now);
        
        // Remove old failures outside the monitor window
        this.failures = this.failures.filter(time => now - time < this.monitorWindow);
        
        if (this.failures.length >= this.threshold) {
            this.state = 'OPEN';
            this.nextAttempt = now + this.timeout;
            console.log(`⚠ Circuit breaker OPEN - ${this.failures.length} failures in ${this.monitorWindow/60000} minutes`);
            console.log(`   Next attempt at: ${new Date(this.nextAttempt).toLocaleTimeString()}`);
        }
    }

    getStatus() {
        return {
            state: this.state,
            failures: this.failures.length,
            nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toLocaleTimeString() : null
        };
    }
}

module.exports = CircuitBreaker;
