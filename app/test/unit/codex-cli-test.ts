import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  buildCodexCliCommitInTerminalInvocation,
  checkCodexCliAvailability,
  CodexCommitAndCommitPrompt,
  generateCommitMessageWithCodexCli,
} from '../../src/lib/codex-cli'
import { execFile } from '../../src/lib/exec-file'

type ExecResult = { stdout: string; stderr: string }
type ExecFileLike = (
  executable: string,
  args: ReadonlyArray<string>,
  _options: object
) => Promise<ExecResult>

function createMissingError() {
  const error = new Error('spawn ENOENT') as Error & { code?: string }
  error.code = 'ENOENT'
  return error
}

function createWindowsSandboxRefreshError() {
  return new Error(
    'execution error: Io(Custom { kind: Other, error: "windows sandbox: setup refresh failed with status exit code: 1" })'
  )
}

describe('buildCodexCliCommitInTerminalInvocation', () => {
  it('adds default approval and sandbox flags when not provided', () => {
    const invocation = buildCodexCliCommitInTerminalInvocation('codex')

    assert.equal(invocation.executable, 'codex')
    assert.deepEqual(invocation.args, [
      '--ask-for-approval',
      'never',
      '--sandbox',
      'workspace-write',
      'exec',
      CodexCommitAndCommitPrompt,
    ])
  })

  it('keeps explicitly configured approval and sandbox flags', () => {
    const invocation = buildCodexCliCommitInTerminalInvocation(
      'codex --ask-for-approval on-request --sandbox danger-full-access'
    )

    assert.equal(invocation.executable, 'codex')
    assert.deepEqual(invocation.args, [
      '--ask-for-approval',
      'on-request',
      '--sandbox',
      'danger-full-access',
      'exec',
      CodexCommitAndCommitPrompt,
    ])
  })

  it('ignores configured subcommands and forces exec for prompt mode', () => {
    const invocation =
      buildCodexCliCommitInTerminalInvocation('codex apply 12345')

    assert.equal(invocation.executable, 'codex')
    assert.deepEqual(invocation.args, [
      '--ask-for-approval',
      'never',
      '--sandbox',
      'workspace-write',
      'exec',
      CodexCommitAndCommitPrompt,
    ])
  })
})

describe('checkCodexCliAvailability', () => {
  it('falls back to cmd.exe on Windows when direct execution is missing', async () => {
    const calls: Array<{ executable: string; args: ReadonlyArray<string> }> = []
    const runExecFile: ExecFileLike = async (executable, args) => {
      calls.push({ executable, args })

      if (executable === 'codex') {
        throw createMissingError()
      }

      if (executable === 'cmd.exe') {
        return {
          stdout: 'codex-cli 1.2.3',
          stderr: '',
        }
      }

      throw new Error(`Unexpected executable: ${executable}`)
    }

    const result = await checkCodexCliAvailability('codex', {
      runExecFile: runExecFile as typeof execFile,
      platform: 'win32',
    })

    assert.equal(result.status, 'ready')
    assert.equal(result.version, 'codex-cli 1.2.3')
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[1], {
      executable: 'cmd.exe',
      args: ['/d', '/s', '/c', 'codex', '--version'],
    })
  })

  it('returns missing on Windows when cmd.exe reports command not found', async () => {
    const runExecFile: ExecFileLike = async executable => {
      if (executable === 'codex') {
        throw createMissingError()
      }

      const error = new Error('not found') as Error & {
        stderr?: string
        code?: number
      }
      error.code = 1
      error.stderr =
        "'codex' is not recognized as an internal or external command,\r\noperable program or batch file."
      throw error
    }

    const result = await checkCodexCliAvailability('codex', {
      runExecFile: runExecFile as typeof execFile,
      platform: 'win32',
    })

    assert.equal(result.status, 'missing')
  })

  it('returns missing when direct execution is not found on non-Windows', async () => {
    const runExecFile: ExecFileLike = async () => {
      throw createMissingError()
    }

    const result = await checkCodexCliAvailability('codex', {
      runExecFile: runExecFile as typeof execFile,
      platform: 'linux',
    })

    assert.equal(result.status, 'missing')
  })

  it('retries with unelevated Windows sandbox when setup refresh fails', async () => {
    const calls: Array<{ executable: string; args: ReadonlyArray<string> }> = []
    const runExecFile: ExecFileLike = async (executable, args) => {
      calls.push({ executable, args })
      if (
        executable === 'codex' &&
        !args.includes('windows.sandbox=unelevated')
      ) {
        throw createWindowsSandboxRefreshError()
      }

      return {
        stdout: 'codex-cli 1.2.3',
        stderr: '',
      }
    }

    const result = await checkCodexCliAvailability('codex', {
      runExecFile: runExecFile as typeof execFile,
      platform: 'win32',
    })

    assert.equal(result.status, 'ready')
    assert.equal(result.version, 'codex-cli 1.2.3')
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[1], {
      executable: 'codex',
      args: ['-c', 'windows.sandbox=unelevated', '--version'],
    })
  })
})

