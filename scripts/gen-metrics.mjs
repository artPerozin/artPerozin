// Gera metrics.svg a partir da API do GitHub, via `gh` (precisa estar logado). Uso: node scripts/gen-metrics.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const query = `{viewer{login followers{totalCount}
  contributionsCollection{totalCommitContributions restrictedContributionsCount totalPullRequestReviewContributions}
  pullRequests{totalCount} issues{totalCount}
  repositories(ownerAffiliations:OWNER,isFork:false,first:100){nodes{stargazerCount
    languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}}}}}`;
const v = JSON.parse(execFileSync("gh", ["api", "graphql", "-f", `query=${query}`])).data.viewer;

const c = v.contributionsCollection;
const commits = c.totalCommitContributions + c.restrictedContributionsCount; // públicos + privados
const prs = v.pullRequests.totalCount, issues = v.issues.totalCount, reviews = c.totalPullRequestReviewContributions;
const stars = v.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
const followers = v.followers.totalCount;

// Nota: mesma fórmula do github-readme-stats (src/calculateRank.js), com commits no último ano (sem include_all_commits).
const exp = (x) => 1 - 2 ** -x, logn = (x) => x / (1 + x);
const W = { commits: 2, prs: 3, issues: 1, reviews: 1, stars: 4, followers: 1 };
const rank = 1 - (W.commits * exp(commits / 250) + W.prs * exp(prs / 50) + W.issues * exp(issues / 25) +
  W.reviews * exp(reviews / 2) + W.stars * logn(stars / 50) + W.followers * logn(followers / 10)) /
  Object.values(W).reduce((x, y) => x + y);
const percentile = rank * 100;
const LEVELS = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"];
const grade = LEVELS[[1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100].findIndex((t) => percentile <= t)];
const score = percentile.toFixed(1);

const IGNORAR = new Set(["HTML", "CSS"]); // markup/estilo, fora da lista
const bytes = {};
for (const r of v.repositories.nodes) for (const e of r.languages.edges) {
  if (IGNORAR.has(e.node.name)) continue;
  (bytes[e.node.name] ??= { size: 0, color: e.node.color || "#8b949e" }).size += e.size;
}
const total = Object.values(bytes).reduce((s, l) => s + l.size, 0);
const langs = Object.entries(bytes).sort((a, b) => b[1].size - a[1].size).slice(0, 6);

// Arco do anel: começa no topo e avança no sentido horário até (1 - rank) da volta.
const ang = Math.min(0.9999, 1 - rank) * 2 * Math.PI;
const arc = `M 80 88 A 42 42 0 ${ang > Math.PI ? 1 : 0} 1 ${(80 + 42 * Math.sin(ang)).toFixed(2)} ${(130 - 42 * Math.cos(ang)).toFixed(2)}`;
const esc = (s) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]);
const stats = [["Total Commits (last year)", commits], ["Total PRs", prs], ["Total Issues", issues], ["Total Stars Earned", stars], ["Followers", followers]];

const left = stats.map(([k, n], i) =>
  `<text x="150" y="${88 + i * 26}" class="k">${esc(k)}</text><text x="350" y="${88 + i * 26}" class="n" text-anchor="end">${n}</text>`).join("");
const right = langs.map(([name, l], i) => {
  const pct = (l.size / total) * 100, y = 70 + i * 32;
  return `<text x="400" y="${y}" class="k">${esc(name)}</text><text x="720" y="${y}" class="n" text-anchor="end">${pct.toFixed(1)}%</text>` +
    `<rect x="400" y="${y + 7}" width="320" height="6" rx="3" fill="#2f3549"/><rect x="400" y="${y + 7}" width="${Math.max(4, (pct / 100) * 320)}" height="6" rx="3" fill="${l.color}"/>`;
}).join("");

fs.writeFileSync("metrics.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="262" viewBox="0 0 760 262" role="img" aria-label="GitHub Stats: nota ${grade}">
<style>text{font-family:'Segoe UI',Ubuntu,Sans-Serif}.t{font-size:16px;font-weight:600;fill:#70a5fd}.k{font-size:13px;fill:#a9b1d6}.n{font-size:13px;font-weight:600;fill:#c0caf5}.g{font-size:44px;font-weight:700;fill:#70a5fd}.s{font-size:12px;fill:#787c99}</style>
<rect x=".5" y=".5" width="759" height="261" rx="8" fill="#1a1b27"/>
<text x="30" y="38" class="t">Arthur Perozin's GitHub Stats</text><text x="400" y="38" class="t">Most Used Languages</text>
<circle cx="80" cy="130" r="42" fill="none" stroke="#2f3549" stroke-width="6"/><path d="${arc}" fill="none" stroke="#70a5fd" stroke-width="6" stroke-linecap="round"/>
<text x="80" y="145" class="g" text-anchor="middle">${grade}</text>
<text x="80" y="200" class="s" text-anchor="middle">Top ${score}%</text>
${left}${right}
</svg>
`);
console.log({ commits, prs, issues, reviews, stars, followers, score, grade, langs: langs.map(([n, l]) => `${n} ${((l.size / total) * 100).toFixed(1)}%`) });
