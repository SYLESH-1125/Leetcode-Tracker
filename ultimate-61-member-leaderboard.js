const fs = require('fs');
const PDFDocument = require('pdfkit');

class Ultimate61MemberLeaderboard {
    constructor() {
        this.allTargetUsers = [];
        this.foundUsers = [];
        this.notFoundUsers = [];
        this.leaderboard = [];
        this.contestStats = {};
    }

    loadAllData() {
        try {
            // Load original target users (all 61)
            this.allTargetUsers = JSON.parse(fs.readFileSync('./users.json', 'utf8'));
            
            // Load found users with contest data
            if (fs.existsSync('./contest-460-final-found-users.json')) {
                this.foundUsers = JSON.parse(fs.readFileSync('./contest-460-final-found-users.json', 'utf8'));
            }
            
            // Load not found users
            if (fs.existsSync('./contest-460-final-not-found-users.json')) {
                this.notFoundUsers = JSON.parse(fs.readFileSync('./contest-460-final-not-found-users.json', 'utf8'));
            }
            
            // Load all contest participants for context
            if (fs.existsSync('./contest-460-all-participants.json')) {
                const allParticipants = JSON.parse(fs.readFileSync('./contest-460-all-participants.json', 'utf8'));
                this.calculateContestStats(allParticipants);
            }
            
            // Create complete leaderboard
            this.createCompleteLeaderboard();
            
            console.log(`✅ Loaded complete data for all ${this.allTargetUsers.length} members`);
            console.log(`   📊 Found in contest: ${this.foundUsers.length}`);
            console.log(`   ❌ Not found: ${this.notFoundUsers.length}`);
            
            return true;
        } catch (error) {
            console.error(`❌ Error loading data: ${error.message}`);
            return false;
        }
    }

    calculateContestStats(allParticipants) {
        const scores = allParticipants.map(p => p.score).filter(s => s > 0);
        this.contestStats = {
            totalParticipants: allParticipants.length,
            avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            maxScore: Math.max(...scores),
            minScore: Math.min(...scores.filter(s => s > 0)),
            participantsWithScore: scores.length,
            contestDate: new Date(allParticipants[0]?.finish_time * 1000 || Date.now())
        };
    }

    createCompleteLeaderboard() {
        // Create unified leaderboard with all 61 members
        this.leaderboard = [];
        
        // Add found users with their contest data
        this.foundUsers.forEach(user => {
            this.leaderboard.push({
                position: null, // Will be assigned later
                name: user.display_name,
                leetcode_id: user.original_leetcode_id,
                matched_as: user.leetcode_id,
                participated: true,
                rank: user.rank,
                score: user.score,
                finish_time: user.finish_time,
                performance_level: this.getPerformanceLevel(user.score),
                percentile: this.calculatePercentile(user.rank),
                contest_data: user
            });
        });
        
        // Add not found users
        this.notFoundUsers.forEach(user => {
            // Find original user data
            const originalUser = this.allTargetUsers.find(u => 
                u.leetcode_id.trim() === user.leetcode_id || 
                u.display_name === user.display_name
            );
            
            this.leaderboard.push({
                position: null,
                name: originalUser?.display_name || user.display_name,
                leetcode_id: user.leetcode_id,
                matched_as: null,
                participated: false,
                rank: null,
                score: null,
                finish_time: null,
                performance_level: 'Did Not Participate',
                percentile: null,
                contest_data: null
            });
        });
        
        // Sort leaderboard: participants first (by rank), then non-participants
        this.leaderboard.sort((a, b) => {
            if (a.participated && !b.participated) return -1;
            if (!a.participated && b.participated) return 1;
            if (a.participated && b.participated) return a.rank - b.rank;
            return a.name.localeCompare(b.name);
        });
        
        // Assign positions
        this.leaderboard.forEach((member, index) => {
            member.position = index + 1;
        });
    }

    getPerformanceLevel(score) {
        if (score >= 15) return 'Outstanding (15+ pts)';
        if (score >= 9) return 'Excellent (9-14 pts)';
        if (score >= 4) return 'Good (4-8 pts)';
        if (score > 0) return 'Basic (1-3 pts)';
        if (score === 0) return 'Attempted (0 pts)';
        return 'Did Not Participate';
    }

