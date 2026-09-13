#!/usr/bin/env node
/**
 * Move flat site/*.mdx → site/tribridge/ and prefix internal Mintlify links.
 * Run from repository root after wiki migration or when refreshing tribridge pages.
 */

const fs = require("fs");
const path = require("path");

const SITE = path.join(__dirname, "..", "site");
const TRIBRIDGE = path.join(SITE, "tribridge");

const TRIBRIDGE_SLUGS = new Set([
  "index",
  "using-the-bridge",
  "guild-tags",
  "account-linking",
  "networth",
  "feature-requests",
  "commands",
  "installation",
  "configuration",
  "config-files",
  "permissions",
  "updating",
  "hypixel-guilds",
  "guild-to-guild-bridging",
  "officer-chat",
  "reconnection",
  "admin-roles",
  "admin-panel",
  "global-profile-change",
  "auditing",
  "link-role",
  "faq",
  "troubleshooting",
  "architecture",
  "adding-a-command",
  "releasing",
  "contributing",
]);

function prefixTribridgeLinks(content) {
  return content.replace(/\]\(\/([a-z0-9-]+)\)/g, (match, slug) => {
    if (!TRIBRIDGE_SLUGS.has(slug)) return match;
    if (slug === "index") return "](/tribridge)";
    return `](/tribridge/${slug})`;
  });
}

function main() {
  fs.mkdirSync(TRIBRIDGE, { recursive: true });

  for (const file of fs.readdirSync(SITE)) {
    if (!file.endsWith(".mdx") || file === "index.mdx") continue;
    const from = path.join(SITE, file);
    const to = path.join(TRIBRIDGE, file);
    let content = fs.readFileSync(from, "utf8");
    content = prefixTribridgeLinks(content);
    fs.writeFileSync(to, content);
    fs.unlinkSync(from);
    console.log(`Moved ${file} → tribridge/${file}`);
  }

  const rootIndex = path.join(SITE, "index.mdx");
  if (fs.existsSync(rootIndex)) {
    let content = fs.readFileSync(rootIndex, "utf8");
    content = prefixTribridgeLinks(content);
    fs.writeFileSync(path.join(TRIBRIDGE, "index.mdx"), content);
    fs.unlinkSync(rootIndex);
    console.log("Moved index.mdx → tribridge/index.mdx");
  }
}

main();
