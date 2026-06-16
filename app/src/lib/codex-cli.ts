import { parseCustomIntegrationArguments } from './custom-integration'
import { execFile } from './exec-file'
import { Commit } from '../models/commit'
import { randomUUID } from 'crypto'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import * as Path from 'path'

export type CodexCliStatus = 'ready' | 'missing' | 'checking' | 'error'

export interface ICodexCliCheckResult {
  readonly status: CodexCliStatus
  readonly checkedAt: number
  readonly version: string | null
  readonly error: string | null
}

export interface ICodexCommitMessage {
  readonly title: string
  readonly description: string
}

export interface ICodexCliCommitInTerminalInvocation {
  readonly executable: string
  readonly args: ReadonlyArray<string>
}

const CodexCliVersionCheckTimeoutMs = 8_000
const CodexCommitMessageTimeoutMs = 120_000
const OneMegabyte = 1024 * 1024
export const CodexCommitAndCommitPrompt =
  'Generate a git commit message and commit the changes.'

interface ICodexCliCommand {
  readonly executable: string
  readonly args: ReadonlyArray<string>
}

interface ICodexCliDependencies {
  readonly runExecFile?: typeof execFile
  readonly platform?: NodeJS.Platform
}

function hasArg(args: ReadonlyArray<string>, short: string, long: string) {
  return args.some(
    arg => arg === short || arg === long || arg.startsWith(`${long}=`)
  )
}

function withDefaultCodexExecPermissions(
  args: ReadonlyArray<string>
): ReadonlyArray<string> {
  const hasDangerousBypass = args.includes(
    '--dangerously-bypass-approvals-and-sandbox'
  )
  const hasFullAuto = args.includes('--full-auto')

  if (hasDangerousBypass || hasFullAuto) {
    return args
  }

  const hasApproval = hasArg(args, '-a', '--ask-for-approval')
  const hasSandbox = hasArg(args, '-s', '--sandbox')

  if (hasApproval && hasSandbox) {
    return args
  }

  const defaults: Array<string> = []
  if (!hasApproval) {
    defaults.push('--ask-for-approval', 'never')
  }
  if (!hasSandbox) {
    defaults.push('--sandbox', 'workspace-write')
  }

  return [...defaults, ...args]
}

function parseCodexCliCommand(command: string): ICodexCliCommand {
  const argv = parseCustomIntegrationArguments(command.trim())
  const executable = argv.at(0)
  if (executable === undefined || executable.trim().length === 0) {
    throw new Error('Codex CLI command is empty.')
  }

  return {
    executable,
    args: argv.slice(1),
  }
}

function extractPermissionArgs(
  args: ReadonlyArray<string>
): ReadonlyArray<string> {
  const extracted: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (
      arg === '--dangerously-bypass-approvals-and-sandbox' ||
      arg === '--full-auto'
    ) {
      extracted.push(arg)
      continue
    }

    if (arg === '--ask-for-approval' || arg === '-a') {
      const value = args[i + 1]
      if (value !== undefined && !value.startsWith('-')) {
        extracted.push(arg, value)
        i += 1
      } else {
        extracted.push(arg)
      }
      continue
    }

    if (arg.startsWith('--ask-for-approval=')) {
      extracted.push(arg)
      continue
    }

    if (arg === '--sandbox' || arg === '-s') {
      const value = args[i + 1]
      if (value !== undefined && !value.startsWith('-')) {
        extracted.push(arg, value)
        i += 1
      } else {
        extracted.push(arg)
      }
      continue
    }

    if (arg.startsWith('--sandbox=')) {
      extracted.push(arg)
      continue
    }
  }

  return extracted
}

function getErrorOutput(error: unknown): string {
  if (error === null || error === undefined) {
    return ''
  }

  if (typeof error === 'object') {
    const maybeStdErr = (error as { stderr?: string }).stderr
    if (typeof maybeStdErr === 'string' && maybeStdErr.trim().length > 0) {
      return maybeStdErr
    }

    const maybeStdOut = (error as { stdout?: string }).stdout
    if (typeof maybeStdOut === 'string' && maybeStdOut.trim().length > 0) {
      return maybeStdOut
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function summarizeCodexCliError(error: unknown): string {
  const output = getErrorOutput(error)
  const firstLine = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.length > 0)

  if (firstLine !== undefined) {
    return firstLine
  }

  return 'Unknown Codex CLI error.'
}

function isCommandMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const withCode = error as Error & { code?: string }
  return withCode.code === 'ENOENT'
}

function isWindowsCommandNotFoundError(error: unknown): boolean {
  const output = getErrorOutput(error).toLowerCase()
  if (output.includes('is not recognized as an internal or external command')) {
    return true
  }

  // cmd.exe localized message commonly contains this phrase in zh-CN systems.
  if (
    output.includes('\u4e0d\u662f\u5185\u90e8\u6216\u5916\u90e8\u547d\u4ee4')
  ) {
    return true
  }

  return false
}

function isWindowsSandboxSetupRefreshError(error: unknown): boolean {
  const output = getErrorOutput(error).toLowerCase()
  return output.includes('windows sandbox: setup refresh failed')
}

function parseCodexVersion(stdout: string, stderr: string): string | null {
  const firstLine = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.length > 0)

  return firstLine ?? null
}

