import { describe, it } from 'node:test'
import assert from 'node:assert'
import { TipState } from '../../src/models/tip'
import { getSyncForkState } from '../../src/ui/toolbar/sync-fork-state'

describe('getSyncForkState', () => {
  it('hides sync fork for non-fork repositories', () => {
    const state = getSyncForkState({
      isForkRepository: false,
      contributionTargetBranchName: 'main',
      tipState: TipState.Valid,
      networkActionInProgress: false,
      rebaseOperationInProgress: false,
      syncForkInProgress: false,
    })

    assert.equal(state.showSyncFork, false)
    assert.equal(state.canSyncFork, false)
    assert.equal(state.syncForkDisabledReason, null)
  })

  it('enables sync fork when fork conditions are satisfied', () => {
    const state = getSyncForkState({
      isForkRepository: true,
      contributionTargetBranchName: 'upstream/main',
      tipState: TipState.Valid,
      networkActionInProgress: false,
      rebaseOperationInProgress: false,
      syncForkInProgress: false,
    })

    assert.equal(state.showSyncFork, true)
    assert.equal(state.canSyncFork, true)
    assert.equal(state.syncForkInProgress, false)
    assert.equal(state.syncForkDisabledReason, null)
    assert.equal(state.syncForkTargetBranchName, 'upstream/main')
  })

  it('disables sync fork when a network action is already in progress', () => {
    const state = getSyncForkState({
      isForkRepository: true,
      contributionTargetBranchName: 'upstream/main',
      tipState: TipState.Valid,
      networkActionInProgress: true,
      rebaseOperationInProgress: false,
      syncForkInProgress: false,
    })

    assert.equal(state.showSyncFork, true)
    assert.equal(state.canSyncFork, false)
    assert.equal(
      state.syncForkDisabledReason,
      'Cannot sync fork while another push, pull, or fetch is in progress.'
    )
  })

  it('disables sync fork when rebase operation is already in progress', () => {
    const state = getSyncForkState({
      isForkRepository: true,
      contributionTargetBranchName: 'upstream/main',
      tipState: TipState.Valid,
      networkActionInProgress: false,
      rebaseOperationInProgress: true,
      syncForkInProgress: false,
    })

    assert.equal(state.showSyncFork, true)
    assert.equal(state.canSyncFork, false)
    assert.equal(
      state.syncForkDisabledReason,
      'Cannot sync fork while another rebase operation is in progress.'
    )
  })

  it('shows syncing state when sync fork is already in progress', () => {
    const state = getSyncForkState({
      isForkRepository: true,
      contributionTargetBranchName: 'upstream/main',
      tipState: TipState.Valid,
      networkActionInProgress: false,
      rebaseOperationInProgress: true,
      syncForkInProgress: true,
    })

    assert.equal(state.showSyncFork, true)
    assert.equal(state.canSyncFork, false)
    assert.equal(state.syncForkInProgress, true)
    assert.equal(
      state.syncForkDisabledReason,
      'Sync fork is already in progress.'
    )
  })

  it('disables sync fork when branch tip is not valid', () => {
    const state = getSyncForkState({
      isForkRepository: true,
      contributionTargetBranchName: 'upstream/main',
      tipState: TipState.Detached,
      networkActionInProgress: false,
      rebaseOperationInProgress: false,
      syncForkInProgress: false,
    })

    assert.equal(state.showSyncFork, true)
    assert.equal(state.canSyncFork, false)
    assert.equal(
      state.syncForkDisabledReason,
      'Cannot sync fork because the current branch is not in a valid state.'
    )
  })

  it('disables sync fork when contribution target branch cannot be found', () => {
    const state = getSyncForkState({
      isForkRepository: true,
      contributionTargetBranchName: null,
      tipState: TipState.Valid,
      networkActionInProgress: false,
      rebaseOperationInProgress: false,
      syncForkInProgress: false,
    })

    assert.equal(state.showSyncFork, true)
    assert.equal(state.canSyncFork, false)
    assert.equal(
      state.syncForkDisabledReason,
      'Cannot sync fork because the contribution target branch could not be found.'
    )
  })

  it('prioritizes sync-fork-in-progress reason over other invalid conditions', () => {
    const state = getSyncForkState({
      isForkRepository: true,
      contributionTargetBranchName: null,
      tipState: TipState.Detached,
      networkActionInProgress: true,
      rebaseOperationInProgress: true,
      syncForkInProgress: true,
    })

    assert.equal(state.showSyncFork, true)
    assert.equal(state.canSyncFork, false)
    assert.equal(
      state.syncForkDisabledReason,
      'Sync fork is already in progress.'
    )
  })
})
