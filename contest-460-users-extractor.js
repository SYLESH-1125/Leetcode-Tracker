const fs = require('fs');
const CloudflareBypass = require('./cloudflare-bypass');

class Contest460UserDataExtractor {
    constructor() {
        this.bypass = new CloudflareBypass();
        this.users = this.loadUsers();
        this.contest460Data = null;
    }

    loadUsers() {
        try {
            const usersData = fs.readFileSync('./users.json', 'utf8');
            const users = JSON.parse(usersData);
            console.log(`📋 Loaded ${users.length} users from users.json`);
            return users.map(user => user.leetcode_id.trim());
        } catch (error) {
            console.error('❌ Error loading users.json:', error.message);
            return [];
        }
    }

    async fetchContest460RankingData() {
        console.log('🚀 Fetching ALL Contest 460 participants with usernames...');
        
        let allParticipants = [];
        
        // Try ranking API endpoint - this gives user data, not submission data
        const rankingEndpoints = [
            'https://leetcode.com/contest/api/ranking/weekly-contest-460/',
        ];

        for (const baseEndpoint of rankingEndpoints) {
            try {
                console.log(`🔍 Trying ranking API endpoint: ${baseEndpoint}`);
                
                // Fetch ALL pages until we get all participants (no limit!)
                let page = 1;
                let hasMoreData = true;
                
                while (hasMoreData) { // NO PAGE LIMIT - fetch until we get everyone!
                    const pageUrl = `${baseEndpoint}?pagination=${page}&region=global`;
                    
                    console.log(`📄 Fetching ranking page ${page}...`);
                    
                    const response = await this.bypass.bypassCloudflare(pageUrl);
                    
                    if (response && response.status === 200 && response.data) {
                        // Look for ranking data (not submission data)
                        if (response.data.total_rank && Array.isArray(response.data.total_rank)) {
                            const pageParticipants = response.data.total_rank;
                            console.log(`✅ Found ${pageParticipants.length} participants on page ${page}`);
                            allParticipants.push(...pageParticipants);
                            
                            // Check if we have more data (if less than 25, we've reached the end)
                            if (pageParticipants.length < 25) {
                                hasMoreData = false;
                                console.log(`📋 Reached end of data at page ${page} - Total participants: ${allParticipants.length}`);
                            }
                        } else if (response.data.submissions && Array.isArray(response.data.submissions)) {
                            // Fallback to submissions if total_rank not available
                            const pageParticipants = response.data.submissions;
                            console.log(`✅ Found ${pageParticipants.length} submissions on page ${page}`);
                            allParticipants.push(...pageParticipants);
                            
                            if (pageParticipants.length < 25) {
                                hasMoreData = false;
                                console.log(`📋 Reached end of submissions at page ${page} - Total participants: ${allParticipants.length}`);
                            }
                        } else {
                            console.log(`⚠️ No ranking/submission data found on page ${page}`);
                            hasMoreData = false;
                        }
                    } else {
                        console.log(`❌ No response from page ${page}`);
                        hasMoreData = false;
                    }
                    
                    page++;
                    
                    // Progress update every 50 pages
                    if (page % 50 === 0) {
                        console.log(`🔄 Progress: Fetched ${page} pages, ${allParticipants.length} participants so far...`);
                    }
                    
                    await this.delay(150); // Reduced delay for faster fetching
                }
                
                if (allParticipants.length > 0) {
                    console.log(`✅ Total participants collected from ranking API: ${allParticipants.length}`);
                    return allParticipants;
                }
                
            } catch (error) {
                console.log(`❌ Ranking API endpoint ${baseEndpoint} failed: ${error.message}`);
            }
        }

        // If API failed, try HTML scraping
        console.log('🔍 Trying HTML ranking pages...');
        const htmlEndpoint = 'https://leetcode.com/contest/weekly-contest-460/ranking/';
        
        try {
            for (let page = 1; page <= 100; page++) { // Try more pages
                const pageUrl = `${htmlEndpoint}${page}/`;
                
                console.log(`📄 Fetching HTML page ${page}: ${pageUrl}`);
                
                const response = await this.bypass.bypassCloudflare(pageUrl);
                
                if (response && response.status === 200) {
                    console.log(`✅ Got HTML data from page ${page}`);
                    
                    // Try to extract ranking data from response
                    const pageParticipants = this.extractRankingData(response.data, htmlEndpoint);
                    if (pageParticipants && pageParticipants.length > 0) {
                        console.log(`📊 Found ${pageParticipants.length} participants on HTML page ${page}`);
                        allParticipants.push(...pageParticipants);
                    } else {
                        console.log(`⚠️ No participants found on HTML page ${page}`);
                        break;
                    }
                }
                
                // Small delay between pages
                await this.delay(300);
            }
        } catch (error) {
            console.log(`❌ HTML scraping failed: ${error.message}`);
        }

        return allParticipants.length > 0 ? allParticipants : null;
    }

