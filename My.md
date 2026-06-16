# [My] 功能整理

日期：2026-04-15

## 功能分组

### 1. 仓库设置与同步
1. 新增按仓库维度的自动更新开关（Repository Settings）。
2. 给 Sync Fork 增加了下拉动作入口，并补齐了可用性相关逻辑。
3. 将 Sync Fork 的执行流程从 Merge 改为 Rebase：现在会基于 contribution target 分支执行 rebase，不再走 merge 流程。

### 2. History / Compare / Diff
1. 在 History / Compare 里新增独立提交搜索入口，不再复用分支选择框。
2. 提交搜索支持按 `Author`、`Message`、`SHA`、`Path` 筛选；History 模式下无需先选 compared branch，默认可直接搜索当前分支提交。
3. 搜索框按回车会提交搜索，不会误触发 clear；清空后会恢复对应视图的默认提交列表。
4. History / Changes 都补齐了文件级 Diff 入口；Changes 支持 `Ctrl+D`（macOS 为 `Cmd+D`）触发 `Diff file`。
5. Changes 在多选文件且已配置外部 Diff 时，右键菜单会同时提供两个 Diff 入口：
   `Diff selected files (N files)` 和 `Diff current file (file name)`。
6. 单文件 Diff：若已配置外部 Diff 工具，会优先调用外部工具；否则回退到应用内置 diff 视图。
7. 多文件 Diff：仅在已配置外部 Diff 时提供入口；未配置时不提供该入口，也不走内置多文件 diff。

### 3. Codex CLI 提交
1. 将提交区 Codex 功能改为“打开命令窗口执行 Codex 提交命令”。
2. 点击后会启动命令窗口并运行固定提示词：
   `Generate a git commit message and commit the changes.`
3. Integrations 里的模型选项仅保留 `Auto (CLI default)`，避免账号不支持指定模型时报错。

### 4. Windows 脚本与环境检查
1. 增加了 Windows 构建/运行脚本：`build_win.bat`、`run.bat`。
2. `build_win.bat` 完成后会 `pause`，方便直接查看构建或打包结果。
3. 增加了环境预检文档和日志，方便快速检查开发环境。

### 5. 稳定性与细节修复
1. 修复并优化了 Sync Fork、Compare 搜索取消、外部 Diff 清理等稳定性问题。
2. 同步更新了相关按钮文案、禁用态提示与部分单测。

## 使用说明

### 1. Repository Settings
1. 打开仓库的 `Settings`。
2. 进入 `Repository Settings`。
3. 按仓库单独开启或关闭自动更新。

### 2. History / Compare 搜索
1. 进入 `History` 视图即可直接搜索当前分支提交，不需要先选择 compared branch。
2. 在独立搜索框输入关键词；左侧下拉可切换搜索类型：`Author`、`Message`、`SHA`、`Path`。
3. 按回车或失焦提交搜索。
4. 清空输入框后会恢复当前视图的默认提交列表。

### 3. History / Changes Diff
1. 在 `History` 中选择提交或文件，或在 `Changes` 中选中一个或多个文件。
2. 单文件场景下，可使用 `Ctrl+D` / `Cmd+D` 或右键菜单中的 `Diff file`。
3. 多选场景下，只有在已配置外部 Diff 时，`Changes` 右键菜单才会提供：
   `Diff selected files (N files)` 和 `Diff current file (file name)`。
4. 单文件 Diff 如果已配置外部 Diff，则优先打开外部工具；否则回退到应用内置 diff 视图。
5. 多文件 Diff 不提供内置 diff 回退；未配置外部 Diff 时不会显示该入口。

### 4. Codex CLI 提交
1. 在 `Preferences -> Integrations` 里配置 Codex CLI 命令：
   `codex --dangerously-bypass-approvals-and-sandbox`
2. 模型使用 `Auto (CLI default)`。
3. 点击 `Check now` 确认状态为 `Ready`。
4. 在提交区点击 Codex 按钮，会打开命令窗口并启动 Codex CLI。

### 5. Sync Fork
1. 在工具栏的 Push / Pull / Sync 区域打开下拉菜单。
2. 根据当前仓库状态选择 `Sync Fork` 执行。
3. Sync Fork 现在会把当前分支 rebase 到 contribution target 分支的最新提交之上。
4. 若 rebase 后远端拒绝普通 push，请使用 `--force-with-lease` 推送更新。

### 6. Windows 构建验证
1. 双击或在终端运行 `build_win.bat` 进行构建与打包。
2. 脚本结束后会停在 `pause`，可以直接查看成功或报错信息。
3. 运行 `run.bat` 可启动本地运行流程。