    calculatePercentile(rank) {
        if (!rank || !this.contestStats.totalParticipants) return null;
        return ((this.contestStats.totalParticipants - rank) / this.contestStats.totalParticipants * 100).toFixed(1);
    }

    generateUltimateLeaderboardPDF() {
        const doc = new PDFDocument({ 
            margin: 30,
            size: 'A4',
            bufferPages: true,
            autoFirstPage: false
        });
        
        const outputPath = './Ultimate-61-Member-Contest-460-Leaderboard-v2.pdf';
        doc.pipe(fs.createWriteStream(outputPath));

        // Cover Page
        this.addCoverPage(doc);
        
        // Executive Dashboard
        this.addExecutiveDashboard(doc);
        
        // Complete Leaderboard
        this.addCompleteLeaderboard(doc);
        
        // Detailed Member Profiles
        this.addDetailedMemberProfiles(doc);
        
        // Performance Analytics
        this.addPerformanceAnalytics(doc);
        
        // Recommendations & Action Plan
        this.addRecommendationsPage(doc);

        doc.end();
        
        console.log(`Ultimate leaderboard PDF generated: ${outputPath}`);
        return outputPath;
    }

    addCoverPage(doc) {
        doc.addPage();
        
        // Background gradient effect
        doc.rect(0, 0, 595, 842).fill('#1a1a2e');
        
        // Title with proper spacing
        doc.fontSize(32)
           .fillColor('#ffffff')
           .text('ULTIMATE LEADERBOARD', 50, 120, { align: 'center', width: 495 });
        
        doc.fontSize(28)
           .fillColor('#ffd700')
           .text('LeetCode Contest 460', 50, 170, { align: 'center', width: 495 });
        
        doc.fontSize(18)
           .fillColor('#ffffff')
           .text('Complete 61-Member Performance Report', 50, 220, { align: 'center', width: 495 });
        
        // Stats box with better positioning
        doc.rect(75, 300, 445, 180)
           .fill('#16213e')
           .stroke('#ffd700')
           .lineWidth(2);
        
        doc.fontSize(16)
           .fillColor('#ffd700')
           .text('CONTEST OVERVIEW', 95, 320);
        
        doc.fontSize(12)
           .fillColor('#ffffff')
           .text(`Contest Date: ${this.contestStats.contestDate?.toDateString() || 'July 27, 2025'}`, 95, 350)
           .text(`Total Group Members: ${this.allTargetUsers.length}`, 95, 370)
           .text(`Participants: ${this.foundUsers.length}`, 95, 390)
           .text(`Non-Participants: ${this.notFoundUsers.length}`, 95, 410)
           .text(`Global Participants: ${this.contestStats.totalParticipants?.toLocaleString() || 'N/A'}`, 95, 430);
        
        // Participation rate with better layout
        const participationRate = (this.foundUsers.length / this.allTargetUsers.length * 100).toFixed(1);
        doc.fontSize(28)
           .fillColor('#00ff88')
           .text(`${participationRate}%`, 400, 370);
        
        doc.fontSize(11)
           .fillColor('#ffffff')
           .text('Participation Rate', 390, 410);
        
        // Footer with proper spacing
        doc.fontSize(10)
           .fillColor('#888888')
           .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 750, { align: 'center', width: 495 });
    }

    addExecutiveDashboard(doc) {
        doc.addPage();
        
        doc.fontSize(22)
           .fillColor('#1a1a2e')
           .text('EXECUTIVE DASHBOARD', 50, 50, { align: 'center', width: 495 });
        
        // Performance summary cards with better layout
        const cardWidth = 140;
        const cardHeight = 90;
        const startX = 50;
        const startY = 120;
        const cardSpacing = 160;
        
        // Top Performer Card
        const topPerformer = this.leaderboard.find(m => m.participated);
        doc.rect(startX, startY, cardWidth, cardHeight)
           .fill('#d4edda')
           .stroke('#28a745')
           .lineWidth(2);
        
        doc.fontSize(11)
           .fillColor('#155724')
           .text('TOP PERFORMER', startX + 10, startY + 10);
        
        doc.fontSize(9)
           .fillColor('#333333')
           .text(topPerformer?.name || 'N/A', startX + 10, startY + 28, { width: cardWidth - 20 });
        
        doc.fontSize(10)
           .fillColor('#155724')
           .text(`Rank: ${topPerformer?.rank?.toLocaleString() || 'N/A'}`, startX + 10, startY + 50)
           .text(`Score: ${topPerformer?.score || 'N/A'}`, startX + 10, startY + 68);
        
        // Average Performance Card
        const avgScore = this.foundUsers.length > 0 
            ? (this.foundUsers.reduce((sum, u) => sum + u.score, 0) / this.foundUsers.length).toFixed(1)
            : 0;
        
        doc.rect(startX + cardSpacing, startY, cardWidth, cardHeight)
           .fill('#cce5ff')
           .stroke('#007bff')
           .lineWidth(2);
        
        doc.fontSize(11)
           .fillColor('#004085')
           .text('GROUP AVERAGE', startX + cardSpacing + 10, startY + 10);
        
        doc.fontSize(14)
           .fillColor('#0056b3')
           .text(`${avgScore} pts`, startX + cardSpacing + 40, startY + 35);
        
        doc.fontSize(8)
           .fillColor('#004085')
           .text(`vs Global: ${this.contestStats.avgScore?.toFixed(1) || 'N/A'}`, startX + cardSpacing + 10, startY + 60);
        
        // Participation Card
        doc.rect(startX + (cardSpacing * 2), startY, cardWidth, cardHeight)
           .fill('#f8d7da')
           .stroke('#dc3545')
           .lineWidth(2);
        
        doc.fontSize(11)
           .fillColor('#721c24')
           .text('PARTICIPATION', startX + (cardSpacing * 2) + 10, startY + 10);
        
        doc.fontSize(14)
           .fillColor('#a71e2a')
           .text(`${this.foundUsers.length}/${this.allTargetUsers.length}`, startX + (cardSpacing * 2) + 30, startY + 35);
        
        doc.fontSize(10)
           .fillColor('#721c24')
           .text(`${((this.foundUsers.length / this.allTargetUsers.length) * 100).toFixed(1)}%`, startX + (cardSpacing * 2) + 45, startY + 60);
        
        // Score Distribution Chart
        doc.fontSize(16)
           .fillColor('#1a1a2e')
           .text('PERFORMANCE DISTRIBUTION', 50, 250);
        
        const scoreGroups = {
            'Outstanding (9+ pts)': this.foundUsers.filter(u => u.score >= 9).length,
            'Good (4-8 pts)': this.foundUsers.filter(u => u.score >= 4 && u.score < 9).length,
            'Basic (1-3 pts)': this.foundUsers.filter(u => u.score >= 1 && u.score < 4).length,
            'Attempted (0 pts)': this.foundUsers.filter(u => u.score === 0).length,
            'Did Not Participate': this.notFoundUsers.length
        };
        
        let yPos = 290;
        Object.keys(scoreGroups).forEach((group, index) => {
            const count = scoreGroups[group];
            const barWidth = (count / this.allTargetUsers.length) * 300;
            
            // Bar
            doc.rect(50, yPos, Math.max(barWidth, 5), 20)
               .fill(this.getColorForGroup(index));
            
            // Label and count
            doc.fontSize(10)
               .fillColor('#333333')
               .text(`${group}: ${count}`, 360, yPos + 6);
            
            yPos += 30;
        });
    }

    getColorForGroup(index) {
        const colors = ['#d4edda', '#cce5ff', '#fff3cd', '#f8d7da', '#e2e3e5'];
        return colors[index] || '#f8f9fa';
    }

    addCompleteLeaderboard(doc) {
        doc.addPage();
        
        doc.fontSize(20)
           .fillColor('#1a1a2e')
           .text('COMPLETE 61-MEMBER LEADERBOARD', 50, 40, { align: 'center', width: 495 });
        
        // Table headers with better spacing
        const tableTop = 80;
        const rowHeight = 16;
        
        doc.fontSize(9)
           .fillColor('#ffffff');
        
        // Header row
        doc.rect(30, tableTop, 535, rowHeight + 4)
           .fill('#1a1a2e');
        
        doc.text('#', 35, tableTop + 6)
           .text('Name', 55, tableTop + 6)
           .text('LeetCode ID', 200, tableTop + 6)
           .text('Rank', 320, tableTop + 6)
           .text('Score', 375, tableTop + 6)
           .text('Performance', 420, tableTop + 6)
           .text('%ile', 520, tableTop + 6);
        
        let currentY = tableTop + rowHeight + 4;
        
        this.leaderboard.forEach((member, index) => {
            // Check if we need a new page
            if (currentY > 750) {
                doc.addPage();
                currentY = 50;
                
                // Repeat headers
                doc.rect(30, currentY, 535, rowHeight + 4)
                   .fill('#1a1a2e');
                
                doc.fontSize(9)
                   .fillColor('#ffffff')
                   .text('#', 35, currentY + 6)
                   .text('Name', 55, currentY + 6)
                   .text('LeetCode ID', 200, currentY + 6)
                   .text('Rank', 320, currentY + 6)
                   .text('Score', 375, currentY + 6)
                   .text('Performance', 420, currentY + 6)
                   .text('%ile', 520, currentY + 6);
                
                currentY += rowHeight + 4;
            }
            
            // Row background (alternating colors)
            const bgColor = member.participated 
                ? (index % 2 === 0 ? '#f8f9fa' : '#ffffff')
                : '#ffe6e6';
            
            doc.rect(30, currentY, 535, rowHeight)
               .fill(bgColor)
               .stroke('#dddddd')
               .lineWidth(0.5);
            
            // Text color based on participation
            const textColor = member.participated ? '#333333' : '#888888';
            
            doc.fontSize(8)
               .fillColor(textColor)
               .text(member.position.toString(), 35, currentY + 4)
               .text(member.name.substring(0, 22), 55, currentY + 4)
               .text(member.leetcode_id.substring(0, 18), 200, currentY + 4);
            
            if (member.participated) {
                doc.text(member.rank?.toLocaleString() || '-', 320, currentY + 4)
                   .text(member.score?.toString() || '-', 375, currentY + 4)
                   .text(member.performance_level.substring(0, 15), 420, currentY + 4)
                   .text(member.percentile ? `${member.percentile}%` : '-', 520, currentY + 4);
            } else {
                doc.fillColor('#dc143c')
                   .text('DID NOT PARTICIPATE', 320, currentY + 4, { width: 200 });
            }
            
            currentY += rowHeight;
        });
    }

    addDetailedMemberProfiles(doc) {
        doc.addPage();
        
        doc.fontSize(20)
           .fillColor('#1a1a2e')
           .text('DETAILED MEMBER PROFILES', 50, 40, { align: 'center', width: 495 });
        
        let currentY = 80;
        
        // Participants first
        const participants = this.leaderboard.filter(m => m.participated);
        const nonParticipants = this.leaderboard.filter(m => !m.participated);
        
        // Add participants
        participants.forEach((member, index) => {
            currentY = this.addMemberProfile(doc, member, index + 1, true, currentY);
        });
        
        // Add non-participants section
        if (nonParticipants.length > 0) {
            // Check if we need new page for non-participants section
            if (currentY > 700) {
                doc.addPage();
                currentY = 40;
            }
            
            doc.fontSize(18)
               .fillColor('#dc143c')
               .text('NON-PARTICIPATING MEMBERS', 50, currentY, { align: 'center', width: 495 });
            
            currentY += 40;
            
            nonParticipants.forEach((member, index) => {
                currentY = this.addMemberProfile(doc, member, participants.length + index + 1, false, currentY);
            });
        }
    }

    addMemberProfile(doc, member, position, participated, currentY) {
        const boxHeight = participated ? 85 : 55;
        
        // Check if we need a new page
        if (currentY > 750 - boxHeight) {
            doc.addPage();
            currentY = 50;
        }
        
        const boxColor = participated ? '#f8fff8' : '#fff5f5';
        const borderColor = participated ? '#90c695' : '#f5a5a5';
        const badgeColor = participated ? '#4a9d4f' : '#d17171';
        
        // Profile box with lighter colors
        doc.rect(30, currentY, 535, boxHeight)
           .fill(boxColor)
           .stroke(borderColor)
           .lineWidth(1);
        
        // Position badge with better contrast
        doc.rect(30, currentY, 40, 25)
           .fill(badgeColor)
           .stroke('#333333')
           .lineWidth(0.5);
        
        doc.fontSize(11)
           .fillColor('#000000')
           .text(`#${position}`, 50, currentY + 8, { align: 'center' });
        
        // Member details
        doc.fontSize(13)
           .fillColor('#1a1a2e')
           .text(member.name, 80, currentY + 12);
        
        doc.fontSize(9)
           .fillColor('#555555')
           .text(`LeetCode ID: ${member.leetcode_id}`, 80, currentY + 30);
        
        if (participated) {
            // Contest performance
            doc.fontSize(11)
               .fillColor('#2d7a32')
               .text(`Rank: ${member.rank?.toLocaleString()}`, 350, currentY + 12)
               .text(`Score: ${member.score} points`, 350, currentY + 30)
               .text(`Top ${member.percentile}%`, 350, currentY + 48);
            
            doc.fontSize(9)
               .fillColor('#333333')
               .text(`Performance: ${member.performance_level}`, 80, currentY + 48)
               .text(`Finished: ${new Date(member.finish_time * 1000).toLocaleString()}`, 80, currentY + 65);
        } else {
            doc.fontSize(11)
               .fillColor('#c62828')
               .text('Did Not Participate', 350, currentY + 22);
            
            doc.fontSize(9)
               .fillColor('#666666')
               .text('Consider reaching out for future contests', 80, currentY + 45);
        }
        
        return currentY + boxHeight + 8;
    }

    addPerformanceAnalytics(doc) {
        doc.addPage();
        
        doc.fontSize(20)
           .fillColor('#1a1a2e')
           .text('PERFORMANCE ANALYTICS', 50, 40, { align: 'center', width: 495 });
        
        // Group statistics
        const participants = this.leaderboard.filter(m => m.participated);
        const scores = participants.map(p => p.score);
        const ranks = participants.map(p => p.rank);
        
        const analytics = {
            totalMembers: this.allTargetUsers.length,
            participants: participants.length,
            nonParticipants: this.allTargetUsers.length - participants.length,
            participationRate: (participants.length / this.allTargetUsers.length * 100).toFixed(1),
            avgScore: scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0,
            bestScore: scores.length > 0 ? Math.max(...scores) : 0,
            worstScore: scores.length > 0 ? Math.min(...scores) : 0,
            bestRank: ranks.length > 0 ? Math.min(...ranks) : 0,
            worstRank: ranks.length > 0 ? Math.max(...ranks) : 0,
            medianRank: ranks.length > 0 ? ranks.sort((a, b) => a - b)[Math.floor(ranks.length / 2)] : 0
        };
        
        // Analytics grid with better spacing
        const colWidth = 250;
        const rowHeight = 30;
        const startY = 100;
        
        const analyticsData = [
            ['Total Members', analytics.totalMembers],
            ['Participants', analytics.participants],
            ['Non-Participants', analytics.nonParticipants],
            ['Participation Rate', `${analytics.participationRate}%`],
            ['Average Score', `${analytics.avgScore} pts`],
            ['Best Score', `${analytics.bestScore} pts`],
            ['Worst Score', `${analytics.worstScore} pts`],
            ['Best Rank', analytics.bestRank.toLocaleString()],
            ['Worst Rank', analytics.worstRank.toLocaleString()],
            ['Median Rank', analytics.medianRank.toLocaleString()]
        ];
        
        analyticsData.forEach((item, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = 60 + (col * colWidth);
            const y = startY + (row * rowHeight);
            
            doc.fontSize(11)
               .fillColor('#333333')
               .text(`${item[0]}:`, x, y)
               .fillColor('#2e8b57')
               .text(item[1].toString(), x + 120, y);
        });
        
        // Improvement recommendations
        doc.fontSize(16)
           .fillColor('#a23b72')
           .text('RECOMMENDATIONS & ACTION ITEMS', 50, 400);
        
        const recommendations = [
            '1. Celebrate top performers and recognize their achievements',
            '2. Provide additional practice resources for lower-scoring participants',
            '3. Organize peer mentoring sessions between high and low performers',
            '4. Send contest reminders to increase participation rate',
            '5. Set up practice sessions before future contests',
            '6. Track progress over multiple contests for improvement trends'
        ];
        
        let recY = 430;
        recommendations.forEach((rec) => {
            doc.fontSize(10)
               .fillColor('#333333')
               .text(rec, 50, recY, { width: 495 });
            recY += 25;
        });
    }

    addRecommendationsPage(doc) {
        doc.addPage();
        
        doc.fontSize(20)
           .fillColor('#1a1a2e')
           .text('ACTION PLAN & NEXT STEPS', 50, 40, { align: 'center', width: 495 });
        
        // Individual recommendations
        doc.fontSize(16)
           .fillColor('#2e8b57')
           .text('For High Performers (9+ points):', 50, 90);
        
        const highPerformers = this.leaderboard.filter(m => m.participated && m.score >= 9);
        let currentY = 115;
        
        if (highPerformers.length > 0) {
            highPerformers.forEach(member => {
                doc.fontSize(10)
                   .fillColor('#333333')
                   .text(`• ${member.name} - Consider advanced problem sets and contest leadership roles`, 60, currentY);
                currentY += 18;
            });
        } else {
            doc.fontSize(10)
               .fillColor('#888888')
               .text('• No high performers in this contest', 60, currentY);
            currentY += 18;
        }
        
        currentY += 15;
        
        // Medium performers
        doc.fontSize(16)
           .fillColor('#4682b4')
           .text('For Good Performers (4-8 points):', 50, currentY);
        
        currentY += 25;
        
        const mediumPerformers = this.leaderboard.filter(m => m.participated && m.score >= 4 && m.score < 9);
        mediumPerformers.slice(0, 8).forEach(member => {
            doc.fontSize(10)
               .fillColor('#333333')
               .text(`• ${member.name} - Focus on advanced algorithms and time optimization`, 60, currentY);
            currentY += 18;
        });
        
        if (mediumPerformers.length > 8) {
            doc.fontSize(10)
               .fillColor('#888888')
               .text(`• ... and ${mediumPerformers.length - 8} others with similar recommendations`, 60, currentY);
            currentY += 18;
        }
        
        currentY += 15;
        
        // Low performers / non-participants
        doc.fontSize(16)
           .fillColor('#dc143c')
           .text('For Non-Participants & Low Performers:', 50, currentY);
        
        currentY += 25;
        
        const needsSupport = this.leaderboard.filter(m => !m.participated || (m.participated && m.score < 4));
        needsSupport.slice(0, 8).forEach(member => {
            const action = member.participated 
                ? 'Basic problem-solving practice and contest strategy'
                : 'Encourage participation and provide contest information';
            
            doc.fontSize(10)
               .fillColor('#333333')
               .text(`• ${member.name} - ${action}`, 60, currentY);
            currentY += 18;
        });
        
        if (needsSupport.length > 8) {
            doc.fontSize(10)
               .fillColor('#888888')
               .text(`• ... and ${needsSupport.length - 8} others needing similar support`, 60, currentY);
            currentY += 18;
        }
        
        // Footer
        currentY += 40;
        
        doc.fontSize(12)
           .fillColor('#888888')
           .text('Report Summary', 50, currentY, { align: 'center', width: 495 })
           .text(`Generated: ${new Date().toISOString().split('T')[0]}`, 50, currentY + 20, { align: 'center', width: 495 })
           .text('Ready for next contest!', 50, currentY + 40, { align: 'center', width: 495 });
    }
}

