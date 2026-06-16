# Environment Preflight (Phase 0)

- Date: 2026-03-20 14:05:56 +08:00
- Workspace: `E:\MyOtherProject\desktop`
- Base commit: `6aa2179f04`
- OS: `Microsoft Windows NT 10.0.26100.0`

## Toolchain Check

| Item | Command | Result | Status |
| --- | --- | --- | --- |
| Node.js | `node -v` | `v24.14.0` | Pass |
| Yarn | `yarn -v` | `1.21.1` | Pass |
| Python | `python --version` | `Python 3.13.0` | Pass |
| MSVC (`cl.exe`) | `cl.exe /?` | `cl.exe not found in PATH` | Warn |
| Windows SDK | Registry `HKLM:\SOFTWARE\Microsoft\Windows Kits\Installed Roots` | `KitsRoot10 = C:\Program Files (x86)\Windows Kits\10\` | Pass |

## Script Smoke Check

| Item | Command | Result | Status |
| --- | --- | --- | --- |
| Tests | `yarn test` | Failed (git-related unit tests) | Fail |
| Lint | `yarn lint` | Completed successfully | Pass |
| Dev start | `yarn start` | `Server running at http://localhost:3000` | Pass |
| Production build | `yarn build:prod` | Completed successfully (1 webpack warning) | Pass |
| Windows package | `yarn package` | Completed successfully | Pass |

## Test Failure Summary (`yarn test`)

Observed failures are concentrated in git/dugite related tests:

- Repeated error from `sh.exe`: `add_item (... dugite\\git ...) failed, errno 1`
- Some tests reported `git.exe ENOENT` during child process spawn
- Follow-on failures include clone/fetch/pull related assertions and repository setup errors

Validation notes:

- `app\node_modules\dugite\git\cmd\git.exe` exists on disk
- `app\node_modules\dugite\git\usr\bin\sh.exe` exists on disk

This indicates the failure is likely runtime environment interaction (shell/path/process setup), not a missing file in `node_modules`.

## Packaging Output Check

Installers were created under `dist`:

- `GitHubDesktopSetup-x64.exe`
- `GitHubDesktopSetup-x64.msi`
- `GitHubDesktop-3.5.7-beta2-x64-full.nupkg`

## Recommended Follow-up

1. Open a Developer Command Prompt (or run `VsDevCmd.bat`) before test execution so `cl.exe` and build environment are consistent.
2. Re-run `yarn test` with focus on dugite/git tests to isolate whether the `sh.exe add_item` issue is environment-specific.
3. Keep using the current packaging path; build/package smoke is green in this environment.
