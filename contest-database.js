const fs = require("fs");
const path = require("path");

class ContestDatabase {
  constructor() {
    this.dbPath = path.join(__dirname, "contest_data.json");
    this.data = this.loadDatabase();
  }

  loadDatabase() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.log("Error loading database:", error.message);
    }

    return {
      contests: {},
      lastUpdated: null,
      metadata: {
        version: "1.0",
        source: "LeetCode Official API",
        bypassMethod: "Cloudflare Bypass",
      },
    };
  }

  saveDatabase() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
      console.log(`Database saved to ${this.dbPath}`);
    } catch (error) {
      console.error("Error saving database:", error.message);
    }
  }

  addContestData(contestSlug, contestData) {
    this.data.contests[contestSlug] = {
      ...contestData,
      fetchedAt: new Date().toISOString(),
      participants: contestData.submissions || contestData.total_rank || 0,
    };
    this.data.lastUpdated = new Date().toISOString();
    this.saveDatabase();
  }

  getContestData(contestSlug) {
    return this.data.contests[contestSlug] || null;
  }

  getAllContests() {
    return Object.keys(this.data.contests);
  }

  getContestStats() {
    const contests = Object.values(this.data.contests);
    return {
      totalContests: contests.length,
      totalParticipants: contests.reduce(
        (sum, contest) => sum + (contest.participants || 0),
        0
      ),
      lastUpdated: this.data.lastUpdated,
      contests: contests.map((contest) => ({
        slug: contest.contestSlug || "unknown",
        participants: contest.participants || 0,
        fetchedAt: contest.fetchedAt,
      })),
    };
  }

  exportContestData(contestSlug, format = "json") {
    const contest = this.getContestData(contestSlug);
    if (!contest) {
      throw new Error(`Contest ${contestSlug} not found in database`);
    }

    const filename = `${contestSlug}_${format}.${format}`;
    const filepath = path.join(__dirname, "exports", filename);

    // Create exports directory if it doesn't exist
    const exportsDir = path.dirname(filepath);
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    if (format === "json") {
      fs.writeFileSync(filepath, JSON.stringify(contest, null, 2));
    } else if (format === "csv") {
      // Convert to CSV format
      const submissions = contest.submissions || [];
      const csvHeader = "rank,username,score,finishTime,problems\n";
      const csvRows = submissions
        .map(
          (sub) =>
            `${sub.rank || ""},${sub.username || ""},${sub.score || ""},${
              sub.finishTime || ""
            },${sub.problemCount || ""}`
        )
        .join("\n");
      fs.writeFileSync(filepath, csvHeader + csvRows);
    }

    console.log(`Contest data exported to ${filepath}`);
    return filepath;
  }
}

module.exports = ContestDatabase;