    extractRankingData(data, endpoint) {
        try {
            // If it's HTML, try to extract data from it
            if (typeof data === 'string') {
                return this.extractFromHTML(data);
            }
            
            // If it's JSON API response
            if (data && typeof data === 'object') {
                if (data.submissions) {
                    return data.submissions;
                }
                if (data.ranking) {
                    return data.ranking;
                }
                if (Array.isArray(data)) {
                    return data;
                }
            }
            
            return null;
        } catch (error) {
            console.log(`Parse error: ${error.message}`);
            return null;
        }
    }

    extractFromHTML(html) {
        try {
            // Look for various patterns that contain ranking data
            const patterns = [
                /var\s+initialData\s*=\s*({.*?});/s,
                /window\.__INITIAL_STATE__\s*=\s*({.*?});/s,
                /var\s+ranking\s*=\s*(\[.*?\]);/s,
                /window\.ranking\s*=\s*(\[.*?\]);/s,
                /"submissions":\s*(\[.*?\])/s,
                /"ranking":\s*(\[.*?\])/s,
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    try {
                        const data = JSON.parse(match[1]);
                        if (Array.isArray(data) && data.length > 0) {
                            console.log(`✅ Extracted ${data.length} entries from HTML`);
                            return data;
                        }
                        if (data.submissions && Array.isArray(data.submissions)) {
                            console.log(`✅ Extracted ${data.submissions.length} submissions from HTML`);
                            return data.submissions;
                        }
                        if (data.ranking && Array.isArray(data.ranking)) {
                            console.log(`✅ Extracted ${data.ranking.length} rankings from HTML`);
                            return data.ranking;
                        }
                    } catch (parseError) {
                        console.log(`Parse error for pattern: ${parseError.message}`);
                    }
                }
            }

            // Look for table rows with user data
            const tableRowPattern = /<tr[^>]*>.*?<\/tr>/gs;
            const tableRows = html.match(tableRowPattern) || [];
            
            if (tableRows.length > 0) {
                console.log(`🔍 Found ${tableRows.length} table rows, parsing...`);
                return this.parseTableRows(tableRows);
            }

            return null;
        } catch (error) {
            console.log(`HTML extraction error: ${error.message}`);
            return null;
        }
    }

    parseTableRows(tableRows) {
        const participants = [];
        
        for (const row of tableRows) {
            try {
                // Extract username from various possible patterns
                const usernamePatterns = [
                    /\/u\/([^\/\s"'<>]+)/g,
                    /data-username="([^"]+)"/g,
                    /user[_-]?name["']?\s*:\s*["']([^"']+)["']/g,
                ];

                let username = null;
                for (const pattern of usernamePatterns) {
                    const match = row.match(pattern);
                    if (match) {
                        username = match[1];
                        break;
                    }
                }

                if (username) {
                    participants.push({
                        username: username,
                        rank: participants.length + 1,
                        raw_html: row.substring(0, 200) // Keep first 200 chars for debugging
                    });
                }
            } catch (error) {
                console.log(`Error parsing table row: ${error.message}`);
            }
        }

        return participants;
    }

    filterUsersData(rankingData) {
        if (!rankingData || rankingData.length === 0) {
            console.log('⚠️ No ranking data to filter');
            return [];
        }

        console.log(`🔍 Filtering ${rankingData.length} participants for ${this.users.length} target users...`);
        console.log(`📋 Target users: ${this.users.slice(0, 5).join(', ')}${this.users.length > 5 ? '...' : ''}`);
        
        const foundUsers = [];
        const userSet = new Set(this.users.map(u => u.toLowerCase())); // Case insensitive matching
        
        // Debug: Show sample participant data structure
        console.log(`🔍 Sample participant data:`, JSON.stringify(rankingData.slice(0, 2), null, 2));

        for (let i = 0; i < rankingData.length; i++) {
            const participant = rankingData[i];
            
            // Handle different data structures
            let username = null;
            let userSlug = null;
            let rank = null;
            let score = null;
            let finishTime = null;
            
            if (participant) {
                // Check if this is ranking data (has username/user_slug)
                if (participant.username) {
                    username = participant.username;
                } else if (participant.user_slug) {
                    username = participant.user_slug;
                } else if (participant.user) {
                    username = participant.user;
                } else if (participant.handle) {
                    username = participant.handle;
                }
                
                // Extract other data
                rank = participant.rank || participant.ranking || (i + 1);
                score = participant.score || participant.total_score;
                finishTime = participant.finish_time || participant.finishTime;
                
                // If we found a username, check if it's in our target list
                if (username && userSet.has(username.toLowerCase())) {
                    foundUsers.push({
                        leetcode_id: username,
                        display_name: this.getUserDisplayName(username),
                        contest_data: participant,
                        rank: rank,
                        score: score,
                        finish_time: finishTime,
                    });
                    console.log(`✅ Found user: ${username} (rank ${rank}, score: ${score})`);
                }
                
                // Debug: Show first 10 usernames we're checking
                if (i < 10 && username) {
                    console.log(`🔍 Participant ${i + 1}: ${username} (rank ${rank})`);
                } else if (i < 10) {
                    console.log(`🔍 Participant ${i + 1}: No username found in`, Object.keys(participant).slice(0, 5));
                }
            }
        }

        console.log(`📊 Summary: Found ${foundUsers.length} users out of ${this.users.length} target users`);
        return foundUsers;
    }

    getUserDisplayName(leetcodeId) {
        const usersData = JSON.parse(fs.readFileSync('./users.json', 'utf8'));
        const user = usersData.find(u => u.leetcode_id.trim() === leetcodeId);
        return user ? user.display_name : leetcodeId;
    }

    async extractUsersContest460Data() {
        console.log('🎯 EXTRACTING ALL CONTEST 460 PARTICIPANTS FIRST');
        console.log('=' * 50);

        // Fetch ALL contest participants
        const rankingData = await this.fetchContest460RankingData();
        
        if (!rankingData) {
            console.log('❌ Could not fetch Contest 460 ranking data');
            return [];
        }

        // Save ALL participants data for reference
        const allParticipantsFile = './contest-460-all-participants.json';
        fs.writeFileSync(allParticipantsFile, JSON.stringify(rankingData, null, 2));
        console.log(`💾 Saved all participants to: ${allParticipantsFile}`);

        // Filter for your specific users
        const usersContest460Data = this.filterUsersData(rankingData);

        // Save the filtered data
        const outputFile = './contest-460-users-data.json';
        fs.writeFileSync(outputFile, JSON.stringify(usersContest460Data, null, 2));

        console.log(`\n📊 RESULTS:`);
        console.log(`   Total participants in Contest 460: ${rankingData.length}`);
        console.log(`   Total users in users.json: ${this.users.length}`);
        console.log(`   Users found in Contest 460: ${usersContest460Data.length}`);
        console.log(`   All participants saved to: ${allParticipantsFile}`);
        console.log(`   Filtered users saved to: ${outputFile}`);

        if (usersContest460Data.length > 0) {
            console.log(`\n🏆 FOUND USERS IN CONTEST 460:`);
            usersContest460Data.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.display_name} (${user.leetcode_id}) - Rank: ${user.rank || 'N/A'}, Score: ${user.score || 'N/A'}`);
            });
        } else {
            console.log(`\n⚠️ No users from your list participated in Contest 460`);
            console.log(`💡 Check ${allParticipantsFile} to see all participants and verify usernames`);
        }

        return usersContest460Data;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the extractor
async function main() {
    const extractor = new Contest460UserDataExtractor();
    await extractor.extractUsersContest460Data();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = Contest460UserDataExtractor;
