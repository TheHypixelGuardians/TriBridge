#!/usr/bin/env node
/**
 * One-off migration: wiki/*.md → site/*.mdx for Mintlify.
 * Run from repository root: node scripts/migrate-wiki-to-mintlify.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WIKI_DIR = path.join(ROOT, "wiki");
const SITE_DIR = path.join(ROOT, "site");

const REPO = "TheHypixelGuardians/TriBridge";

/** wiki basename (no .md) → Mintlify page slug */
const PAGE_SLUGS = {
  Home: "index",
  "Using-the-Bridge": "using-the-bridge",
  "Guild-Tags": "guild-tags",
  "Account-Linking": "account-linking",
  Networth: "networth",
  "Feature-Requests": "feature-requests",
  Commands: "commands",
  Installation: "installation",
  Configuration: "configuration",
  "Config-Files": "config-files",
  Permissions: "permissions",
  Updating: "updating",
  "Hypixel-Guilds": "hypixel-guilds",
  "Guild-to-Guild-Bridging": "guild-to-guild-bridging",
  "Officer-Chat": "officer-chat",
  Reconnection: "reconnection",
  "Admin-Roles": "admin-roles",
  "Admin-Panel": "admin-panel",
  "Global-Profile-Change": "global-profile-change",
  Auditing: "auditing",
  "Link-Role": "link-role",
  FAQ: "faq",
  Troubleshooting: "troubleshooting",
  Architecture: "architecture",
  "Adding-a-Command": "adding-a-command",
  Releasing: "releasing",
  Contributing: "contributing",
};

/** First paragraph summaries for frontmatter descriptions */
const DESCRIPTIONS = {
  index:
    "TriBridge bridges Discord and Hypixel guild chat — start here for members and hosts.",
  "using-the-bridge":
    "How the bridge channel works for guild members in Discord.",
  "guild-tags": "Target one Hypixel guild with !tag prefixes in the bridge channel.",
  "account-linking":
    "Link your Discord account to your Minecraft name for relay attribution.",
  networth: "Look up SkyBlock networth from chat or slash commands.",
  "feature-requests": "Submit and track feature requests with /request.",
  commands: "Every slash command and chat command TriBridge supports.",
  installation: "Install TriBridge and connect your first Hypixel guild.",
  configuration: "Environment variables and first-run setup.",
  "config-files": "Runtime config files the bot writes beside the repository.",
  permissions: "Discord permissions and intents required by TriBridge.",
  updating: "Pull updates, reinstall dependencies, and restart the bot.",
  "hypixel-guilds": "Register and manage Hypixel guilds with /guilds.",
  "guild-to-guild-bridging":
    "Share guild chat directly between bridged Hypixel guilds in-game.",
  "officer-chat": "Two-way officer chat between Discord and Hypixel.",
  reconnection: "How dropped Minecraft accounts reconnect automatically.",
  "admin-roles": "Configure which Discord roles hold bot-admin access.",
  "admin-panel": "Use /adminpanel to toggle admin features from Discord.",
  "global-profile-change":
    "Temporarily disguise everyone's messages as one member.",
  auditing: "Audit trail for disguised messages with jump links.",
  "link-role": "Optional Discord role handed out to linked users.",
  faq: "Common questions about using TriBridge.",
  troubleshooting: "Fix bridge, relay, and connection problems.",
  architecture: "How Discord, mineflayer, and the guild registry fit together.",
  "adding-a-command": "Checklist for shipping a new slash command.",
  releasing: "Changelogs, version bumps, and the release workflow.",
  contributing: "Commit conventions and what makes a good change.",
};

function wikiBasenameToSlug(basename) {
  if (PAGE_SLUGS[basename]) return PAGE_SLUGS[basename];
  return basename
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function titleFromBasename(basename) {
  if (basename === "Home") return "TriBridge";
  if (basename === "FAQ") return "FAQ";
  return basename.replace(/-/g, " ");
}

function fixRepoLinks(content) {
  return content
    .replace(/github\.com\/Trilleo\/TriBridge/g, `github.com/${REPO}`)
    .replace(
      /https:\/\/github\.com\/[^/]+\/TriBridge\/wiki\/([A-Za-z0-9-]+)/g,
      (_, page) => `/${wikiBasenameToSlug(page)}`,
    );
}

function fixWikiLinks(content) {
  return content.replace(
    /\[([^\]]+)\]\(([A-Za-z][A-Za-z0-9-]*)\)/g,
    (match, text, target) => {
      if (!PAGE_SLUGS[target] && !target.includes("-")) {
        return match;
      }
      const slug = wikiBasenameToSlug(target);
      return `[${text}](/${slug})`;
    },
  );
}

/**
 * MDX treats <word> as JSX. Escape placeholder-like angle brackets outside
 * fenced and inline code.
 */
function escapeMdxAngleBrackets(content) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      const inlineParts = part.split(/(`[^`]*`)/g);
      return inlineParts
        .map((segment, j) => {
          if (j % 2 === 1) return segment;
          return segment.replace(/<([^>\n]+)>/g, (m, inner) => {
            if (inner.startsWith("/")) return m;
            if (/^!?[A-Za-z][\w|.\\-]*$/.test(inner)) {
              return `\`<${inner}>\``;
            }
            if (/^(your |a |an |the )/i.test(inner) || inner.includes(" ")) {
              return `\`<${inner}>\``;
            }
            return m;
          });
        })
        .join("");
    })
    .join("");
}

function stripLeadingH1(content, title) {
  const lines = content.split("\n");
  if (lines[0]?.startsWith("# ")) {
    const h1 = lines[0].slice(2).trim().toLowerCase();
    const normalizedTitle = title.toLowerCase();
    if (
      h1 === normalizedTitle ||
      h1.replace(/-/g, " ") === normalizedTitle.replace(/-/g, " ")
    ) {
      lines.shift();
      if (lines[0] === "") lines.shift();
    }
  }
  return lines.join("\n");
}

function extractDescription(content, slug) {
  if (DESCRIPTIONS[slug]) return DESCRIPTIONS[slug];
  const paragraph = content
    .split("\n\n")
    .map((p) => p.replace(/^#+\s+.*\n?/, "").trim())
    .find((p) => p && !p.startsWith("|") && !p.startsWith(">"));
  if (!paragraph) return "";
  return paragraph.replace(/\s+/g, " ").slice(0, 160);
}

function convertFile(basename) {
  const wikiPath = path.join(WIKI_DIR, `${basename}.md`);
  const slug = wikiBasenameToSlug(basename);
  const title = titleFromBasename(basename);
  let content = fs.readFileSync(wikiPath, "utf8");

  content = fixRepoLinks(content);
  content = fixWikiLinks(content);
  content = stripLeadingH1(content, title);
  content = escapeMdxAngleBrackets(content);
  content = content.trimEnd() + "\n";

  const description = extractDescription(content, slug);
  const frontmatter = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `description: "${description.replace(/"/g, '\\"')}"`,
    "---",
    "",
  ].join("\n");

  const outName = slug === "index" ? "index.mdx" : `${slug}.mdx`;
  fs.writeFileSync(path.join(SITE_DIR, outName), frontmatter + content);
  return slug;
}

function main() {
  fs.mkdirSync(SITE_DIR, { recursive: true });

  const wikiFiles = fs
    .readdirSync(WIKI_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"));

  for (const file of wikiFiles) {
    const basename = file.replace(/\.md$/, "");
    convertFile(basename);
    console.log(`Converted ${file} → site/${wikiBasenameToSlug(basename)}.mdx`);
  }
}

main();
