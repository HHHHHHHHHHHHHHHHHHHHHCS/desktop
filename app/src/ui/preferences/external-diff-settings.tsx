import * as React from 'react'
import { ICustomIntegration } from '../../lib/custom-integration'
import {
  LeftPathArgument,
  RightPathArgument,
} from '../../lib/custom-integration'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Row } from '../lib/row'
import { CustomIntegrationForm } from './custom-integration-form'

interface IExternalDiffSettingsProps {
  readonly useCustomExternalDiff: boolean
  readonly customExternalDiff: ICustomIntegration
  readonly onUseCustomExternalDiffChanged: (enabled: boolean) => void
  readonly onCustomExternalDiffChanged: (
    customExternalDiff: ICustomIntegration
  ) => void
}

export class ExternalDiffSettings extends React.Component<IExternalDiffSettingsProps> {
  private customExternalDiffFormRef = React.createRef<CustomIntegrationForm>()

  public componentDidUpdate(prevProps: IExternalDiffSettingsProps): void {
    if (
      !prevProps.useCustomExternalDiff &&
      this.props.useCustomExternalDiff
    ) {
      this.customExternalDiffFormRef.current?.focus()
    }
  }

  public render() {
    return (
      <fieldset>
        <legend>
          <h2>External Diff</h2>
        </legend>
        <Row>
          <Checkbox
            label="Use custom external diff tool for Diff file"
            value={
              this.props.useCustomExternalDiff
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onUseCustomExternalDiffChanged}
          />
        </Row>
        <Row>
          <p className="git-settings-description">
            Arguments must include both <code>{LeftPathArgument}</code> and{' '}
            <code>{RightPathArgument}</code>.
          </p>
        </Row>
        {this.props.useCustomExternalDiff && this.renderCustomExternalDiff()}
      </fieldset>
    )
  }

  private renderCustomExternalDiff() {
    return (
      <Row>
        <CustomIntegrationForm
          id="custom-external-diff"
          ref={this.customExternalDiffFormRef}
          path={this.props.customExternalDiff.path}
          arguments={this.props.customExternalDiff.arguments}
          requiredArgumentPlaceholders={[LeftPathArgument, RightPathArgument]}
          onPathChanged={this.onCustomExternalDiffPathChanged}
          onArgumentsChanged={this.onCustomExternalDiffArgumentsChanged}
        />
      </Row>
    )
  }

  private onUseCustomExternalDiffChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onUseCustomExternalDiffChanged(event.currentTarget.checked)
  }

  private onCustomExternalDiffPathChanged = (
    path: string,
    bundleID?: string
  ) => {
    this.props.onCustomExternalDiffChanged({
      path,
      bundleID,
      arguments: this.props.customExternalDiff.arguments,
    })
  }

  private onCustomExternalDiffArgumentsChanged = (args: string) => {
    this.props.onCustomExternalDiffChanged({
      path: this.props.customExternalDiff.path,
      bundleID: this.props.customExternalDiff.bundleID,
      arguments: args,
    })
  }
}
