const SafeContestScraper = require('./safe-contest-scraper');
const SafeFileManager = require('./SafeFileManager');
const fs = require('fs');
const path = require('path');

class SafeUserMatcher {
    constructor() {
        this.fileManager = new SafeFileManager(__dirname);
        this.stats = {
            targetUsers: 0,
            found: 0,
            notFound: 0,
            matchTypes: {}
        };
    }

    async loadTargetUsers() {
        // Try to load from parent directory first
        const parentUsersPath = path.join(__dirname, '..', 'users.json');
        
        if (fs.existsSync(parentUsersPath)) {
            console.log('📋 Loading target users from parent directory...');
            const data = JSON.parse(fs.readFileSync(parentUsersPath, 'utf8'));
            return data;
        }
        
        throw new Error('users.json not found in parent directory');
    }

    normalizeUsername(username) {
        if (!username) return '';
        return username.toLowerCase().trim();
    }

    generateVariations(username) {
        const variations = new Set();
        const normalized = this.normalizeUsername(username);
        
        variations.add(normalized);
        variations.add(username); // Original case
        
        // Common variations
        variations.add(normalized.replace(/[._-]/g, ''));
        variations.add(normalized.replace(/[._-]/g, '_'));
        variations.add(normalized.replace(/[._-]/g, '-'));
        variations.add(normalized.replace(/[._-]/g, '.'));
        
        // Number variations
        if (/\d/.test(normalized)) {
            variations.add(normalized.replace(/\d+/g, ''));
        }
        
        return Array.from(variations).filter(v => v.length > 0);
    }

    findUserMatch(targetUser, participants) {
        const leetcodeId = this.normalizeUsername(targetUser.leetcode_id);
        const displayName = this.normalizeUsername(targetUser.display_name);
        
        // Generate all possible variations
        const variations = new Set([
            ...this.generateVariations(leetcodeId),
            ...this.generateVariations(displayName)
        ]);
        
        for (const participant of participants) {
            const participantUsername = this.normalizeUsername(participant.username);
            const participantRealName = this.normalizeUsername(participant.real_name || '');
            
            // Direct exact matches (highest priority)
            if (variations.has(participantUsername)) {
                return { participant, matchType: 'username_exact', variation: participantUsername };
            }
            
            if (participantRealName && variations.has(participantRealName)) {
                return { participant, matchType: 'realname_exact', variation: participantRealName };
            }
        }
        
        // Partial matches only if no exact match found and variation is significant
        for (const participant of participants) {
            const participantUsername = this.normalizeUsername(participant.username);
            const participantRealName = this.normalizeUsername(participant.real_name || '');
            
            // Check for significant partial matches (length >= 5 and high similarity)
            for (const variation of variations) {
                if (variation.length >= 5) {
                    // Exact substring match for usernames
                    if (participantUsername === variation || variation === participantUsername) {
                        return { participant, matchType: 'username_exact', variation };
                    }
                    
                    // Strong partial match for usernames (one contains the other and length > 6)
                    if (variation.length >= 6 && (
                        (participantUsername.includes(variation) && variation.length >= participantUsername.length * 0.8) ||
                        (variation.includes(participantUsername) && participantUsername.length >= variation.length * 0.8)
                    )) {
                        return { participant, matchType: 'username_partial', variation };
                    }
                }
                
                // Only check real names if they exist and are significant
                if (participantRealName && participantRealName.length >= 3 && variation.length >= 4) {
                    if (participantRealName === variation || variation === participantRealName) {
                        return { participant, matchType: 'realname_exact', variation };
                    }
                }
            }
        }
        
        return null;
    }

    async matchUsers() {
        try {
            console.log('🔍 Starting safe user matching...');
            
            // Load target users
            const targetUsers = await this.loadTargetUsers();
            console.log(`📋 Loaded ${targetUsers.length} target users`);
            this.stats.targetUsers = targetUsers.length;
            
            // Load contest participants
            const contestData = this.fileManager.safeRead('safe-contest-460-all-participants.json');
            if (!contestData) {
                throw new Error('Contest data not found. Run safe scraper first.');
            }
            
            // Handle both formats - array directly or object with participants property
            let participants;
            if (Array.isArray(contestData)) {
                participants = contestData;
            } else if (contestData.participants && Array.isArray(contestData.participants)) {
                participants = contestData.participants;
            } else {
                throw new Error('Invalid contest data format');
            }
            
            console.log(`👥 Loaded ${participants.length} contest participants`);
            
            const foundUsers = [];
            const notFoundUsers = [];
            
            console.log('\n🔎 Matching users...');
            
            for (const targetUser of targetUsers) {
                const match = this.findUserMatch(targetUser, participants);
                
                if (match) {
                    const enhancedUser = {
                        ...targetUser,
                        contest_data: match.participant,
                        match_info: {
                            type: match.matchType,
                            variation: match.variation,
                            confidence: this.calculateConfidence(match.matchType)
                        }
                    };
                    
                    foundUsers.push(enhancedUser);
                    this.stats.found++;
                    
                    // Track match types
                    this.stats.matchTypes[match.matchType] = (this.stats.matchTypes[match.matchType] || 0) + 1;
                    
                    console.log(`  ✓ ${targetUser.leetcode_id} → ${match.participant.username} (${match.matchType})`);
                } else {
                    notFoundUsers.push(targetUser);
                    this.stats.notFound++;
                    console.log(`  ✗ ${targetUser.leetcode_id} - not found`);
                }
            }
            
            // Save results
            await this.saveResults(foundUsers, notFoundUsers);
            this.printResults();
            
            return { foundUsers, notFoundUsers };
            
        } catch (error) {
            console.error('💥 User matching failed:', error.message);
            throw error;
        }
    }

    calculateConfidence(matchType) {
        switch (matchType) {
            case 'username_exact': return 0.95;
            case 'realname_exact': return 0.90;
            case 'username_partial': return 0.75;
            case 'realname_partial': return 0.70;
            default: return 0.50;
        }
    }

    async saveResults(foundUsers, notFoundUsers) {
        const foundSuccess = this.fileManager.safeWrite('safe-contest-460-found-users.json', {
            contest: 'weekly-contest-460',
            matchedAt: new Date().toISOString(),
            totalFound: foundUsers.length,
            users: foundUsers
        });
        
        const notFoundSuccess = this.fileManager.safeWrite('safe-contest-460-not-found-users.json', {
            contest: 'weekly-contest-460',
            matchedAt: new Date().toISOString(),
            totalNotFound: notFoundUsers.length,
            users: notFoundUsers
        });
        
        if (foundSuccess && notFoundSuccess) {
            console.log('\n💾 Match results saved successfully');
        }
    }

    printResults() {
        console.log('\n📊 User Matching Results:');
        console.log(`   Target users: ${this.stats.targetUsers}`);
        console.log(`   Found: ${this.stats.found} (${(this.stats.found/this.stats.targetUsers*100).toFixed(1)}%)`);
        console.log(`   Not found: ${this.stats.notFound} (${(this.stats.notFound/this.stats.targetUsers*100).toFixed(1)}%)`);
        
        console.log('\n📈 Match Type Breakdown:');
        for (const [type, count] of Object.entries(this.stats.matchTypes)) {
            console.log(`   ${type}: ${count}`);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const matcher = new SafeUserMatcher();
    
    matcher.matchUsers()
        .then(() => {
            console.log('\n🎉 Safe user matching completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Safe user matching failed:', error.message);
            process.exit(1);
        });
}

module.exports = SafeUserMatcher;
