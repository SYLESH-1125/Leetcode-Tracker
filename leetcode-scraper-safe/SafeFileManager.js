const fs = require('fs');
const path = require('path');

class SafeFileManager {
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.backupDir = path.join(baseDir, 'backups');
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    createBackup(filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `${filename}-backup-${timestamp}.json`;
        const originalPath = path.join(this.baseDir, filename);
        const backupPath = path.join(this.backupDir, backupName);
        
        if (fs.existsSync(originalPath)) {
            fs.copyFileSync(originalPath, backupPath);
            console.log(`✓ Backup created: ${backupName}`);
            return backupPath;
        }
        return null;
    }

    safeWrite(filename, data) {
        try {
            // Create backup first
            this.createBackup(filename);
            
            // Write to temp file first
            const tempFile = path.join(this.baseDir, `${filename}.tmp`);
            fs.writeFileSync(tempFile, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
            
            // Verify temp file
            if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 0) {
                // Move temp to final
                const finalFile = path.join(this.baseDir, filename);
                fs.renameSync(tempFile, finalFile);
                console.log(`✓ Safe write completed: ${filename}`);
                return true;
            }
            throw new Error('Temp file verification failed');
        } catch (error) {
            console.error(`✗ Safe write failed for ${filename}:`, error.message);
            return false;
        }
    }

    safeRead(filename) {
        try {
            const filePath = path.join(this.baseDir, filename);
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
            return null;
        } catch (error) {
            console.error(`✗ Safe read failed for ${filename}:`, error.message);
            return null;
        }
    }
}

module.exports = SafeFileManager;
