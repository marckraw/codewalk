import type {
  CodeReviewCacheIdentity,
  CodeReviewGuideGenerator,
  CodeReviewGuideProvider,
  CodeReviewGuidePullRequestMetadata,
  CodeReviewGuideRiskLevel,
  CodeReviewGuideStatus,
  CodeReviewGuideSummary,
} from '@/entities/database'

export type AgentsDaemonHealth = {
  activeSessions: number
  apiVersion: string
  providers: Record<string, boolean>
  status: 'ok'
  uptime: number
  version: string
}

export type AgentsDaemonMeta = {
  apiVersion: string
  deployment: {
    mode: string
    sharedAcrossTeams: boolean
  }
  git: {
    githubAuthenticated: boolean
  }
  name: string
  providers: unknown[]
  runtime: {
    activeSessions: number
    host: string
    maxConcurrentAgents: number
    port: number
    uptimeSeconds: number
  }
  version: string
}

export type AgentsDaemonCodeReviewGuideFile = {
  path: string
  status: string
  reason: string
  hunkHints: string[]
}

export type AgentsDaemonCodeReviewGuideSection = {
  id: string
  title: string
  summary: string
  narrative: string
  riskLevel: CodeReviewGuideRiskLevel
  riskRationale: string
  checklist: string[]
  files: AgentsDaemonCodeReviewGuideFile[]
}

export type AgentsDaemonCodeReviewGuide = {
  id: string
  repository: string
  pullRequestNumber: number
  targetId: string
  mode: 'pull-request'
  cacheIdentity: CodeReviewCacheIdentity
  provider: CodeReviewGuideProvider
  model: string
  effort: string | null
  status: CodeReviewGuideStatus
  overview: string
  generatedBy: CodeReviewGuideGenerator
  sections: AgentsDaemonCodeReviewGuideSection[]
  error: string | null
  pullRequest: CodeReviewGuidePullRequestMetadata
  summary: CodeReviewGuideSummary
  createdAt: string
  updatedAt: string
}

export type AgentsDaemonGenerateGuideInput = {
  repository: string
  pullRequestNumber: number
  provider: CodeReviewGuideProvider
  model: string
  effort?: string | null
  force?: boolean
}

export type AgentsDaemonGenerateGuideRequestBody = {
  source: {
    repository: string
    pullRequest: {
      number: number
    }
  }
  provider: CodeReviewGuideProvider
  model: string
  effort?: string
  force?: boolean
}

export type AgentsDaemonGenerateGuideResult = {
  pullRequest: CodeReviewGuidePullRequestMetadata
  summary: CodeReviewGuideSummary
  guide: AgentsDaemonCodeReviewGuide
}

export type AgentsDaemonGuideJobStatus =
  | 'queued'
  | 'running'
  | 'ready'
  | 'failed'

export type AgentsDaemonGuideJobCallback = {
  url: string
  secret: string
}

export type AgentsDaemonSubmitGuideJobInput = AgentsDaemonGenerateGuideInput & {
  callback?: AgentsDaemonGuideJobCallback | null
}

export type AgentsDaemonGuideJobSubmitResult = {
  jobId: string
  status: AgentsDaemonGuideJobStatus
}

export type AgentsDaemonGuideJob = {
  jobId: string
  status: AgentsDaemonGuideJobStatus
  error: string | null
  result: AgentsDaemonGenerateGuideResult | null
}

export type AgentsDaemonBaseUrlResolution =
  | { ok: true; baseUrl: string }
  | { ok: false; reason: 'missing' | 'invalid' }

export function resolveAgentsDaemonBaseUrl(
  value: string | null | undefined,
): AgentsDaemonBaseUrlResolution {
  const trimmed = value?.trim() ?? ''

  if (!trimmed) {
    return { ok: false, reason: 'missing' }
  }

  try {
    const parsed = new URL(trimmed)

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, reason: 'invalid' }
    }

    parsed.hash = ''
    parsed.search = ''

    return { baseUrl: parsed.toString().replace(/\/+$/, ''), ok: true }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