describe('generateCommitMessageWithCodexCli', () => {
  it('falls back to cmd.exe on Windows when direct codex execution is missing', async () => {
    const calls: Array<{ executable: string; args: ReadonlyArray<string> }> = []
    const runExecFile: ExecFileLike = async (executable, args) => {
      calls.push({ executable, args })

      if (executable === 'codex') {
        throw createMissingError()
      }

      if (executable === 'cmd.exe') {
        return {
          stdout: '{"title":"feat: test","description":"details"}',
          stderr: '',
        }
      }

      throw new Error(`Unexpected executable: ${executable}`)
    }

    const result = await generateCommitMessageWithCodexCli(
      'codex',
      process.cwd(),
      ['app/src/lib/codex-cli.ts'],
      null,
      {
        runExecFile: runExecFile as typeof execFile,
        platform: 'win32',
      }
    )

    assert.equal(result.title, 'feat: test')
    assert.equal(result.description, 'details')
    assert.equal(calls.length, 2)
    assert.equal(calls[1]?.executable, 'cmd.exe')
    assert.deepEqual(calls[1]?.args.slice(0, 9), [
      '/d',
      '/s',
      '/c',
      'codex',
      '--ask-for-approval',
      'never',
      '--sandbox',
      'workspace-write',
      'exec',
    ])
  })

  it('passes selected model to codex exec args', async () => {
    const calls: Array<{ executable: string; args: ReadonlyArray<string> }> = []
    const runExecFile: ExecFileLike = async (executable, args) => {
      calls.push({ executable, args })
      return {
        stdout: '{"title":"feat: test","description":"details"}',
        stderr: '',
      }
    }

    const result = await generateCommitMessageWithCodexCli(
      'codex',
      process.cwd(),
      ['app/src/lib/codex-cli.ts'],
      null,
      {
        runExecFile: runExecFile as typeof execFile,
        platform: 'win32',
      },
      'gpt-5.4-mini'
    )

    assert.equal(result.title, 'feat: test')
    assert.equal(result.description, 'details')

    const firstCall = calls[0]
    assert.ok(firstCall !== undefined)
    assert.ok(firstCall.args.includes('--model'))
    assert.ok(firstCall.args.includes('gpt-5.4-mini'))
  })

  it('retries with unelevated Windows sandbox when setup refresh fails', async () => {
    const calls: Array<{ executable: string; args: ReadonlyArray<string> }> = []
    const runExecFile: ExecFileLike = async (executable, args) => {
      calls.push({ executable, args })
      if (
        executable === 'codex' &&
        !args.includes('windows.sandbox=unelevated')
      ) {
        throw createWindowsSandboxRefreshError()
      }

      return {
        stdout: '{"title":"feat: test","description":"details"}',
        stderr: '',
      }
    }

    const result = await generateCommitMessageWithCodexCli(
      'codex',
      process.cwd(),
      ['app/src/lib/codex-cli.ts'],
      null,
      {
        runExecFile: runExecFile as typeof execFile,
        platform: 'win32',
      }
    )

    assert.equal(result.title, 'feat: test')
    assert.equal(result.description, 'details')
    assert.equal(calls.length, 2)
    assert.equal(calls[0]?.executable, 'codex')
    assert.equal(calls[1]?.executable, 'codex')
    assert.equal(calls[1]?.args.includes('windows.sandbox=unelevated'), true)
  })

  it('retries cmd.exe with unelevated Windows sandbox when cmd setup refresh fails', async () => {
    const calls: Array<{ executable: string; args: ReadonlyArray<string> }> = []
    const runExecFile: ExecFileLike = async (executable, args) => {
      calls.push({ executable, args })

      if (executable === 'codex') {
        throw createMissingError()
      }

      if (
        executable === 'cmd.exe' &&
        !args.includes('windows.sandbox=unelevated')
      ) {
        throw createWindowsSandboxRefreshError()
      }

      if (executable === 'cmd.exe') {
        return {
          stdout: '{"title":"feat: test","description":"details"}',
          stderr: '',
        }
      }

      throw new Error(`Unexpected executable: ${executable}`)
    }

    const result = await generateCommitMessageWithCodexCli(
      'codex',
      process.cwd(),
      ['app/src/lib/codex-cli.ts'],
      null,
      {
        runExecFile: runExecFile as typeof execFile,
        platform: 'win32',
      }
    )

    assert.equal(result.title, 'feat: test')
    assert.equal(result.description, 'details')
    assert.equal(calls.length, 3)
    assert.equal(calls[0]?.executable, 'codex')
    assert.equal(calls[1]?.executable, 'cmd.exe')
    assert.equal(calls[2]?.executable, 'cmd.exe')
    assert.equal(calls[2]?.args.includes('windows.sandbox=unelevated'), true)
  })

  it('sanitizes verbose template-like description content', async () => {
    const noisyDescription = [
      'Body (optional):',
      '- Retry Codex CLI commands via cmd.exe.',
      '- Add tests.',
      '',
      'Commands:',
      '```powershell',
      'git add .',
      'git commit -m "test"',
      '```',
    ].join('\n')

    const runExecFile: ExecFileLike = async () => ({
      stdout: JSON.stringify({
        title: '[My] Example',
        description: noisyDescription,
      }),
      stderr: '',
    })

    const result = await generateCommitMessageWithCodexCli(
      'codex',
      process.cwd(),
      ['app/src/lib/codex-cli.ts'],
      null,
      {
        runExecFile: runExecFile as typeof execFile,
        platform: 'win32',
      }
    )

    assert.equal(result.title, '[My] Example')
    assert.equal(
      result.description,
      '- Retry Codex CLI commands via cmd.exe.\n- Add tests.'
    )
  })

  it('uses Subject as title when title is generic and strips Subject/Body labels', async () => {
    const runExecFile: ExecFileLike = async () => ({
      stdout: JSON.stringify({
        title: 'Commit Message',
        description: [
          'Subject: [My] Fix Codex CLI Windows fallback and sanitize commit output',
          '',
          'Body (optional):',
          '- Add cmd fallback for codex execution.',
          '- Remove verbose template output.',
        ].join('\n'),
      }),
      stderr: '',
    })

    const result = await generateCommitMessageWithCodexCli(
      'codex',
      process.cwd(),
      ['app/src/lib/codex-cli.ts'],
      null,
      {
        runExecFile: runExecFile as typeof execFile,
        platform: 'win32',
      }
    )

    assert.equal(
      result.title,
      '[My] Fix Codex CLI Windows fallback and sanitize commit output'
    )
    assert.equal(
      result.description,
      '- Add cmd fallback for codex execution.\n- Remove verbose template output.'
    )
  })

  it('derives title from description when title is template-like', async () => {
    const runExecFile: ExecFileLike = async () => ({
      stdout: JSON.stringify({
        title: 'Generated Commit Message',
        description: [
          '- Add Windows fallback for sandbox setup refresh failures.',
          '- Update integration defaults.',
        ].join('\n'),
      }),
      stderr: '',
    })

    const result = await generateCommitMessageWithCodexCli(
      'codex',
      process.cwd(),
      ['app/src/lib/codex-cli.ts'],
      null,
      {
        runExecFile: runExecFile as typeof execFile,
        platform: 'win32',
      }
    )

    assert.equal(
      result.title,
      'Add Windows fallback for sandbox setup refresh failures'
    )
    assert.equal(
      result.description,
      '- Add Windows fallback for sandbox setup refresh failures.\n- Update integration defaults.'
    )
  })

  it('parses final git commit command when output is template text', async () => {
    const runExecFile: ExecFileLike = async () => ({
      stdout: [
        'Subject: [My] Example subject',
        '',
        'Body (optional):',
        '- line1',
        '',
        'Commands (generate only, not executed):',
        'git commit -m "[My] Enhance Codex CLI sandbox fallback and integration defaults" -m "Add default approval/sandbox flags for Codex CLI execution when not explicitly provided." -m "Retry with windows.sandbox=unelevated on Windows sandbox setup refresh failures, including cmd.exe fallback." -m "Update integration defaults/docs and extend unit tests for fallback and flag handling."',
      ].join('\n'),
      stderr: '',
    })

    const result = await generateCommitMessageWithCodexCli(
      'codex',
      process.cwd(),
      ['app/src/lib/codex-cli.ts'],
      null,
      {
        runExecFile: runExecFile as typeof execFile,
        platform: 'win32',
      }
    )

    assert.equal(
      result.title,
      '[My] Enhance Codex CLI sandbox fallback and integration defaults'
    )
    assert.equal(
      result.description,
      [
        'Add default approval/sandbox flags for Codex CLI execution when not explicitly provided.',
        'Retry with windows.sandbox=unelevated on Windows sandbox setup refresh failures, including cmd.exe fallback.',
        'Update integration defaults/docs and extend unit tests for fallback and flag handling.',
      ].join('\n\n')
    )
  })

  it('keeps full description and removes suggestions section', async () => {
    const longBody = 'a'.repeat(280)
    const runExecFile: ExecFileLike = async () => ({
      stdout: JSON.stringify({
        title: 'feat: keep generated body concise',
        description: `${longBody}\n\nSuggestions:\n- add more tests`,
      }),
      stderr: '',
    })

    const result = await generateCommitMessageWithCodexCli(
      'codex',
      process.cwd(),
      ['app/src/lib/codex-cli.ts'],
      null,
      {
        runExecFile: runExecFile as typeof execFile,
        platform: 'win32',
      }
    )

    assert.equal(result.description.length, 280)
    assert.equal(result.description, 'a'.repeat(280))
  })

  it('respects explicitly configured approval and sandbox flags', async () => {
    const calls: Array<{ executable: string; args: ReadonlyArray<string> }> = []
    const runExecFile: ExecFileLike = async (executable, args) => {
      calls.push({ executable, args })
      return {
        stdout: '{"title":"feat: test","description":"details"}',
        stderr: '',
      }
    }

    await generateCommitMessageWithCodexCli(
      'codex --ask-for-approval on-request --sandbox danger-full-access',
      process.cwd(),
      ['app/src/lib/codex-cli.ts'],
      null,
      {
        runExecFile: runExecFile as typeof execFile,
        platform: 'win32',
      }
    )

    const firstCall = calls[0]
    assert.ok(firstCall !== undefined)
    assert.deepEqual(firstCall.args.slice(0, 5), [
      '--ask-for-approval',
      'on-request',
      '--sandbox',
      'danger-full-access',
      'exec',
    ])
    assert.equal(firstCall.args.includes('never'), false)
    assert.equal(firstCall.args.includes('workspace-write'), false)
  })
})
