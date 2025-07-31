const SafeCloudflareBypass = require('./SafeCloudflareBypass');

async function testConnection() {
    console.log('🔬 Testing Safe Connection to LeetCode...\n');
    
    const bypass = new SafeCloudflareBypass();
    
    // Test 1: Basic connection
    console.log('Test 1: Basic Connection');
    console.log('='.repeat(40));
    
    try {
        const response = await bypass.createSafeRequest('https://leetcode.com/contest/', {
            timeout: 10000
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Headers: ${JSON.stringify(response.headers, null, 2)}`);
        
        if (response.status === 200) {
            console.log('✓ Basic connection successful');
        } else if (response.status === 403) {
            console.log('⚠ Cloudflare challenge detected');
        } else {
            console.log(`⚠ Unexpected status: ${response.status}`);
        }
        
    } catch (error) {
        console.log(`✗ Connection failed: ${error.message}`);
    }
    
    console.log('\n');
    
    // Test 2: Contest API endpoint
    console.log('Test 2: Contest API Endpoint');
    console.log('='.repeat(40));
    
    try {
        const contestUrl = 'https://leetcode.com/contest/api/ranking/weekly-contest-460/?pagination=1&region=global';
        const response = await bypass.createSafeRequest(contestUrl, {
            referer: 'https://leetcode.com/contest/weekly-contest-460/ranking/',
            timeout: 15000
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        
        if (response.status === 200 && response.data) {
            console.log('✓ Contest API accessible');
            
            if (response.data.submissions) {
                console.log(`  Sample data: ${response.data.submissions.length} participants on page 1`);
                if (response.data.submissions.length > 0) {
                    const sample = response.data.submissions[0];
                    console.log(`  Sample participant: ${sample.username} (${sample.score})`);
                }
            }
        } else {
            console.log(`✗ Contest API failed: ${response.status}`);
        }
        
    } catch (error) {
        console.log(`✗ Contest API failed: ${error.message}`);
    }
    
    console.log('\n');
    
    // Test 3: Multiple user agents
    console.log('Test 3: User Agent Rotation');
    console.log('='.repeat(40));
    
    for (let i = 0; i < 3; i++) {
        try {
            const userAgent = bypass.rotateUserAgent();
            console.log(`Test ${i + 1}: ${userAgent.substring(0, 50)}...`);
            
            const response = await bypass.createSafeRequest('https://leetcode.com/contest/', {
                timeout: 8000
            });
            
            console.log(`  Status: ${response.status}`);
            
        } catch (error) {
            console.log(`  ✗ Failed: ${error.message}`);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🏁 Connection test completed');
}

// Run test
if (require.main === module) {
    testConnection()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Test failed:', error);
            process.exit(1);
        });
}

module.exports = testConnection;