export function buildAgentsDaemonUrl(baseUrl: string, path: string) {
  const resolved = resolveAgentsDaemonBaseUrl(baseUrl)

  if (!resolved.ok) {
    throw new Error(
      resolved.reason === 'missing'
        ? 'Agents daemon base URL is not configured.'
        : 'Agents daemon base URL must be an HTTP(S) URL.',
    )
  }

  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    throw new Error('Agents daemon endpoint path must be absolute.')
  }

  return new URL(path.replace(/^\/+/, ''), `${resolved.baseUrl}/`).toString()
}

export function buildAgentsDaemonGenerateGuideRequestBody(
  input: AgentsDaemonGenerateGuideInput,
): AgentsDaemonGenerateGuideRequestBody {
  const repository = input.repository.trim()
  const model = input.model.trim()
  const effort = input.effort?.trim()

  if (!repository) {
    throw new Error('Guided review generation requires a repository.')
  }

  if (
    !Number.isInteger(input.pullRequestNumber) ||
    input.pullRequestNumber < 1
  ) {
    throw new Error('Guided review generation requires a pull request number.')
  }

  if (!model) {
    throw new Error('Guided review generation requires a model.')
  }

  return {
    provider: input.provider,
    ...(effort ? { effort } : {}),
    ...(input.force === undefined ? {} : { force: input.force }),
    model,
    source: {
      pullRequest: {
        number: input.pullRequestNumber,
      },
      repository,
    },
  }
}

export function buildAgentsDaemonSubmitGuideJobRequestBody(
  input: AgentsDaemonSubmitGuideJobInput,
): AgentsDaemonGenerateGuideRequestBody & {
  callback?: AgentsDaemonGuideJobCallback
} {
  const callback = input.callback

  if (callback && (!callback.url.trim() || !callback.secret.trim())) {
    throw new Error('Guide job callbacks require both a url and a secret.')
  }

  return {
    ...buildAgentsDaemonGenerateGuideRequestBody(input),
    ...(callback ? { callback } : {}),
  }
}

export function parseAgentsDaemonGuideJobSubmitResult(
  value: unknown,
): AgentsDaemonGuideJobSubmitResult {
  const obj = requiredRecord(value, 'guide job submission')

  return {
    jobId: requireString(obj.jobId, 'jobId'),
    status: parseGuideJobStatus(obj.status),
  }
}

export function parseAgentsDaemonGuideJob(
  value: unknown,
): AgentsDaemonGuideJob {
  const obj = requiredRecord(value, 'guide job')
  const status = parseGuideJobStatus(obj.status)

  return {
    error: optionalString(obj.error, 'error'),
    jobId: requireString(obj.jobId, 'jobId'),
    result:
      obj.result === null || obj.result === undefined
        ? null
        : parseAgentsDaemonGenerateGuideResult(obj.result),
    status,
  }
}

function parseGuideJobStatus(value: unknown): AgentsDaemonGuideJobStatus {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'ready' ||
    value === 'failed'
  ) {
    return value
  }

  throw new Error('Invalid guide job status')
}

export function parseAgentsDaemonHealth(value: unknown): AgentsDaemonHealth {
  const obj = requiredRecord(value, 'daemon health')

  return {
    activeSessions: requireNumber(obj.activeSessions, 'activeSessions'),
    apiVersion: requireString(obj.apiVersion, 'apiVersion'),
    providers: parseBooleanRecord(obj.providers, 'providers'),
    status: requireLiteral(obj.status, 'ok', 'status'),
    uptime: requireNumber(obj.uptime, 'uptime'),
    version: requireString(obj.version, 'version'),
  }
}

export function parseAgentsDaemonMeta(value: unknown): AgentsDaemonMeta {
  const obj = requiredRecord(value, 'daemon metadata')
  const deployment = requiredRecord(obj.deployment, 'deployment')
  const git = requiredRecord(obj.git, 'git')
  const runtime = requiredRecord(obj.runtime, 'runtime')

  if (!Array.isArray(obj.providers)) {
    throw new Error('Invalid daemon metadata: providers')
  }

  return {
    apiVersion: requireString(obj.apiVersion, 'apiVersion'),
    deployment: {
      mode: requireString(deployment.mode, 'deployment.mode'),
      sharedAcrossTeams: requireBoolean(
        deployment.sharedAcrossTeams,
        'deployment.sharedAcrossTeams',
      ),
    },
    git: {
      githubAuthenticated: requireBoolean(
        git.githubAuthenticated,
        'git.githubAuthenticated',
      ),
    },
    name: requireString(obj.name, 'name'),
    providers: obj.providers,
    runtime: {
      activeSessions: requireNumber(
        runtime.activeSessions,
        'runtime.activeSessions',
      ),
      host: requireString(runtime.host, 'runtime.host'),
      maxConcurrentAgents: requireNumber(
        runtime.maxConcurrentAgents,
        'runtime.maxConcurrentAgents',
      ),
      port: requireNumber(runtime.port, 'runtime.port'),
      uptimeSeconds: requireNumber(
        runtime.uptimeSeconds,
        'runtime.uptimeSeconds',
      ),
    },
    version: requireString(obj.version, 'version'),
  }
}

