import * as React from 'react'
import { CodexCliStatus } from '../../lib/app-state'
import { Row } from '../lib/row'
import { TextBox } from '../lib/text-box'
import { Button } from '../lib/button'
import { Select } from '../lib/select'

const CodexCliModels = [{ value: '', label: 'Auto (CLI default)' }] as const

interface ICodexCliSettingsProps {
  readonly command: string
  readonly model: string
  readonly status: CodexCliStatus
  readonly version: string | null
  readonly checkedAt: number | null
  readonly lastError: string | null
  readonly onCommandChanged: (command: string) => void
  readonly onModelChanged: (model: string) => void
  readonly onCheckAvailability: () => Promise<void>
}

export class CodexCliSettings extends React.Component<ICodexCliSettingsProps> {
  public render() {
    const checkedAt =
      this.props.checkedAt === null
        ? 'Never'
        : new Date(this.props.checkedAt).toLocaleString()

    return (
      <fieldset className="codex-cli-settings">
        <legend>
          <h2>Codex CLI</h2>
        </legend>
        <Row>
          <p className="git-settings-description">
            Install command: <code>npm install -g @openai/codex</code>
          </p>
        </Row>
        <Row>
          <p className="git-settings-description">
            Recommended command:{' '}
            <code>codex --dangerously-bypass-approvals-and-sandbox</code>
          </p>
        </Row>
        <Row>
          <div className="codex-cli-command-row">
            <TextBox
              label="Command"
              value={this.props.command}
              onValueChanged={this.props.onCommandChanged}
              placeholder="codex --dangerously-bypass-approvals-and-sandbox"
            />
            <Button
              onClick={this.onCheckAvailability}
              disabled={this.props.status === 'checking'}
              size="small"
            >
              Check now
            </Button>
          </div>
        </Row>
        <Row>
          <Select
            label="Model"
            aria-label="Codex model"
            value={this.props.model}
            onChange={this.onModelChanged}
          >
            {CodexCliModels.map(model => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </Select>
        </Row>
        <Row>
          <p className="git-settings-description codex-cli-status">
            Status: {this.getStatusText()}
            <br />
            Last checked: {checkedAt}
          </p>
        </Row>
      </fieldset>
    )
  }

  private onCheckAvailability = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    this.props.onCheckAvailability()
  }

  private onModelChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    this.props.onModelChanged(event.currentTarget.value)
  }

  private getStatusText() {
    const { status, version, lastError } = this.props

    switch (status) {
      case 'ready':
        return version ? `Ready (${version})` : 'Ready (version unknown)'
      case 'missing':
        return 'Missing'
      case 'checking':
        return 'Checking...'
      case 'error':
        return lastError ? `Error: ${lastError}` : 'Error'
      default:
        return status
    }
  }
}