// Main execution
async function generateUltimateLeaderboard() {
    console.log('🏆 Starting Ultimate 61-Member Leaderboard generation...');
    
    const generator = new Ultimate61MemberLeaderboard();
    
    if (!generator.loadAllData()) {
        console.error('❌ Failed to load data files');
        return;
    }
    
    try {
        const outputPath = generator.generateUltimateLeaderboardPDF();
        console.log(`✅ Successfully generated Ultimate Leaderboard: ${outputPath}`);
        console.log('');
        console.log('📄 ULTIMATE LEADERBOARD INCLUDES:');
        console.log('   🏆 Complete ranking of all 61 members');
        console.log('   📊 Executive dashboard with key metrics');
        console.log('   👤 Detailed individual member profiles');
        console.log('   📈 Performance analytics and comparisons');
        console.log('   🎯 Personalized recommendations for each member');
        console.log('   ❌ Non-participants with action plans');
        console.log('   📋 Complete contest statistics and context');
        console.log('');
        console.log(`🎉 Your complete ${generator.allTargetUsers.length}-member leaderboard is ready!`);
    } catch (error) {
        console.error(`❌ Error generating Ultimate Leaderboard: ${error.message}`);
    }
}

if (require.main === module) {
    generateUltimateLeaderboard();
}

module.exports = Ultimate61MemberLeaderboard;
