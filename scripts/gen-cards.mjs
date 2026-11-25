// Gera os cards de estatísticas com o token do dono (PAT_1), contando commits privados.
import fs from "node:fs";
import statsCard from "./github-readme-stats/api/index.js";
import langsCard from "./github-readme-stats/api/top-langs.js";

const run = async (handler, query, out) => {
  const res = { headers: {}, body: "", setHeader(k, v) { this.headers[k] = v; }, send(b) { this.body = b; } };
  await handler({ query }, res);
  if (!res.body.includes("<svg") || /Something went wrong/.test(res.body)) throw new Error(`falha ao gerar ${out}`);
  fs.mkdirSync("out", { recursive: true });
  fs.writeFileSync(`out/${out}`, res.body);
};

const base = { username: "artPerozin", theme: "tokyonight", hide_border: "true" };
await run(statsCard, { ...base, show_icons: "true", count_private: "true" }, "stats.svg");
await run(langsCard, { ...base, layout: "compact", langs_count: "8" }, "langs.svg");
