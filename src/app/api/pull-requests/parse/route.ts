import { NextResponse } from 'next/server'
import { parseGitHubPullRequestUrl } from '@/entities/github'

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Request body must be JSON.' },
      { status: 400 },
    )
  }

  const url =
    typeof body === 'object' && body && 'url' in body ? body.url : null

  if (typeof url !== 'string') {
    return NextResponse.json(
      { error: 'A pull request URL is required.' },
      { status: 400 },
    )
  }

  const result = parseGitHubPullRequestUrl(url)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    pullRequest: result.pullRequest,
    status: 'parsed',
  })
}
