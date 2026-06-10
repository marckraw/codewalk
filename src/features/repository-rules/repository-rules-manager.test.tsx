import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RepositoryRulesManager } from './repository-rules-manager'

describe('RepositoryRulesManager', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('lists existing rules with allow/block labels', () => {
    render(
      <RepositoryRulesManager
        allowedOwner="ef-global"
        initialRules={[
          { id: 'rule-1', owner: 'acme', repo: 'widgets', rule: 'allow' },
          {
            id: 'rule-2',
            owner: 'ef-global',
            repo: 'noisy-repo',
            rule: 'block',
          },
        ]}
      />,
    )

    expect(screen.getByText('acme/widgets')).toBeInTheDocument()
    expect(screen.getByText('Allowed')).toBeInTheDocument()
    expect(
      screen.getByText('Outside ef-global — whitelisted for guided reviews'),
    ).toBeInTheDocument()
    expect(screen.getByText('ef-global/noisy-repo')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(
      screen.getByText('Overrides the ef-global org default'),
    ).toBeInTheDocument()
  })

  it('shows a validation error for unsupported input without calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    render(
      <RepositoryRulesManager allowedOwner="ef-global" initialRules={[]} />,
    )

    await userEvent.type(
      screen.getByLabelText('Repository'),
      'https://gitlab.com/acme/widgets',
    )
    await userEvent.click(screen.getByRole('button', { name: /Add rule/ }))

    expect(
      await screen.findByText('Only github.com repositories are supported.'),
    ).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('hints when an allow rule targets the default org', async () => {
    render(
      <RepositoryRulesManager allowedOwner="ef-global" initialRules={[]} />,
    )

    await userEvent.type(
      screen.getByLabelText('Repository'),
      'ef-global/design',
    )

    expect(
      await screen.findByText(
        'Repositories in ef-global are already reviewed by default — an allow rule is redundant.',
      ),
    ).toBeInTheDocument()
  })

  it('submits a new rule and prepends it to the list', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          rule: { id: 'rule-1', owner: 'acme', repo: 'widgets', rule: 'allow' },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        },
      ),
    )

    render(
      <RepositoryRulesManager allowedOwner="ef-global" initialRules={[]} />,
    )

    await userEvent.type(
      screen.getByLabelText('Repository'),
      'https://github.com/acme/widgets',
    )
    await userEvent.click(screen.getByRole('button', { name: /Add rule/ }))

    expect(await screen.findByText('acme/widgets')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/settings/repository-rules',
      expect.objectContaining({
        body: JSON.stringify({
          repository: 'https://github.com/acme/widgets',
          rule: 'allow',
        }),
        method: 'POST',
      }),
    )
  })

  it('removes a rule via the API', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'deleted' }), { status: 200 }),
      )

    render(
      <RepositoryRulesManager
        allowedOwner="ef-global"
        initialRules={[
          { id: 'rule-1', owner: 'acme', repo: 'widgets', rule: 'allow' },
        ]}
      />,
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove rule for acme/widgets' }),
    )

    expect(await screen.findByText('No repository rules')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/settings/repository-rules/rule-1',
      { method: 'DELETE' },
    )
  })
})
