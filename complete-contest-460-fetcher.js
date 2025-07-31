const fs = require('fs');
const CloudflareBypass = require('./cloudflare-bypass');

class CompleteContest460Fetcher {
    constructor() {
        this.bypass = new CloudflareBypass();
        this.allParticipants = [];
        this.startPage = 1;
    }

    async loadExistingData() {
        try {
            if (fs.existsSync('./contest-460-all-participants.json')) {
                const existingData = JSON.parse(fs.readFileSync('./contest-460-all-participants.json', 'utf8'));
                this.allParticipants = existingData;
                
                // Calculate where we left off (278 pages × 25 = 6950 participants)
                this.startPage = Math.floor(existingData.length / 25) + 1;
                
                console.log(`📊 Loaded ${existingData.length} existing participants`);
                console.log(`🔄 Will resume from page ${this.startPage}`);
                return true;
            }
        } catch (error) {
            console.log(`⚠️ Could not load existing data: ${error.message}`);
        }
        return false;
    }

    async fetchAllRemainingParticipants() {
        console.log(`🚀 FETCHING ALL REMAINING CONTEST 460 PARTICIPANTS`);
        console.log(`🎯 Target: ~20,000 total participants`);
        
        const baseEndpoint = 'https://leetcode.com/contest/api/ranking/weekly-contest-460/';
        let consecutiveFailures = 0;
        let page = this.startPage;
        let hasMoreData = true;
        
        while (hasMoreData && consecutiveFailures < 10) {
            const pageUrl = `${baseEndpoint}?pagination=${page}&region=global`;
            
            console.log(`📄 Fetching page ${page} (Total so far: ${this.allParticipants.length})...`);
            
            try {
                const response = await this.bypass.bypassCloudflare(pageUrl);
                
                if (response && response.status === 200 && response.data) {
                    let pageParticipants = [];
                    
                    // Extract participants from different possible response formats
                    if (response.data.total_rank && Array.isArray(response.data.total_rank)) {
                        pageParticipants = response.data.total_rank;
                    } else if (response.data.submissions && Array.isArray(response.data.submissions)) {
                        pageParticipants = response.data.submissions;
                    } else if (Array.isArray(response.data)) {
                        pageParticipants = response.data;
                    }
                    
                    if (pageParticipants.length > 0) {
                        console.log(`✅ Got ${pageParticipants.length} participants from page ${page}`);
                        this.allParticipants.push(...pageParticipants);
                        consecutiveFailures = 0;
                        
                        // Save progress every 10 pages
                        if (page % 10 === 0) {
                            await this.saveProgress();
                            console.log(`💾 Saved progress: ${this.allParticipants.length} participants`);
                        }
                        
                        // Check if we've reached the end (fewer than 25 participants)
                        if (pageParticipants.length < 25) {
                            console.log(`📋 Reached end of data at page ${page}`);
                            hasMoreData = false;
                        }
                    } else {
                        console.log(`⚠️ No participants found on page ${page}`);
                        consecutiveFailures++;
                    }
                } else {
                    console.log(`❌ Failed to get data from page ${page}`);
                    consecutiveFailures++;
                }
            } catch (error) {
                console.log(`❌ Error on page ${page}: ${error.message}`);
                consecutiveFailures++;
                
                // Wait longer on network errors
                if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
                    console.log(`🕐 Waiting 5 seconds before retry...`);
                    await this.delay(5000);
                }
            }
            
            page++;
            await this.delay(300); // Delay between requests
        }
        
        // Final save
        await this.saveProgress();
        
        console.log(`\n🎯 FINAL FETCH RESULTS:`);
        console.log(`   Total participants collected: ${this.allParticipants.length}`);
        console.log(`   Last page attempted: ${page - 1}`);
        console.log(`   Target was ~20,000 participants`);
        