export function parseAgentsDaemonGenerateGuideResult(
  value: unknown,
): AgentsDaemonGenerateGuideResult {
  const obj = requiredRecord(value, 'remote guide result')

  return {
    guide: parseGuide(obj.guide),
    pullRequest: parsePullRequest(obj.pullRequest),
    summary: parseSummary(obj.summary),
  }
}

function parseGuide(value: unknown): AgentsDaemonCodeReviewGuide {
  const obj = requiredRecord(value, 'guide')

  return {
    cacheIdentity: parseCacheIdentity(obj.cacheIdentity),
    createdAt: requireString(obj.createdAt, 'guide.createdAt'),
    effort: optionalString(obj.effort, 'guide.effort'),
    error: optionalString(obj.error, 'guide.error'),
    generatedBy: parseGenerator(obj.generatedBy),
    id: requireString(obj.id, 'guide.id'),
    mode: requireLiteral(obj.mode, 'pull-request', 'guide.mode'),
    model: requireString(obj.model, 'guide.model'),
    overview: requireString(obj.overview, 'guide.overview'),
    provider: parseProvider(obj.provider),
    pullRequest: parsePullRequest(obj.pullRequest),
    pullRequestNumber: requireNumber(
      obj.pullRequestNumber,
      'guide.pullRequestNumber',
    ),
    repository: requireString(obj.repository, 'guide.repository'),
    sections: parseSections(obj.sections),
    status: parseStatus(obj.status),
    summary: parseSummary(obj.summary),
    targetId: requireString(obj.targetId, 'guide.targetId'),
    updatedAt: requireString(obj.updatedAt, 'guide.updatedAt'),
  }
}

function parsePullRequest(value: unknown): CodeReviewGuidePullRequestMetadata {
  const obj = requiredRecord(value, 'pullRequest')
  const state = obj.state

  if (
    state !== 'open' &&
    state !== 'closed' &&
    state !== 'merged' &&
    state !== 'unknown'
  ) {
    throw new Error('Invalid pullRequest.state')
  }

  return {
    baseBranch: requireString(obj.baseBranch, 'pullRequest.baseBranch'),
    headBranch: requireString(obj.headBranch, 'pullRequest.headBranch'),
    headRepositoryName: optionalString(
      obj.headRepositoryName,
      'pullRequest.headRepositoryName',
    ),
    headRepositoryOwner: optionalString(
      obj.headRepositoryOwner,
      'pullRequest.headRepositoryOwner',
    ),
    number: requireNumber(obj.number, 'pullRequest.number'),
    provider: requireLiteral(obj.provider, 'github', 'pullRequest.provider'),
    repositoryName: requireString(
      obj.repositoryName,
      'pullRequest.repositoryName',
    ),
    repositoryOwner: requireString(
      obj.repositoryOwner,
      'pullRequest.repositoryOwner',
    ),
    state,
    title: optionalString(obj.title, 'pullRequest.title'),
    url: requireString(obj.url, 'pullRequest.url'),
  }
}

function parseSummary(value: unknown): CodeReviewGuideSummary {
  const obj = requiredRecord(value, 'summary')

  return {
    cacheIdentity: parseCacheIdentity(obj.cacheIdentity),
    files: parseFileEntries(obj.files),
  }
}

