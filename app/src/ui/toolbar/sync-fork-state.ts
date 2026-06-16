import { TipState } from '../../models/tip'

export interface ISyncForkState {
  readonly showSyncFork: boolean
  readonly canSyncFork: boolean
  readonly syncForkInProgress: boolean
  readonly syncForkDisabledReason: string | null
  readonly syncForkTargetBranchName: string | null
}

interface IGetSyncForkStateArgs {
  readonly isForkRepository: boolean
  readonly contributionTargetBranchName: string | null
  readonly tipState: TipState
  readonly networkActionInProgress: boolean
  readonly rebaseOperationInProgress: boolean
  readonly syncForkInProgress: boolean
}

export function getSyncForkState({
  isForkRepository,
  contributionTargetBranchName,
  tipState,
  networkActionInProgress,
  rebaseOperationInProgress,
  syncForkInProgress,
}: IGetSyncForkStateArgs): ISyncForkState {
  const showSyncFork = isForkRepository
  const canSyncFork =
    isForkRepository &&
    contributionTargetBranchName !== null &&
    tipState === TipState.Valid &&
    !networkActionInProgress &&
    !rebaseOperationInProgress

  let syncForkDisabledReason: string | null = null
  if (showSyncFork && !canSyncFork) {
    if (syncForkInProgress) {
      syncForkDisabledReason = 'Sync fork is already in progress.'
    } else if (rebaseOperationInProgress) {
      syncForkDisabledReason =
        'Cannot sync fork while another rebase operation is in progress.'
    } else if (networkActionInProgress) {
      syncForkDisabledReason =
        'Cannot sync fork while another push, pull, or fetch is in progress.'
    } else if (tipState !== TipState.Valid) {
      syncForkDisabledReason =
        'Cannot sync fork because the current branch is not in a valid state.'
    } else if (contributionTargetBranchName === null) {
      syncForkDisabledReason =
        'Cannot sync fork because the contribution target branch could not be found.'
    }
  }

  return {
    showSyncFork,
    canSyncFork,
    syncForkInProgress,
    syncForkDisabledReason,
    syncForkTargetBranchName: contributionTargetBranchName,
  }
}
