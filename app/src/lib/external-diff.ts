import {
  parseCustomIntegrationArguments,
  expandCustomIntegrationArguments,
  ICustomIntegration,
  LeftPathArgument,
  RightPathArgument,
  checkRequiredCustomIntegrationArguments,
  spawnCustomIntegration,
} from './custom-integration'
import { pathExists } from './path-exists'
import { ExternalEditorError } from './editors/shared'

/**
 * Launch a custom external diff tool with the provided left/right file paths.
 */
export async function launchCustomExternalDiff(
  leftPath: string,
  rightPath: string,
  customDiffTool: ICustomIntegration
): Promise<void> {
  const label = __DARWIN__ ? 'Settings' : 'Options'
  const exists = await pathExists(customDiffTool.path)

  if (!exists) {
    throw new ExternalEditorError(
      `Could not find executable for custom external diff tool at path '${customDiffTool.path}'. Please open ${label} and update your external diff tool settings.`,
      { openPreferences: true }
    )
  }

  const argv = parseCustomIntegrationArguments(customDiffTool.arguments)
  const hasLeftPlaceholder = checkRequiredCustomIntegrationArguments(argv, [
    LeftPathArgument,
  ])
  const hasRightPlaceholder = checkRequiredCustomIntegrationArguments(argv, [
    RightPathArgument,
  ])

  const expandedArgs = expandCustomIntegrationArguments(argv, {
    [LeftPathArgument]: leftPath,
    [RightPathArgument]: rightPath,
  })

  const args = [...expandedArgs]
  if (!hasLeftPlaceholder) {
    args.push(leftPath)
  }
  if (!hasRightPlaceholder) {
    args.push(rightPath)
  }

  const spawnAsDarwinApp = __DARWIN__ && customDiffTool.bundleID !== undefined
  const cmd = spawnAsDarwinApp ? 'open' : customDiffTool.path
  const cmdArgs = spawnAsDarwinApp ? ['-a', customDiffTool.path, ...args] : args

  await new Promise<void>((resolve, reject) => {
    const child = spawnCustomIntegration(cmd, cmdArgs)
    child.on('error', reject)
    child.on('spawn', () => {
      child.unref()
      resolve()
    })
  }).catch((e: unknown) => {
    log.error(
      'Error while launching custom external diff tool',
      e instanceof Error ? e : undefined
    )

    throw new ExternalEditorError(
      `Something went wrong while trying to start your external diff tool. Please open ${label} and verify your diff tool configuration.`,
      { openPreferences: true }
    )
  })
}