function parseCacheIdentity(value: unknown): CodeReviewCacheIdentity {
  const obj = requiredRecord(value, 'cacheIdentity')

  return {
    comparisonPoint: optionalString(
      obj.comparisonPoint,
      'cacheIdentity.comparisonPoint',
    ),
    comparisonRef: optionalString(
      obj.comparisonRef,
      'cacheIdentity.comparisonRef',
    ),
    workingTreeVersionToken: requireString(
      obj.workingTreeVersionToken,
      'cacheIdentity.workingTreeVersionToken',
    ),
  }
}

function parseSections(value: unknown): AgentsDaemonCodeReviewGuideSection[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid guide sections')
  }

  return value.map((item, index) => {
    const obj = requiredRecord(item, `sections.${index}`)

    return {
      checklist: parseStringArray(obj.checklist, `sections.${index}.checklist`),
      files: parseGuideFiles(obj.files, `sections.${index}.files`),
      id: requireString(obj.id, `sections.${index}.id`),
      narrative: requireString(obj.narrative, `sections.${index}.narrative`),
      riskLevel: parseRiskLevel(obj.riskLevel, `sections.${index}.riskLevel`),
      riskRationale: requireString(
        obj.riskRationale,
        `sections.${index}.riskRationale`,
      ),
      summary: requireString(obj.summary, `sections.${index}.summary`),
      title: requireString(obj.title, `sections.${index}.title`),
    }
  })
}

function parseGuideFiles(
  value: unknown,
  field: string,
): AgentsDaemonCodeReviewGuideFile[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${field}`)
  }

  return value.map((item, index) => {
    const obj = requiredRecord(item, `${field}.${index}`)

    return {
      hunkHints: parseStringArray(obj.hunkHints, `${field}.${index}.hunkHints`),
      path: requireString(obj.path, `${field}.${index}.path`),
      reason: requireString(obj.reason, `${field}.${index}.reason`),
      status: requireString(obj.status, `${field}.${index}.status`),
    }
  })
}

function parseFileEntries(value: unknown): CodeReviewGuideSummary['files'] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid summary files')
  }

  return value.map((item, index) => {
    const obj = requiredRecord(item, `summary.files.${index}`)
    const previousFile = optionalString(
      obj.previousFile,
      `summary.files.${index}.previousFile`,
    )

    return {
      file: requireString(obj.file, `summary.files.${index}.file`),
      ...(previousFile ? { previousFile } : {}),
      status: requireString(obj.status, `summary.files.${index}.status`),
    }
  })
}

function parseProvider(value: unknown): CodeReviewGuideProvider {
  if (
    value === 'claude' ||
    value === 'codex' ||
    value === 'cursor' ||
    value === 'gemini'
  ) {
    return value
  }

  throw new Error('Invalid guide.provider')
}

function parseStatus(value: unknown): CodeReviewGuideStatus {
  if (value === 'ready' || value === 'failed') return value
  throw new Error('Invalid guide.status')
}

function parseGenerator(value: unknown): CodeReviewGuideGenerator {
  if (value === 'deterministic' || value === 'agent') return value
  throw new Error('Invalid guide.generatedBy')
}

function parseRiskLevel(
  value: unknown,
  field: string,
): CodeReviewGuideRiskLevel {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  throw new Error(`Invalid ${field}`)
}

function parseBooleanRecord(
  value: unknown,
  field: string,
): Record<string, boolean> {
  const obj = requiredRecord(value, field)

  return Object.fromEntries(
    Object.entries(obj).map(([key, item]) => {
      if (typeof item !== 'boolean') {
        throw new Error(`Invalid ${field}.${key}`)
      }

      return [key, item]
    }),
  )
}

function parseStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${field}`)
  }

  return value.map((item, index) => {
    if (typeof item !== 'string') {
      throw new Error(`Invalid ${field}.${index}`)
    }

    return item
  })
}

function requiredRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  throw new Error(`Invalid ${field}`)
}

function requireString(value: unknown, field: string): string {
  if (typeof value === 'string') return value
  throw new Error(`Invalid ${field}`)
}

function optionalString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  throw new Error(`Invalid ${field}`)
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  throw new Error(`Invalid ${field}`)
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value === 'boolean') return value
  throw new Error(`Invalid ${field}`)
}

function requireLiteral<T extends string>(
  value: unknown,
  expected: T,
  field: string,
): T {
  if (value === expected) return expected
  throw new Error(`Invalid ${field}`)
}
