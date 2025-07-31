const fs = require('fs');

// Load the users we're looking for
const targetUsers = JSON.parse(fs.readFileSync('./users.json', 'utf8'));
const targetUsernames = targetUsers.map(user => user.leetcode_id.trim().toLowerCase());

console.log(`🎯 Looking for ${targetUsers.length} users in Contest 460 data...`);
console.log(`📋 Target users: ${targetUsernames.slice(0, 10).join(', ')}...`);

// Load all contest participants
const allParticipants = JSON.parse(fs.readFileSync('./contest-460-all-participants.json', 'utf8'));
console.log(`📊 Total participants in contest: ${allParticipants.length}`);

// Create a set of all participant usernames for quick lookup
const participantUsernames = new Set();
const participantMap = new Map();

allParticipants.forEach(participant => {
    const username = participant.username.toLowerCase();
    participantUsernames.add(username);
    participantMap.set(username, participant);
});

console.log(`🔍 Unique participant usernames: ${participantUsernames.size}`);

// Find matches
const foundUsers = [];
const notFoundUsers = [];

targetUsernames.forEach(targetUsername => {
    if (participantUsernames.has(targetUsername)) {
        const participant = participantMap.get(targetUsername);
        const originalUser = targetUsers.find(u => u.leetcode_id.trim().toLowerCase() === targetUsername);
        
        foundUsers.push({
            leetcode_id: participant.username,
            display_name: originalUser.display_name,
            rank: participant.rank,
            score: participant.score,
            finish_time: participant.finish_time,
            contest_data: participant
        });
        
        console.log(`✅ FOUND: ${participant.username} (${originalUser.display_name}) - Rank: ${participant.rank}, Score: ${participant.score}`);
    } else {
        const originalUser = targetUsers.find(u => u.leetcode_id.trim().toLowerCase() === targetUsername);
        notFoundUsers.push(originalUser.leetcode_id);
        console.log(`❌ NOT FOUND: ${originalUser.leetcode_id} (${originalUser.display_name})`);
    }
});

// Save results
const resultsFile = './contest-460-found-users.json';
fs.writeFileSync(resultsFile, JSON.stringify(foundUsers, null, 2));

const notFoundFile = './contest-460-not-found-users.json';
fs.writeFileSync(notFoundFile, JSON.stringify(notFoundUsers, null, 2));

console.log(`\n📊 FINAL RESULTS:`);
console.log(`   Total target users: ${targetUsers.length}`);
console.log(`   Users found in contest: ${foundUsers.length}`);
console.log(`   Users not found: ${notFoundUsers.length}`);
console.log(`   Found users saved to: ${resultsFile}`);
console.log(`   Not found users saved to: ${notFoundFile}`);

if (foundUsers.length > 0) {
    console.log(`\n🏆 CONTEST 460 PARTICIPANTS FROM YOUR LIST:`);
    foundUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.display_name} (${user.leetcode_id})`);
        console.log(`      Rank: ${user.rank}, Score: ${user.score}, Finish Time: ${new Date(user.finish_time * 1000).toISOString()}`);
    });
}

// Also show some sample participant usernames to help verify
console.log(`\n🔍 Sample participant usernames (first 20):`);
Array.from(participantUsernames).slice(0, 20).forEach((username, index) => {
    console.log(`   ${index + 1}. ${username}`);
});
