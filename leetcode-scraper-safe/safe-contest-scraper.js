const SafeCloudflareBypass = require('./SafeCloudflareBypass');
const CircuitBreaker = require('./CircuitBreaker');
const IntelligentDelay = require('./IntelligentDelay');
const SafeFileManager = require('./SafeFileManager');
const fs = require('fs');
const path = require('path');

class SafeContestScraper {
    constructor() {
        this.bypass = new SafeCloudflareBypass();
        this.circuitBreaker = new CircuitBreaker(3, 120000, 600000); // 3 failures, 2min timeout, 10min window
        this.delay = new IntelligentDelay();
        this.fileManager = new SafeFileManager(__dirname);
        
        this.contestSlug = 'weekly-contest-460';
        this.maxRetries = 3;
        this.maxPages = 50; // Conservative limit
        this.pageSize = 25;
        
        this.stats = {
            startTime: null,
            participants: 0,
            pages: 0,
            requests: 0,
            errors: 0,
            circuitBreakerTrips: 0
        };
    }

    async initialize() {
        console.log('🚀 Initializing Safe Contest Scraper...');
        console.log('📋 Configuration:');
        console.log(`   Contest: ${this.contestSlug}`);
        console.log(`   Max pages: ${this.maxPages}`);
        console.log(`   Page size: ${this.pageSize}`);
        console.log(`   Circuit breaker: ${this.circuitBreaker.threshold} failures/${this.circuitBreaker.monitorWindow/60000}min`);
        
        // Test connection first
        const connected = await this.bypass.testConnection();
        if (!connected) {
            throw new Error('Unable to establish safe connection to LeetCode');
        }
        
        console.log('✓ Safe scraper initialized successfully');
    }

    async fetchPage(page) {
        const url = `https://leetcode.com/contest/api/ranking/${this.contestSlug}/?pagination=${page}&region=global`;
        
        return await this.circuitBreaker.execute(async () => {
            const startTime = Date.now();
            
            try {
                this.stats.requests++;
                
                const response = await this.bypass.createSafeRequest(url, {
                    referer: `https://leetcode.com/contest/${this.contestSlug}/ranking/`,
                    timeout: 45000
                });
                
                const responseTime = Date.now() - startTime;
                
                if (response.status === 200 && response.data) {
                    this.delay.recordSuccess(responseTime);
                    return response.data;
                } else if (response.status === 403) {
                    throw new Error('Cloudflare challenge - circuit breaker will handle');
                } else if (response.status === 429) {
                    throw new Error('Rate limited - backing off');
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
            } catch (error) {
                this.stats.errors++;
                this.delay.recordFailure();
                throw error;
            }
        });
    }

    async scrapeContest() {
        try {
            this.stats.startTime = Date.now();
            await this.initialize();
            
            console.log('\n📊 Starting safe contest scraping...');
            
            const allParticipants = [];
            let page = 1;
            let hasMore = true;
            
            while (hasMore && page <= this.maxPages) {
                try {
                    console.log(`\n📄 Page ${page}/${this.maxPages}`);
                    console.log(`   Circuit breaker: ${this.circuitBreaker.getStatus().state}`);
                    console.log(`   Delay status: ${JSON.stringify(this.delay.getStatus())}`);
                    
                    const data = await this.fetchPage(page);
                    
                    if (data && data.submissions && Array.isArray(data.submissions)) {
                        const pageParticipants = data.submissions;
                        allParticipants.push(...pageParticipants);
                        this.stats.participants += pageParticipants.length;
                        this.stats.pages++;
                        
                        console.log(`   ✓ Fetched ${pageParticipants.length} participants (total: ${this.stats.participants})`);
                        
                        // Check if we've reached the end
                        if (pageParticipants.length < this.pageSize) {
                            hasMore = false;
                            console.log('   📋 Reached end of results');
                        }
                        
                        // Save progress every 10 pages
                        if (page % 10 === 0) {
                            await this.saveProgress(allParticipants, page);
                        }
                        
                    } else {
                        console.log('   ⚠ Invalid response structure');
                        hasMore = false;
                    }
                    
                    page++;
                    
                    // Intelligent delay between requests
                    if (hasMore) {
                        await this.delay.wait();
                    }
                    
                } catch (error) {
                    console.log(`   ✗ Page ${page} failed: ${error.message}`);
                    
                    if (error.message.includes('Circuit breaker OPEN')) {
                        this.stats.circuitBreakerTrips++;
                        console.log('   🔄 Waiting for circuit breaker to reset...');
                        
                        // Wait and then continue from same page
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        continue;
                    }
                    
                    // For other errors, retry with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, Math.min(5000 * page, 30000)));
                    continue;
                }
            }
            
            // Final save
            await this.saveFinalResults(allParticipants);
            this.printFinalStats();
            
            return allParticipants;
            
        } catch (error) {
            console.error('💥 Safe scraper failed:', error.message);
            throw error;
        }
    }

    async saveProgress(participants, currentPage) {
        const progressData = {
            timestamp: new Date().toISOString(),
            currentPage: currentPage,
            totalParticipants: participants.length,
            participants: participants
        };
        
        const success = this.fileManager.safeWrite(
            `safe-contest-460-progress-page-${currentPage}.json`,
            progressData
        );
        
        if (success) {
            console.log(`   💾 Progress saved at page ${currentPage}`);
        }
    }

    async saveFinalResults(participants) {
        const finalData = {
            contest: this.contestSlug,
            scrapedAt: new Date().toISOString(),
            totalParticipants: participants.length,
            stats: this.stats,
            participants: participants
        };
        
        const success = this.fileManager.safeWrite('safe-contest-460-all-participants.json', finalData);
        
        if (success) {
            console.log(`\n💾 Final results saved: ${participants.length} participants`);
        }
        
        return success;
    }

    printFinalStats() {
        const duration = Date.now() - this.stats.startTime;
        
        console.log('\n📈 Final Statistics:');
        console.log(`   Duration: ${Math.round(duration / 1000)}s`);
        console.log(`   Pages processed: ${this.stats.pages}`);
        console.log(`   Total requests: ${this.stats.requests}`);
        console.log(`   Errors: ${this.stats.errors}`);
        console.log(`   Circuit breaker trips: ${this.stats.circuitBreakerTrips}`);
        console.log(`   Participants found: ${this.stats.participants}`);
        console.log(`   Success rate: ${((this.stats.requests - this.stats.errors) / this.stats.requests * 100).toFixed(1)}%`);
        console.log(`   Avg requests/min: ${Math.round(this.stats.requests / (duration / 60000))}`);
    }
}

// Run if called directly
if (require.main === module) {
    const scraper = new SafeContestScraper();
    
    scraper.scrapeContest()
        .then(() => {
            console.log('\n🎉 Safe scraping completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Safe scraping failed:', error.message);
            process.exit(1);
        });
}

module.exports = SafeContestScraper;
