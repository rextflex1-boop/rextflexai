// Lets the AI commit generated files directly to a configured GitHub repo,
// using the GitHub REST "contents" API (one file per commit — simple and
// reliable, though multiple files in one request means multiple commits
// rather than a single atomic one).
//
// Required env vars (set in Railway):
//   GITHUB_TOKEN        - a Personal Access Token with "repo" scope (classic)
//                          or "Contents: Read and write" (fine-grained),
//                          scoped to the one repo below.
//                          Create one at https://github.com/settings/tokens
//   GITHUB_REPO_OWNER   - e.g. "rextflex1-boop"
//   GITHUB_REPO_NAME    - e.g. "rextflexai"
//   GITHUB_REPO_BRANCH  - optional, defaults to "main"

const GITHUB_API_BASE = "https://api.github.com";

export type GithubPushResult =
  | {
      readonly ok: true;
      readonly commitUrl: string;
      readonly pushedPaths: readonly string[];
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export async function pushFilesToGithub({
  branch,
  commitMessage,
  files,
}: {
  readonly branch?: string;
  readonly commitMessage: string;
  readonly files: readonly { path: string; content: string }[];
}): Promise<GithubPushResult> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  if (!token || !owner || !repo) {
    return {
      error:
        "GitHub push isn't configured on the server yet — set GITHUB_TOKEN, " +
        "GITHUB_REPO_OWNER, and GITHUB_REPO_NAME in the environment variables.",
      ok: false,
    };
  }

  const targetBranch = branch || process.env.GITHUB_REPO_BRANCH || "main";
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const pushedPaths: string[] = [];

  for (const file of files) {
    const cleanPath = file.path.replace(/^\/+/, "");
    const contentsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(cleanPath).replace(/%2F/g, "/")}`;

    let existingSha: string | undefined;
    try {
      const existing = await fetch(`${contentsUrl}?ref=${encodeURIComponent(targetBranch)}`, { headers });
      if (existing.ok) {
        const data = (await existing.json()) as { sha?: string };
        existingSha = data.sha;
      } else if (existing.status !== 404) {
        const body = await existing.text().catch(() => "");
        return { error: `Couldn't check ${cleanPath} on GitHub (${existing.status}): ${truncate(body, 300)}`, ok: false };
      }
    } catch (error) {
      return { error: `Network error checking ${cleanPath}: ${errorMessage(error)}`, ok: false };
    }

    try {
      const putResponse = await fetch(contentsUrl, {
        body: JSON.stringify({
          branch: targetBranch,
          content: Buffer.from(file.content, "utf-8").toString("base64"),
          message: commitMessage,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
        headers: { ...headers, "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!putResponse.ok) {
        const body = await putResponse.text().catch(() => "");
        return {
          error: `GitHub rejected the commit for ${cleanPath} (${putResponse.status}): ${truncate(body, 300)}`,
          ok: false,
        };
      }
      pushedPaths.push(cleanPath);
    } catch (error) {
      return { error: `Network error pushing ${cleanPath}: ${errorMessage(error)}`, ok: false };
    }
  }

  return {
    commitUrl: `https://github.com/${owner}/${repo}/tree/${targetBranch}`,
    ok: true,
    pushedPaths,
  };
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
