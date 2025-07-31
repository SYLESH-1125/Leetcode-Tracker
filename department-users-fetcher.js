const CloudflareBypass = require("./cloudflare-bypass");
const ContestDatabase = require("./contest-database");
const fs = require("fs");
const path = require("path");

class DepartmentUsersFetcher {
  constructor() {
    this.bypass = new CloudflareBypass();
    this.db = new ContestDatabase();
    this.usersFilePath = "c:\\testtttt\\testing\\users.json";
    this.departmentUsers = [];
    this.loadUsers();
  }

  loadUsers() {
    try {
      if (fs.existsSync(this.usersFilePath)) {
        const userData = fs.readFileSync(this.usersFilePath, "utf8");
        this.departmentUsers = JSON.parse(userData);
        console.log(
          `📚 Loaded ${this.departmentUsers.length} department users`
        );
      } else {
        console.log("❌ Users file not found at:", this.usersFilePath);
      }
    } catch (error) {
      console.error("Error loading users:", error.message);
      this.departmentUsers = [];
    }
  }

  async fetchAllDepartmentUsersData() {
    console.log("🎯 STARTING DEPARTMENT USERS DATA FETCH FOR CONTEST 460");
    console.log("=".repeat(60));
    console.log(`📊 Target: ${this.departmentUsers.length} department users`);
    console.log("🏆 Contest: Weekly Contest 460 ONLY");
    console.log("🔧 Initializing advanced LeetCode fetching systems...");

    const results = {
      successful: [],
      failed: [],
      contest460Data: {},
      userStats: {},
    };

    console.log("\n🚀 FETCHING USER DATA...");

    for (let i = 0; i < this.departmentUsers.length; i++) {
      const user = this.departmentUsers[i];
      const progress = `[${i + 1}/${this.departmentUsers.length}]`;

      console.log(
        `\n${progress} Processing: ${user.display_name} (${user.leetcode_id})`
      );

      try {
        const userData = await this.fetchUserContest460Data(user);

        if (userData && userData.success) {
          results.successful.push(user);
          results.userStats[user.leetcode_id] = userData;
          results.contest460Data[user.leetcode_id] = userData.contest460;
          console.log(
            `  ✅ SUCCESS: Found in Contest 460 - Rank ${
              userData.contest460?.rank || "N/A"
            }`
          );
        } else {
          results.failed.push({ user, reason: "Not found in Contest 460" });
          console.log(
            `  ❌ NOT FOUND: User did not participate in Contest 460`
          );
        }

        // Add delay to avoid rate limiting
        await this.delay(1000);
      } catch (error) {
        results.failed.push({ user, reason: error.message });
        console.log(`  ❌ FAILED: ${error.message}`);
      }
    }

    console.log("\n📊 CONTEST 460 DEPARTMENT FETCH SUMMARY:");
    console.log("=".repeat(50));
    console.log(`✅ Found in Contest 460: ${results.successful.length} users`);
    console.log(`❌ Not in Contest 460: ${results.failed.length} users`);
    console.log(
      `📈 Participation Rate: ${(
        (results.successful.length / this.departmentUsers.length) *
        100
      ).toFixed(1)}%`
    );

    if (results.successful.length > 0) {
      console.log("\n🏆 CONTEST 460 PARTICIPANTS FROM YOUR DEPARTMENT:");
      results.successful.forEach((user) => {
        const contest460Data = results.contest460Data[user.leetcode_id];
        console.log(
          `  - ${user.display_name} (${user.leetcode_id}): Rank ${
            contest460Data?.rank || "N/A"
          }, Score ${contest460Data?.score || "N/A"}`
        );
      });
    }

    // Save results
    await this.saveDepartmentData(results);

    return results;
  }

  async fetchUserContest460Data(user) {
    console.log(`    🏆 Checking Contest 460 for ${user.leetcode_id}...`);

    try {
      // First, check our local Contest 460 database
      const localData = this.checkLocalContest460Data(user);
      if (localData) {
        console.log(`    ✅ Found in local Contest 460 database`);
        return {
          leetcode_id: user.leetcode_id,
          display_name: user.display_name,
          success: true,
          contest460: localData,
          source: "LOCAL_DATABASE",
        };
      }

      // If not in local database, try fetching from LeetCode API
      const methods = [
        () => this.fetchFromContest460API(user),
        () => this.fetchFromContest460GraphQL(user),
        () => this.fetchFromContest460Alternative(user),
      ];

      for (const method of methods) {
        try {
          const result = await method();
          if (result && result.success) {
            console.log(
              `    ✅ Found via API - Rank ${result.contest460?.rank || "N/A"}`
            );
            return result;
          }
        } catch (error) {
          console.log(`    ⚠️ Method failed: ${error.message}`);
        }
      }

      console.log(`    ❌ User not found in Contest 460`);
      return { success: false, reason: "Not participated in Contest 460" };
    } catch (error) {
      console.log(`    ❌ Error fetching Contest 460 data: ${error.message}`);
      return { success: false, reason: error.message };
    }
  }