        return this.allParticipants;
    }

    async saveProgress() {
        try {
            fs.writeFileSync('./contest-460-all-participants.json', JSON.stringify(this.allParticipants, null, 2));
            return true;
        } catch (error) {
            console.log(`❌ Error saving progress: ${error.message}`);
            return false;
        }
    }

    async searchForUsers() {
        // Load target users
        const targetUsers = JSON.parse(fs.readFileSync('./users.json', 'utf8'));
        console.log(`\n🔍 COMPREHENSIVE USER SEARCH`);
        console.log(`📋 Searching for ${targetUsers.length} users in ${this.allParticipants.length} participants...`);
        
        // Create comprehensive search maps
        const participantData = new Map();
        
        this.allParticipants.forEach((participant, index) => {
            // Add all possible identifiers
            const identifiers = [
                participant.username,
                participant.user_slug,
                participant.username?.toLowerCase(),
                participant.user_slug?.toLowerCase(),
            ].filter(Boolean);
            
            identifiers.forEach(id => {
                participantData.set(id, participant);
            });
            
            if ((index + 1) % 2000 === 0) {
                console.log(`🔄 Indexed ${index + 1}/${this.allParticipants.length} participants...`);
            }
        });
        
        console.log(`🗂️ Total searchable identifiers: ${participantData.size}`);
        
        // Search for each target user with multiple variations
        const foundUsers = [];
        const notFoundUsers = [];
        
        targetUsers.forEach(targetUser => {
            const leetcodeId = targetUser.leetcode_id.trim();
            
            // Generate all possible variations
            const variations = [
                leetcodeId,                                     // exact
                leetcodeId.toLowerCase(),                       // lowercase
                leetcodeId.toUpperCase(),                       // uppercase
                leetcodeId.replace(/\s+/g, ''),                 // remove spaces
                leetcodeId.toLowerCase().replace(/\s+/g, ''),   // lowercase no spaces
                leetcodeId.replace(/\s+/g, '_'),                // spaces to underscores
                leetcodeId.toLowerCase().replace(/\s+/g, '_'),  // lowercase spaces to underscores
                leetcodeId.replace(/\s+/g, '-'),                // spaces to hyphens
                leetcodeId.toLowerCase().replace(/\s+/g, '-'),  // lowercase spaces to hyphens
                leetcodeId.replace(/[^a-zA-Z0-9]/g, ''),        // alphanumeric only
                leetcodeId.toLowerCase().replace(/[^a-zA-Z0-9]/g, ''), // lowercase alphanumeric only
            ];
            
            let found = false;
            let participant = null;
            let matchedVariation = null;
            
            for (const variation of variations) {
                if (participantData.has(variation)) {
                    participant = participantData.get(variation);
                    matchedVariation = variation;
                    found = true;
                    break;
                }
            }
            
            if (found) {
                foundUsers.push({
                    leetcode_id: participant.username || participant.user_slug,
                    display_name: targetUser.display_name,
                    rank: participant.rank,
                    score: participant.score,
                    finish_time: participant.finish_time,
                    matched_variation: matchedVariation,
                    original_leetcode_id: leetcodeId,
                    contest_data: participant
                });
                
                console.log(`✅ FOUND: ${targetUser.display_name}`);
                console.log(`   Original: "${leetcodeId}" → Matched: "${participant.username || participant.user_slug}"`);
                console.log(`   Rank: ${participant.rank}, Score: ${participant.score}`);
            } else {
                notFoundUsers.push({
                    leetcode_id: leetcodeId,
                    display_name: targetUser.display_name
                });
                console.log(`❌ NOT FOUND: ${targetUser.display_name} (${leetcodeId})`);
            }
        });
        
        // Save results
        const foundFile = './contest-460-final-found-users.json';
        const notFoundFile = './contest-460-final-not-found-users.json';
        
        fs.writeFileSync(foundFile, JSON.stringify(foundUsers, null, 2));
        fs.writeFileSync(notFoundFile, JSON.stringify(notFoundUsers, null, 2));
        
        console.log(`\n🏆 FINAL COMPREHENSIVE RESULTS:`);
        console.log(`   Total participants: ${this.allParticipants.length}`);
        console.log(`   Target users: ${targetUsers.length}`);
        console.log(`   Users found: ${foundUsers.length}`);
        console.log(`   Users not found: ${notFoundUsers.length}`);
        console.log(`   Success rate: ${((foundUsers.length / targetUsers.length) * 100).toFixed(1)}%`);
        
        if (foundUsers.length > 0) {
            console.log(`\n🥇 YOUR USERS IN CONTEST 460 (sorted by rank):`);
            foundUsers
                .sort((a, b) => a.rank - b.rank)
                .forEach((user, index) => {
                    console.log(`   ${index + 1}. ${user.display_name} (${user.leetcode_id})`);
                    console.log(`      Rank: ${user.rank}, Score: ${user.score}`);
                    console.log(`      Original: "${user.original_leetcode_id}" → Matched: "${user.matched_variation}"`);
                });
        }
        
        return { foundUsers, notFoundUsers };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const fetcher = new CompleteContest460Fetcher();
    
    // Load existing data if available
    await fetcher.loadExistingData();
    
    // Fetch remaining participants
    await fetcher.fetchAllRemainingParticipants();
    
    // Search for users
    await fetcher.searchForUsers();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = CompleteContest460Fetcher;
