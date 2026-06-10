import "server-only";

import { getAgentsDaemonConfig, getAgentsDaemonRequestTimeoutMs } from "@/entities/agents-daemon";
import { getGitHubRequestTimeoutMs } from "@/entities/github-server";
import { getGitHubWebhookConfig } from "@/entities/github-server";

export type DeploymentDiagnostics = {
  agentsDaemon: {
    baseUrl: string | null;
    defaultModel: string | null;
    defaultProvider: string | null;
    missingKeys: string[];
    ok: boolean;
    state: string;
  };
  app: {
    baseUrl: string | null;
    ok: boolean;
    state: "configured" | "invalid-url" | "missing-url";
  };
  auth: {
    missingKeys: string[];
    ok: boolean;
  };
  database: {
    missingKeys: string[];
    ok: boolean;
  };
  github: {
    allowedOwner: string | null;
    missingKeys: string[];
    ok: boolean;
  };
  ok: boolean;
  runtime: {
    agentsDaemonRequestTimeoutMs: number;
    githubRequestTimeoutMs: number;
    nodeEnv: string | null;
    vercelEnv: string | null;
  };
};

export function getDeploymentDiagnostics(
  env: Record<string, string | undefined> = process.env,
): DeploymentDiagnostics {
  const app = getAppDiagnostics(env);
  const auth = getPresenceDiagnostics(env, ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]);
  const database = getPresenceDiagnostics(env, ["DATABASE_URL"]);
  const agentsDaemon = getAgentsDaemonDiagnostics(env);
  const github = getGitHubDiagnostics(env);

  return {
    agentsDaemon,
    app,
    auth,
    database,
    github,
    ok: app.ok && auth.ok && database.ok && agentsDaemon.ok && github.ok,
    runtime: {
      agentsDaemonRequestTimeoutMs: getAgentsDaemonRequestTimeoutMs(env),
      githubRequestTimeoutMs: getGitHubRequestTimeoutMs(env),
      nodeEnv: env.NODE_ENV ?? null,
      vercelEnv: env.VERCEL_ENV ?? null,
    },
  };
}

function getAppDiagnostics(env: Record<string, string | undefined>): DeploymentDiagnostics["app"] {
  const rawBaseUrl = env.NEXT_PUBLIC_APP_URL?.trim() ?? "";

  if (!rawBaseUrl) {
    return {
      baseUrl: null,
      ok: false,
      state: "missing-url",
    };
  }

  try {
    const url = new URL(rawBaseUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return {
        baseUrl: null,
        ok: false,
        state: "invalid-url",
      };
    }

    url.hash = "";
    url.search = "";

    return {
      baseUrl: url.toString().replace(/\/+$/, ""),
      ok: true,
      state: "configured",
    };
  } catch {
    return {
      baseUrl: null,
      ok: false,
      state: "invalid-url",
    };
  }
}

function getPresenceDiagnostics(env: Record<string, string | undefined>, keys: string[]) {
  const missingKeys = keys.filter((key) => !env[key]?.trim());

  return {
    missingKeys,
    ok: missingKeys.length === 0,
  };
}

function getAgentsDaemonDiagnostics(env: Record<string, string | undefined>): DeploymentDiagnostics["agentsDaemon"] {
  const config = getAgentsDaemonConfig(env);

  if (!config.ok) {
    return {
      baseUrl: null,
      defaultModel: null,
      defaultProvider: null,
      missingKeys: config.missingKeys,
      ok: false,
      state: config.state,
    };
  }

  return {
    baseUrl: config.config.baseUrl,
    defaultModel: config.config.defaultModel,
    defaultProvider: config.config.defaultProvider,
    missingKeys: [],
    ok: true,
    state: "configured",
  };
}

function getGitHubDiagnostics(env: Record<string, string | undefined>): DeploymentDiagnostics["github"] {
  const config = getGitHubWebhookConfig(env);

  if (!config.ok) {
    return {
      allowedOwner: null,
      missingKeys: config.missingKeys,
      ok: false,
    };
  }

  return {
    allowedOwner: config.allowedOwner,
    missingKeys: [],
    ok: true,
  };
}
