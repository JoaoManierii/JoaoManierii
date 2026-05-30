import fs from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
const username = process.env.GITHUB_USERNAME || "JoaoManierii";

if (!token) {
  throw new Error("GITHUB_TOKEN is required");
}

const query = `
  query($login: String!) {
    user(login: $login) {
      login
      contributionsCollection {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
        repositoryContributions(first: 1) {
          totalCount
        }
      }
      repositories(ownerAffiliations: OWNER, privacy: PUBLIC) {
        totalCount
      }
      followers {
        totalCount
      }
      following {
        totalCount
      }
    }
  }
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ query, variables: { login: username } }),
});

if (!response.ok) {
  throw new Error(`GitHub GraphQL failed: ${response.status} ${await response.text()}`);
}

const payload = await response.json();
if (payload.errors?.length) {
  throw new Error(JSON.stringify(payload.errors, null, 2));
}

const user = payload.data.user;
if (!user) {
  throw new Error(`GitHub user not found: ${username}`);
}

const contributions = user.contributionsCollection;
const cards = [
  ["Commits", contributions.totalCommitContributions],
  ["Pull requests", contributions.totalPullRequestContributions],
  ["Issues", contributions.totalIssueContributions],
  ["Reviews", contributions.totalPullRequestReviewContributions],
  ["Contributed to", contributions.repositoryContributions.totalCount],
  ["Private contribs", contributions.restrictedContributionsCount],
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function renderSvg(theme) {
  const dark = theme === "dark";
  const colors = {
    background: dark ? "#0d1117" : "#ffffff",
    border: dark ? "#30363d" : "#d0d7de",
    title: dark ? "#f0f6fc" : "#24292f",
    text: dark ? "#8b949e" : "#57606a",
    accent: "#2f81f7",
    card: dark ? "#161b22" : "#f6f8fa",
  };

  const width = 760;
  const height = 210;
  const cardWidth = 220;
  const cardHeight = 58;
  const gap = 18;
  const left = 28;
  const top = 74;

  const cardMarkup = cards
    .map(([label, value], index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = left + col * (cardWidth + gap);
      const y = top + row * (cardHeight + gap);

      return `
        <g transform="translate(${x} ${y})">
          <rect width="${cardWidth}" height="${cardHeight}" rx="8" fill="${colors.card}" stroke="${colors.border}" />
          <text x="16" y="24" fill="${colors.text}" font-size="13">${escapeXml(label)}</text>
          <text x="16" y="47" fill="${colors.title}" font-size="22" font-weight="700">${formatNumber(value)}</text>
        </g>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} GitHub stats</title>
  <desc id="desc">GitHub contribution stats generated from the GitHub GraphQL API.</desc>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${colors.background}" stroke="${colors.border}" />
  <text x="28" y="38" fill="${colors.title}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="22" font-weight="700">${escapeXml(username)} GitHub Stats</text>
  <text x="28" y="60" fill="${colors.text}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="13">Updated automatically by GitHub Actions</text>
  <circle cx="720" cy="38" r="8" fill="${colors.accent}" />
  <circle cx="696" cy="38" r="8" fill="#3fb950" />
  <g font-family="Segoe UI, Ubuntu, sans-serif">
    ${cardMarkup}
  </g>
</svg>
`;
}

await fs.mkdir("dist", { recursive: true });
await fs.writeFile("dist/github-stats.svg", renderSvg("light"));
await fs.writeFile("dist/github-stats-dark.svg", renderSvg("dark"));
