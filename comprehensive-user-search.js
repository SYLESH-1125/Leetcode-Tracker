const fs = require('fs');

// Load the users we're looking for
const targetUsers = JSON.parse(fs.readFileSync('./users.json', 'utf8'));

console.log(`🎯 COMPREHENSIVE SEARCH IN CONTEST 460 DATA`);
console.log(`📋 Looking for ${targetUsers.length} users...`);

// Load all contest participants
const allParticipants = JSON.parse(fs.readFileSync('./contest-460-all-participants.json', 'utf8'));
console.log(`📊 Total participants in contest: ${allParticipants.length}`);

// Create comprehensive search sets - check both username and user_slug
const participantData = new Map();
const usernameSet = new Set();
const userSlugSet = new Set();

allParticipants.forEach((participant, index) => {
    if (participant.username) {
        const username = participant.username.toLowerCase().trim();
        usernameSet.add(username);
        participantData.set(username, participant);
    }
    
    if (participant.user_slug) {
        const userSlug = participant.user_slug.toLowerCase().trim();
        userSlugSet.add(userSlug);
        participantData.set(userSlug, participant);
    }
    
    // Show progress every 1000 participants
    if ((index + 1) % 1000 === 0) {
        console.log(`🔄 Processed ${index + 1}/${allParticipants.length} participants...`);
    }
});

console.log(`🔍 Unique usernames: ${usernameSet.size}`);
console.log(`🔍 Unique user_slugs: ${userSlugSet.size}`);
console.log(`🔍 Total unique identifiers: ${participantData.size}`);

// Find matches - check multiple variations
const foundUsers = [];
const notFoundUsers = [];

targetUsers.forEach(targetUser => {
    const leetcodeId = targetUser.leetcode_id.trim();
    const variations = [
        leetcodeId.toLowerCase(),                    // exact lowercase
        leetcodeId,                                 // exact case
        leetcodeId.toLowerCase().replace(/\s+/g, ''), // remove spaces
        leetcodeId.replace(/\s+/g, ''),             // remove spaces (keep case)
        leetcodeId.toLowerCase().replace(/\s+/g, '_'), // spaces to underscores
        leetcodeId.replace(/\s+/g, '_'),            // spaces to underscores (keep case)
        leetcodeId.toLowerCase().replace(/\s+/g, '-'), // spaces to hyphens
        leetcodeId.replace(/\s+/g, '-'),            // spaces to hyphens (keep case)
    ];
    
    let found = false;
    let participant = null;
    let matchedVariation = null;
    
    // Try each variation
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
        console.log(`   LeetCode ID: ${leetcodeId} → Matched: ${participant.username || participant.user_slug}`);
        console.log(`   Variation used: "${matchedVariation}"`);
        console.log(`   Rank: ${participant.rank}, Score: ${participant.score}`);
        console.log(`   Finish Time: ${new Date(participant.finish_time * 1000).toISOString()}`);
        console.log('');
    } else {
        notFoundUsers.push({
            leetcode_id: leetcodeId,
            display_name: targetUser.display_name,
            variations_tried: variations
        });
        console.log(`❌ NOT FOUND: ${targetUser.display_name} (${leetcodeId})`);
    }
});

// Save comprehensive results
const foundFile = './contest-460-comprehensive-found.json';
const notFoundFile = './contest-460-comprehensive-not-found.json';

fs.writeFileSync(foundFile, JSON.stringify(foundUsers, null, 2));
fs.writeFileSync(notFoundFile, JSON.stringify(notFoundUsers, null, 2));

console.log(`\n📊 COMPREHENSIVE SEARCH RESULTS:`);
console.log(`   Total participants in Contest 460: ${allParticipants.length}`);
console.log(`   Total target users: ${targetUsers.length}`);
console.log(`   Users found: ${foundUsers.length}`);
console.log(`   Users not found: ${notFoundUsers.length}`);
console.log(`   Success rate: ${((foundUsers.length / targetUsers.length) * 100).toFixed(1)}%`);
console.log(`   Found users saved to: ${foundFile}`);
console.log(`   Not found users saved to: ${notFoundFile}`);

if (foundUsers.length > 0) {
    console.log(`\n🏆 CONTEST 460 PARTICIPANTS FROM YOUR LIST:`);
    foundUsers
        .sort((a, b) => a.rank - b.rank)  // Sort by rank
        .forEach((user, index) => {
            console.log(`   ${index + 1}. ${user.display_name} (${user.leetcode_id})`);
            console.log(`      Rank: ${user.rank}, Score: ${user.score}`);
            console.log(`      Original ID: "${user.original_leetcode_id}" → Matched: "${user.matched_variation}"`);
        });
}

// Show some statistics about the contest
const scores = allParticipants.map(p => p.score).filter(s => s > 0);
const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
const maxScore = Math.max(...scores);
const minScore = Math.min(...scores.filter(s => s > 0));

console.log(`\n📈 CONTEST 460 STATISTICS:`);
console.log(`   Total participants: ${allParticipants.length}`);
console.log(`   Participants with score > 0: ${scores.length}`);
console.log(`   Average score: ${avgScore.toFixed(2)}`);
console.log(`   Highest score: ${maxScore}`);
console.log(`   Lowest score (>0): ${minScore}`);

// Show sample usernames to help identify patterns
console.log(`\n🔍 Sample participant identifiers (username vs user_slug):`);
allParticipants.slice(0, 10).forEach((p, index) => {
    console.log(`   ${index + 1}. username: "${p.username}" | user_slug: "${p.user_slug}"`);
});