function isMissingCodexCommandError(
  error: unknown,
  platform: NodeJS.Platform
): boolean {
  if (isCommandMissingError(error)) {
    return true
  }

  return platform === 'win32' && isWindowsCommandNotFoundError(error)
}

async function runCodexCliCommand(
  parsed: ICodexCliCommand,
  cliArgs: ReadonlyArray<string>,
  options: {
    readonly cwd?: string
    readonly timeout: number
    readonly windowsHide: boolean
    readonly maxBuffer: number
  },
  dependencies: ICodexCliDependencies
) {
  const runExecFile = dependencies.runExecFile ?? execFile
  const platform = dependencies.platform ?? process.platform
  const baseArgs = [...parsed.args, ...cliArgs]
  const unelevatedWindowsSandboxArgs = [
    ...parsed.args,
    '-c',
    'windows.sandbox=unelevated',
    ...cliArgs,
  ]
  const runDirect = (args: ReadonlyArray<string>) =>
    runExecFile(parsed.executable, [...args], {
      ...options,
    })
  const runViaCmd = (args: ReadonlyArray<string>) =>
    runExecFile('cmd.exe', ['/d', '/s', '/c', parsed.executable, ...args], {
      ...options,
    })

  try {
    return await runDirect(baseArgs)
  } catch (error) {
    if (platform !== 'win32') {
      throw error
    }

    if (isCommandMissingError(error)) {
      try {
        return await runViaCmd(baseArgs)
      } catch (cmdError) {
        if (!isWindowsSandboxSetupRefreshError(cmdError)) {
          throw cmdError
        }
        return runViaCmd(unelevatedWindowsSandboxArgs)
      }
    }

    if (!isWindowsSandboxSetupRefreshError(error)) {
      throw error
    }

    try {
      return await runDirect(unelevatedWindowsSandboxArgs)
    } catch (retryError) {
      if (isCommandMissingError(retryError)) {
        return runViaCmd(unelevatedWindowsSandboxArgs)
      }
      throw retryError
    }
  }
}

const CommitMessageOutputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: {
      type: 'string',
      minLength: 1,
    },
    description: {
      type: 'string',
    },
  },
  required: ['title', 'description'],
}

function buildCodexCommitMessagePrompt(
  selectedPaths: ReadonlyArray<string>,
  commitToAmend: Commit | null
): string {
  const selectedPathLines =
    selectedPaths.length > 0
      ? selectedPaths.map(path => `- ${path}`)
      : ['- (none provided)']

  const amendLine =
    commitToAmend === null
      ? 'No amend commit context is active.'
      : `This operation is amending commit ${commitToAmend.sha}.`

  return [
    'Task: generate a git commit log (git commit message).',
    'Please produce the output with the goal of generating a git commit log.',
    amendLine,
    '',
    'Focus only on these selected paths:',
    ...selectedPathLines,
    '',
    'Use repository-local git context only when necessary.',
    'Prioritize speed and avoid unnecessary exploration.',
    '',
    'Return only JSON with this shape:',
    '{"title":"<summary>","description":"<body>"}',
    'Fallback when JSON cannot be produced: output exactly one final line starting with "git commit -m".',
    '',
    'Rules:',
    '- Title must be concise, imperative, and <= 72 characters.',
    '- Description can be empty string when not needed, and must be <= 250 characters.',
    '- Description must be plain text only (no markdown headings, no bullet lists, no code fences).',
    '- If using fallback, use `git commit -m "<summary>"` plus optional extra `-m "<paragraph>"` parts.',
    '- No extra keys.',
  ].join('\n')
}

export function buildCodexCliCommitInTerminalInvocation(
  command: string
): ICodexCliCommitInTerminalInvocation {
  const parsed = parseCodexCliCommand(command)
  const permissionArgs = extractPermissionArgs(parsed.args)
  const parsedWithDefaults: ICodexCliCommand = {
    executable: parsed.executable,
    args: withDefaultCodexExecPermissions(permissionArgs),
  }

  return {
    executable: parsedWithDefaults.executable,
    args: [...parsedWithDefaults.args, 'exec', CodexCommitAndCommitPrompt],
  }
}

