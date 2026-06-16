import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  Repository,
  isRepositoryAutoUpdateEnabled,
} from '../../src/models/repository'

describe('Repository', () => {
  describe('name', () => {
    it('uses the last path component as the name', async () => {
      const repoPath = '/some/cool/path'
      const repository = new Repository(repoPath, -1, null, false)
      assert.equal(repository.name, 'path')
    })

    it('handles repository at root of the drive', async () => {
      const repoPath = 'T:\\'
      const repository = new Repository(repoPath, -1, null, false)
      assert.equal(repository.name, 'T:\\')
    })
  })

  describe('isRepositoryAutoUpdateEnabled', () => {
    it('defaults to true when preference is not set', () => {
      const repository = new Repository('/some/cool/path', -1, null, false)
      assert.equal(isRepositoryAutoUpdateEnabled(repository), true)
    })

    it('returns false when auto updates are disabled', () => {
      const repository = new Repository(
        '/some/cool/path',
        -1,
        null,
        false,
        null,
        {
          autoUpdateEnabled: false,
        }
      )
      assert.equal(isRepositoryAutoUpdateEnabled(repository), false)
    })
  })
})
