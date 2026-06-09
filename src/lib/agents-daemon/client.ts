import "server-only";

import {
  DEFAULT_AGENTS_DAEMON_REQUEST_TIMEOUT_MS,
  getAgentsDaemonConfig,
  type AgentsDaemonConfigResult,
} from "./config";
import {
  buildAgentsDaemonGenerateGuideRequestBody,
  buildAgentsDaemonUrl,
  parseAgentsDaemonGenerateGuideResult,
  parseAgentsDaemonHealth,
  parseAgentsDaemonMeta,
  type AgentsDaemonGenerateGuideInput,
  type AgentsDaemonGenerateGuideResult,
  type AgentsDaemonHealth,
  type AgentsDaemonMeta,
} from "./protocol";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type AgentsDaemonClientOptions = {
  apiToken: string;
  baseUrl: string;
  fetch?: FetchLike;
  requestTimeoutMs?: number;
};

export type AgentsDaemonClientErrorCode = "daemon-error" | "invalid-response" | "network-error";

export class AgentsDaemonClientError extends Error {
  constructor(
    public readonly code: AgentsDaemonClientErrorCode,
    message: string,
    public readonly details: { cause?: unknown; status?: number } = {},
  ) {
    super(message);
    this.name = "AgentsDaemonClientError";
  }
}

export type AgentsDaemonConnectionState =
  | "connected"
  | "invalid-base-url"
  | "invalid-default-provider"
  | "missing-base-url"
  | "missing-default-model"
  | "missing-default-provider"
  | "missing-token"
  | "auth-failed"
  | "unreachable"
  | "invalid-response"
  | "daemon-error";

export type AgentsDaemonConnectionResult = {
  baseUrl: string | null;
  health: AgentsDaemonHealth | null;
  message: string;
  meta: AgentsDaemonMeta | null;
  ok: boolean;
  state: AgentsDaemonConnectionState;
};

export class AgentsDaemonClient {
  private readonly fetchImpl: FetchLike;
  private readonly requestTimeoutMs: number;

  constructor(private readonly options: AgentsDaemonClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_AGENTS_DAEMON_REQUEST_TIMEOUT_MS;
  }

  async getHealth(): Promise<AgentsDaemonHealth> {
    return this.requestJson("/health", parseAgentsDaemonHealth);
  }

  async getMeta(): Promise<AgentsDaemonMeta> {
    return this.requestJson("/v0/meta", parseAgentsDaemonMeta, { authenticated: true });
  }

  async generateCodeReviewGuide(input: AgentsDaemonGenerateGuideInput): Promise<AgentsDaemonGenerateGuideResult> {
    return this.requestJson("/v0/code-review-guides/generate", parseAgentsDaemonGenerateGuideResult, {
      authenticated: true,
      body: buildAgentsDaemonGenerateGuideRequestBody(input),
      method: "POST",
    });
  }

  private async requestJson<T>(
    path: string,
    parse: (value: unknown) => T,
    options: { authenticated?: boolean; body?: unknown; method?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (options.authenticated) {
      headers.Authorization = `Bearer ${this.options.apiToken}`;
    }

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;

    const timeout = createRequestTimeout(this.requestTimeoutMs);

    try {
      response = await this.fetchImpl(buildAgentsDaemonUrl(this.options.baseUrl, path), {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers,
        method: options.method ?? "GET",
        signal: timeout.signal,
      });
    } catch (error) {
      const message = isAbortError(error)
        ? `agents-daemon request timed out after ${this.requestTimeoutMs}ms.`
        : "Could not reach agents-daemon.";

      throw new AgentsDaemonClientError("network-error", message, { cause: error });
    } finally {
      timeout.clear();
    }

    const payload = await readJsonResponse(response);

    if (!response.ok) {
      throw new AgentsDaemonClientError("daemon-error", daemonErrorMessage(payload, response.status), {
        status: response.status,
      });
    }

    try {
      return parse(payload);
    } catch (error) {
      throw new AgentsDaemonClientError("invalid-response", "agents-daemon returned an invalid response.", {
        cause: error,
        status: response.status,
      });
    }
  }
}

function createRequestTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms.`)), timeoutMs);

  return {
    clear: () => clearTimeout(timer),
    signal: controller.signal,
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.message.includes("timed out"));
}

export function createAgentsDaemonClient(config = getAgentsDaemonConfig()): AgentsDaemonClient {
  if (!config.ok) {
    throw new AgentsDaemonClientError("daemon-error", config.message);
  }

  return new AgentsDaemonClient(config.config);
}

export async function checkAgentsDaemonConnection(input: {
  config?: AgentsDaemonConfigResult;
  fetch?: FetchLike;
} = {}): Promise<AgentsDaemonConnectionResult> {
  const config = input.config ?? getAgentsDaemonConfig();

  if (!config.ok) {
    return {
      baseUrl: null,
      health: null,
      message: config.message,
      meta: null,
      ok: false,
      state: config.state,
    };
  }

  const client = new AgentsDaemonClient({ ...config.config, fetch: input.fetch });

  try {
    const health = await client.getHealth();
    const meta = await client.getMeta();

    return {
      baseUrl: config.config.baseUrl,
      health,
      message: "Connected to agents-daemon.",
      meta,
      ok: true,
      state: "connected",
    };
  } catch (error) {
    if (error instanceof AgentsDaemonClientError) {
      const state = stateForClientError(error);

      return {
        baseUrl: config.config.baseUrl,
        health: null,
        message: error.message,
        meta: null,
        ok: false,
        state,
      };
    }

    return {
      baseUrl: config.config.baseUrl,
      health: null,
      message: "Unexpected agents-daemon connection failure.",
      meta: null,
      ok: false,
      state: "daemon-error",
    };
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function daemonErrorMessage(payload: unknown, status: number) {
  if (typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  if (typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return `agents-daemon returned HTTP ${status}.`;
}

function stateForClientError(error: AgentsDaemonClientError): AgentsDaemonConnectionState {
  if (error.code === "network-error") return "unreachable";
  if (error.code === "invalid-response") return "invalid-response";
  if (error.details.status === 401 || error.details.status === 403) return "auth-failed";
  return "daemon-error";
}