function extractSubjectFromDescription(description: string): string | null {
  const normalized = description.replace(/\r\n/g, '\n')
  const match = normalized.match(/^\s*subject\s*:\s*(.+)\s*$/im)
  if (match === null) {
    return null
  }

  const subject = match[1]?.trim() ?? ''
  return subject.length > 0 ? subject : null
}

function isGenericCommitTitle(title: string): boolean {
  const compact = title
    .toLowerCase()
    .replace(/^[\[\(\{].*?[\]\)\}]\s*/g, '')
    .replace(/[^a-z]/g, '')

  return (
    compact === 'commitmessage' ||
    compact === 'commitmessagedraft' ||
    compact === 'generatedcommitmessage' ||
    compact === 'generatedcommitmessagedraft' ||
    compact === 'draftcommitmessage' ||
    compact === 'commitdraft' ||
    compact === 'generatedsummary' ||
    compact === 'summarydraft' ||
    compact === 'gitcommitmessage' ||
    compact === 'commit' ||
    compact === 'message' ||
    compact === 'summary'
  )
}

function extractTitleFromDescription(description: string): string | null {
  const normalized = description.replace(/\r\n/g, '\n')
  const firstContentLine = normalized
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0)

  if (firstContentLine === undefined) {
    return null
  }

  const withoutPrefix = firstContentLine
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/^subject\s*:\s*/i, '')
    .trim()
    .replace(/[;:,.!?]+$/g, '')
    .trim()

  if (withoutPrefix.length === 0) {
    return null
  }

  return withoutPrefix
}

function extractGitCommitCommandLine(output: string): string | null {
  const lines = output.replace(/\r\n/g, '\n').split('\n')
  const matches = lines
    .map(line => line.trim())
    .map(line => {
      const match = line.match(/git\s+commit\b.*$/i)
      if (match === null) {
        return null
      }

      return match[0].trim().replace(/^`+|`+$/g, '')
    })
    .filter((line): line is string => line !== null && line.length > 0)

  return matches.at(-1) ?? null
}

function parseCommitMessageFromGitCommitCommand(
  output: string
): ICodexCommitMessage | null {
  const commandLine = extractGitCommitCommandLine(output)
  if (commandLine === null) {
    return null
  }

  let argv: ReadonlyArray<string>
  try {
    argv = parseCustomIntegrationArguments(commandLine)
  } catch {
    return null
  }

  if (argv.length < 3 || argv[0]?.toLowerCase() !== 'git') {
    return null
  }

  const commitIndex = argv.findIndex(
    (arg, index) => index > 0 && arg === 'commit'
  )
  if (commitIndex < 0) {
    return null
  }

  const messages: string[] = []
  for (let i = commitIndex + 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-m' || arg === '--message') {
      const message = argv[i + 1]
      if (typeof message === 'string') {
        messages.push(message)
        i += 1
      }
      continue
    }

    if (arg.startsWith('--message=')) {
      messages.push(arg.slice('--message='.length))
    }
  }

  if (messages.length === 0) {
    return null
  }

  const rawDescription = messages.slice(1).join('\n\n')
  const sanitizedDescription = sanitizeCommitMessageDescription(rawDescription)
  const extractedSubject = extractTitleFromDescription(sanitizedDescription)
  const normalizedTitle = normalizeCommitMessageTitle(
    messages[0],
    extractedSubject
  )
  if (normalizedTitle.length === 0) {
    return null
  }

  return {
    title: normalizedTitle,
    description: sanitizedDescription,
  }
}

function normalizeCommitMessageTitle(
  title: string,
  fallbackSubject: string | null
): string {
  let normalized = title.replace(/^subject\s*:\s*/i, '').trim()

  if (isGenericCommitTitle(normalized) && fallbackSubject !== null) {
    normalized = fallbackSubject
  }

  if (normalized.length > 72) {
    normalized = normalized.slice(0, 72).trimEnd()
  }

  return normalized
}

function sanitizeCommitMessageDescription(description: string): string {
  let normalized = description.replace(/\r\n/g, '\n').trim()

  // Remove label-style prefixes that should not appear in final body text.
  normalized = normalized.replace(/^\s*subject\s*:\s*.*(?:\n|$)/im, '')

  // Remove common verbose section prefixes.
  normalized = normalized.replace(
    /^\s*body\s*(?:\(\s*optional\s*\))?\s*:\s*/i,
    ''
  )

  // Remove command sections that often contain generated shell snippets.
  const commandSectionIndex = normalized.search(/(^|\n)\s*commands?\s*:\s*/i)
  if (commandSectionIndex >= 0) {
    normalized = normalized.slice(0, commandSectionIndex).trim()
  }

  // Remove suggestion sections if the model appends action items.
  const suggestionSectionIndex = normalized.search(
    /(^|\n)\s*(?:suggestions?|recommendations?|\u5efa\u8bae)\s*[:\uFF1A]\s*/i
  )
  if (suggestionSectionIndex >= 0) {
    normalized = normalized.slice(0, suggestionSectionIndex).trim()
  }

  // Remove fenced code blocks if any slipped through.
  normalized = normalized.replace(/```[\s\S]*?```/g, '').trim()

  // Collapse excessive blank lines.
  normalized = normalized.replace(/\n{3,}/g, '\n\n')

  return normalized
}

