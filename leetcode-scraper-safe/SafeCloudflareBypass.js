const axios = require('axios');

class SafeCloudflareBypass {
    constructor() {
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
            'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'
        ];
        this.currentUserAgentIndex = 0;
        this.sessionData = new Map();
    }

    rotateUserAgent() {
        this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
        return this.userAgents[this.currentUserAgentIndex];
    }

    generateRealisticHeaders(referer = null) {
        const userAgent = this.rotateUserAgent();
        
        const headers = {
            'User-Agent': userAgent,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };

        if (referer) {
            headers['Referer'] = referer;
        }

        return headers;
    }

    generateSessionCookies() {
        // Generate realistic session cookies
        const sessionId = Array.from({length: 32}, () => Math.random().toString(36)[2]).join('');
        const csrfToken = Array.from({length: 40}, () => Math.random().toString(36)[2]).join('');
        
        return {
            'LEETCODE_SESSION': sessionId,
            'csrftoken': csrfToken,
            '_ga': `GA1.2.${Math.floor(Math.random() * 1000000000)}.${Math.floor(Date.now() / 1000)}`,
            '_gid': `GA1.2.${Math.floor(Math.random() * 1000000000)}.${Math.floor(Date.now() / 1000)}`
        };
    }

    async createSafeRequest(url, options = {}) {
        const headers = this.generateRealisticHeaders(options.referer);
        
        // Add cookies if not provided
        if (!options.headers?.Cookie) {
            const cookies = this.generateSessionCookies();
            headers['Cookie'] = Object.entries(cookies)
                .map(([key, value]) => `${key}=${value}`)
                .join('; ');
        }

        const config = {
            method: options.method || 'GET',
            url: url,
            headers: { ...headers, ...options.headers },
            timeout: options.timeout || 30000,
            validateStatus: function (status) {
                return status < 500; // Accept all status codes below 500
            },
            maxRedirects: 5,
            ...options
        };

        return axios(config);
    }

    async testConnection() {
        try {
            console.log('🔍 Testing connection to LeetCode...');
            const response = await this.createSafeRequest('https://leetcode.com/contest/');
            
            if (response.status === 200) {
                console.log('✓ Connection test successful');
                return true;
            } else if (response.status === 403) {
                console.log('⚠ Received 403 - Cloudflare challenge detected');
                return false;
            } else {
                console.log(`⚠ Unexpected status: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.log('✗ Connection test failed:', error.message);
            return false;
        }
    }
}

module.exports = SafeCloudflareBypass;