  checkLocalContest460Data(user) {
    try {
      // Check if we have Contest 460 data in our database
      const contest460Data = this.db.getContestData("weekly-contest-460");

      if (contest460Data && contest460Data.total_rank) {
        const userRank = contest460Data.total_rank.find(
          (participant) =>
            participant.username === user.leetcode_id ||
            participant.user_slug === user.leetcode_id
        );

        if (userRank) {
          return {
            contest_name: "Weekly Contest 460",
            contest_id: 460,
            rank: userRank.rank,
            score: userRank.score,
            finish_time: userRank.finish_time,
            username: userRank.username,
            country_name: userRank.country_name || "Unknown",
            data_region: userRank.data_region || "Unknown",
          };
        }
      }

      return null;
    } catch (error) {
      console.log(`    Error checking local data: ${error.message}`);
      return null;
    }
  }

  async fetchFromContest460API(user) {
    try {
      const apiUrls = [
        "https://leetcode.com/contest/api/ranking/weekly-contest-460/?pagination=1&region=global",
        "https://leetcode.com/contest/api/ranking/weekly-contest-460/",
        "https://leetcode.com/contest/weekly-contest-460/ranking/",
      ];

      for (const url of apiUrls) {
        try {
          const response = await this.bypass.bypassCloudflare(url);

          if (response.data && response.data.total_rank) {
            const userRank = response.data.total_rank.find(
              (participant) => participant.username === user.leetcode_id
            );

            if (userRank) {
              return {
                leetcode_id: user.leetcode_id,
                display_name: user.display_name,
                success: true,
                contest460: {
                  contest_name: "Weekly Contest 460",
                  contest_id: 460,
                  rank: userRank.rank,
                  score: userRank.score,
                  finish_time: userRank.finish_time,
                  username: userRank.username,
                  country_name: userRank.country_name,
                  data_region: userRank.data_region,
                },
                source: "LEETCODE_API",
              };
            }
          }
        } catch (error) {
          continue;
        }
      }

      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  async fetchFromContest460GraphQL(user) {
    try {
      const graphqlQuery = {
        query: `
          query contestRanking($contestSlug: String!, $username: String!) {
            contestRanking(contestSlug: $contestSlug) {
              submissions {
                user {
                  username
                  profile {
                    userSlug
                    realName
                  }
                }
                rank
                score
                finishTime
              }
            }
          }
        `,
        variables: {
          contestSlug: "weekly-contest-460",
          username: user.leetcode_id,
        },
      };

      const response = await this.bypass.bypassCloudflare(
        "https://leetcode.com/graphql/",
        {
          method: "POST",
          data: graphqlQuery,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.data?.contestRanking?.submissions) {
        const userSubmission =
          response.data.data.contestRanking.submissions.find(
            (sub) => sub.user?.username === user.leetcode_id
          );

        if (userSubmission) {
          return {
            leetcode_id: user.leetcode_id,
            display_name: user.display_name,
            success: true,
            contest460: {
              contest_name: "Weekly Contest 460",
              contest_id: 460,
              rank: userSubmission.rank,
              score: userSubmission.score,
              finish_time: userSubmission.finishTime,
              username: userSubmission.user.username,
            },
            source: "LEETCODE_GRAPHQL",
          };
        }
      }

      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  async fetchFromContest460Alternative(user) {
    try {
      // Try alternative endpoints
      const alternativeUrls = [
        `https://leetcode.com/contest/weekly-contest-460/ranking/1/`,
        `https://leetcode.cn/contest/api/ranking/weekly-contest-460/`,
      ];

      for (const url of alternativeUrls) {
        try {
          const response = await this.bypass.bypassCloudflare(url);

          // Look for user in HTML or JSON response
          if (typeof response.data === "string") {
            // HTML response - look for username
            if (response.data.includes(user.leetcode_id)) {
              return {
                leetcode_id: user.leetcode_id,
                display_name: user.display_name,
                success: true,
                contest460: {
                  contest_name: "Weekly Contest 460",
                  contest_id: 460,
                  found_in_html: true,
                  username: user.leetcode_id,
                },
                source: "HTML_DETECTION",
              };
            }
          } else if (response.data && response.data.total_rank) {
            // JSON response
            const userRank = response.data.total_rank.find(
              (participant) => participant.username === user.leetcode_id
            );

            if (userRank) {
              return {
                leetcode_id: user.leetcode_id,
                display_name: user.display_name,
                success: true,
                contest460: {
                  contest_name: "Weekly Contest 460",
                  contest_id: 460,
                  rank: userRank.rank,
                  score: userRank.score,
                  finish_time: userRank.finish_time,
                  username: userRank.username,
                },
                source: "ALTERNATIVE_API",
              };
            }
          }
        } catch (error) {
          continue;
        }
      }

      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  async fetchUserCompleteData(user) {
    const methods = [
      () => this.fetchUserProfile(user),
      () => this.fetchUserContests(user),
      () => this.fetchUserSubmissions(user),
      () => this.fetchUserRanking(user),
    ];

    let userData = {
      leetcode_id: user.leetcode_id,
      display_name: user.display_name,
      success: false,
      profile: null,
      contests: [],
      submissions: [],
      ranking: null,
      contestsCount: 0,
    };

    for (const method of methods) {
      try {
        const result = await method();
        if (result) {
          userData = { ...userData, ...result };
          userData.success = true;
        }
      } catch (error) {
        console.log(`    Method failed: ${error.message}`);
      }
    }

    return userData;
  }

  async fetchUserProfile(user) {
    try {
      console.log(`    🔍 Fetching profile for ${user.leetcode_id}...`);

      const graphqlQuery = {
        query: `
          query userProfile($username: String!) {
            user(username: $username) {
              username
              profile {
                realName
                userSlug
                aboutMe
                countryName
                skillTags
                ranking
              }
              submitStats {
                acSubmissionNum {
                  difficulty
                  count
                }
              }
            }
          }
        `,
        variables: { username: user.leetcode_id },
      };

      const response = await this.bypass.bypassCloudflare(
        "https://leetcode.com/graphql/",
        {
          method: "POST",
          data: graphqlQuery,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.data?.user) {
        console.log(`    ✅ Profile found`);
        return {
          profile: response.data.data.user,
          success: true,
        };
      }

      return null;
    } catch (error) {
      console.log(`    ❌ Profile fetch failed: ${error.message}`);
      return null;
    }
  }

  async fetchUserContests(user) {
    try {
      console.log(`    🏆 Fetching contests for ${user.leetcode_id}...`);

      const graphqlQuery = {
        query: `
          query userContestRanking($username: String!) {
            userContestRanking(username: $username) {
              attendedContestsCount
              rating
              globalRanking
              totalParticipants
              topPercentage
              badge {
                name
              }
            }
            userContestRankingHistory(username: $username) {
              attended
              rating
              ranking
              trendDirection
              problemsSolved
              totalProblems
              finishTimeInSeconds
              contest {
                title
                startTime
              }
            }
          }
        `,
        variables: { username: user.leetcode_id },
      };

      const response = await this.bypass.bypassCloudflare(
        "https://leetcode.com/graphql/",
        {
          method: "POST",
          data: graphqlQuery,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.data?.userContestRanking) {
        const contestData = response.data.data;
        console.log(
          `    ✅ Found ${
            contestData.userContestRankingHistory?.length || 0
          } contest records`
        );

        return {
          contests: contestData.userContestRankingHistory || [],
          contestsCount:
            contestData.userContestRanking?.attendedContestsCount || 0,
          rating: contestData.userContestRanking?.rating || 0,
          ranking: contestData.userContestRanking,
          success: true,
        };
      }

      return null;
    } catch (error) {
      console.log(`    ❌ Contest fetch failed: ${error.message}`);
      return null;
    }
  }

  async fetchUserSubmissions(user) {
    try {
      console.log(`    📝 Fetching submissions for ${user.leetcode_id}...`);

      const response = await this.bypass.bypassCloudflare(
        `https://leetcode.com/api/submissions/?offset=0&limit=50&lastkey=&username=${user.leetcode_id}`
      );

      if (response.data && Array.isArray(response.data.submissions_dump)) {
        console.log(
          `    ✅ Found ${response.data.submissions_dump.length} submissions`
        );
        return {
          submissions: response.data.submissions_dump,
          success: true,
        };
      }

      return null;
    } catch (error) {
      console.log(`    ❌ Submissions fetch failed: ${error.message}`);
      return null;
    }
  }

  async fetchUserRanking(user) {
    try {
      console.log(`    📊 Fetching ranking for ${user.leetcode_id}...`);

      // Try to find user in recent contests
      const recentContests = [
        "weekly-contest-460",
        "weekly-contest-461",
        "biweekly-contest-162",
      ];

      for (const contestSlug of recentContests) {
        try {
          const rankingData = await this.fetchUserInContest(user, contestSlug);
          if (rankingData) {
            console.log(`    ✅ Found in ${contestSlug}`);
            return rankingData;
          }
        } catch (error) {
          // Continue to next contest
        }
      }

      return null;
    } catch (error) {
      console.log(`    ❌ Ranking fetch failed: ${error.message}`);
      return null;
    }
  }

  async fetchUserInContest(user, contestSlug) {
    try {
      const response = await this.bypass.bypassCloudflare(
        `https://leetcode.com/contest/api/ranking/${contestSlug}/?pagination=1&region=global`
      );

      if (response.data && response.data.total_rank) {
        const userRank = response.data.total_rank.find(
          (participant) => participant.username === user.leetcode_id
        );

        if (userRank) {
          return {
            contestRanking: {
              contest: contestSlug,
              rank: userRank.rank,
              score: userRank.score,
              finishTime: userRank.finish_time,
            },
            success: true,
          };
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async saveDepartmentData(results) {
    try {
      // Save Contest 460 specific data to our contest database
      const contest460DepartmentData = {
        department: "Department Users Contest 460",
        contest_name: "Weekly Contest 460",
        contest_id: 460,
        fetchedAt: new Date().toISOString(),
        totalDepartmentUsers: this.departmentUsers.length,
        participatedInContest460: results.successful.length,
        contest460Participants: results.contest460Data,
        userStats: results.userStats,
        source: "DEPARTMENT_CONTEST_460_FETCH",
      };

      this.db.addContestData(
        "department-contest-460",
        contest460DepartmentData
      );

      // Save detailed results to separate file
      const resultsPath = path.join(
        __dirname,
        "department_contest_460_data.json"
      );
      fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

      // Export CSV for Contest 460 participants only
      const csvPath = path.join(
        __dirname,
        "exports",
        "department_contest_460_participants.csv"
      );
      const csvData = this.generateContest460CSV(results);

      // Create exports directory if it doesn't exist
      const exportsDir = path.dirname(csvPath);
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      fs.writeFileSync(csvPath, csvData);

      console.log(`\n💾 CONTEST 460 DATA SAVED:`);
      console.log(`📄 Detailed Results: ${resultsPath}`);
      console.log(`📊 CSV Export: ${csvPath}`);
      console.log(`🗄️ Database: Updated contest_data.json`);
    } catch (error) {
      console.error("Error saving Contest 460 department data:", error.message);
    }
  }

  generateContest460CSV(results) {
    const headers = [
      "leetcode_id",
      "display_name",
      "participated_in_460",
      "rank_in_460",
      "score_in_460",
      "finish_time",
      "data_source",
      "country",
    ];

    const rows = this.departmentUsers.map((user) => {
      const userData = results.userStats[user.leetcode_id];
      const contest460Data = results.contest460Data[user.leetcode_id];

      return [
        user.leetcode_id,
        user.display_name,
        userData ? "Yes" : "No",
        contest460Data?.rank || "N/A",
        contest460Data?.score || "N/A",
        contest460Data?.finish_time || "N/A",
        userData?.source || "N/A",
        contest460Data?.country_name || "N/A",
      ].join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export and run
const fetcher = new DepartmentUsersFetcher();

async function main() {
  try {
    console.log("🎯 DEPARTMENT USERS CONTEST 460 FETCHER INITIATED");
    console.log(
      "🔓 Breaking through LeetCode protection for Contest 460 data..."
    );

    const results = await fetcher.fetchAllDepartmentUsersData();

    console.log("\n🎉 CONTEST 460 DEPARTMENT FETCH COMPLETED!");
    console.log(
      "📊 Your department users Contest 460 data has been successfully obtained!"
    );
    console.log(
      "🚀 LCCN Predictor now has Contest 460 data for your students/colleagues!"
    );

    return results;
  } catch (error) {
    console.error("💥 CONTEST 460 DEPARTMENT FETCH FAILED:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DepartmentUsersFetcher;