function parseCommitMessageResponse(stdout: string): ICodexCommitMessage {
  const trimmed = stdout.trim()
  if (trimmed.length === 0) {
    throw new Error('Codex CLI returned an empty response.')
  }

  let payload: unknown
  try {
    payload = JSON.parse(trimmed)
  } catch {
    // Some CLI versions can prepend extra lines; try to recover the last JSON block.
    const match = trimmed.match(/\{[\s\S]*\}/g)?.at(-1)
    if (match === undefined) {
      const parsedFromCommand = parseCommitMessageFromGitCommitCommand(trimmed)
      if (parsedFromCommand !== null) {
        return parsedFromCommand
      }

      throw new Error('Codex CLI returned non-JSON output.')
    }

    payload = JSON.parse(match)
  }

  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Codex CLI returned an invalid payload.')
  }

  const maybeTitle = (payload as { title?: unknown }).title
  const maybeDescription = (payload as { description?: unknown }).description

  if (typeof maybeTitle !== 'string' || maybeTitle.trim().length === 0) {
    throw new Error('Codex CLI returned an invalid commit title.')
  }

  if (typeof maybeDescription !== 'string') {
    throw new Error('Codex CLI returned an invalid commit description.')
  }

  const sanitizedDescription =
    sanitizeCommitMessageDescription(maybeDescription)
  const extractedSubject =
    extractSubjectFromDescription(maybeDescription) ??
    extractTitleFromDescription(sanitizedDescription)
  const normalizedTitle = normalizeCommitMessageTitle(
    maybeTitle,
    extractedSubject
  )
  if (normalizedTitle.length === 0) {
    throw new Error('Codex CLI returned an invalid commit title.')
  }

  return {
    title: normalizedTitle,
    description: sanitizedDescription,
  }
}

export async function checkCodexCliAvailability(
  command: string,
  dependencies: ICodexCliDependencies = {}
): Promise<ICodexCliCheckResult> {
  const platform = dependencies.platform ?? process.platform
  const checkedAt = Date.now()
  let parsed: ICodexCliCommand

  try {
    parsed = parseCodexCliCommand(command)
  } catch (error) {
    return {
      status: 'error',
      checkedAt,
      version: null,
      error: summarizeCodexCliError(error),
    }
  }

  try {
    const { stdout, stderr } = await runCodexCliCommand(
      parsed,
      ['--version'],
      {
        timeout: CodexCliVersionCheckTimeoutMs,
        windowsHide: true,
        maxBuffer: OneMegabyte,
      },
      dependencies
    )

    return {
      status: 'ready',
      checkedAt,
      version: parseCodexVersion(stdout, stderr),
      error: null,
    }
  } catch (error) {
    return {
      status: isMissingCodexCommandError(error, platform) ? 'missing' : 'error',
      checkedAt,
      version: null,
      error: summarizeCodexCliError(error),
    }
  }
}

export async function generateCommitMessageWithCodexCli(
  command: string,
  repositoryPath: string,
  selectedPaths: ReadonlyArray<string>,
  commitToAmend: Commit | null,
  dependencies: ICodexCliDependencies = {},
  model: string = ''
): Promise<ICodexCommitMessage> {
  const parsed = parseCodexCliCommand(command)
  const parsedWithDefaults: ICodexCliCommand = {
    executable: parsed.executable,
    args: withDefaultCodexExecPermissions(parsed.args),
  }
  const schemaPath = Path.join(
    tmpdir(),
    `desktop-codex-commit-message-schema-${randomUUID()}.json`
  )

  const prompt = buildCodexCommitMessagePrompt(selectedPaths, commitToAmend)

  try {
    await writeFile(
      schemaPath,
      JSON.stringify(CommitMessageOutputSchema),
      'utf-8'
    )

    const trimmedModel = model.trim()
    const cliArgs = ['exec', '--output-schema', schemaPath]
    if (trimmedModel.length > 0) {
      cliArgs.push('--model', trimmedModel)
    }
    cliArgs.push(prompt)

    const { stdout } = await runCodexCliCommand(
      parsedWithDefaults,
      cliArgs,
      {
        cwd: repositoryPath,
        timeout: CodexCommitMessageTimeoutMs,
        windowsHide: true,
        maxBuffer: OneMegabyte,
      },
      dependencies
    )

    return parseCommitMessageResponse(stdout)
  } finally {
    await unlink(schemaPath).catch(() => {
      // Best effort temp file cleanup.
    })
  }
}
