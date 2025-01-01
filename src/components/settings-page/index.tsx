import React, { Component } from 'react';
import { connect } from 'unistore/react';
import actions, { UtilsApi } from '../../actions/actions';
import { GlobalState } from '../../store';
import { NavLink, Redirect, RouteComponentProps, withRouter } from 'react-router-dom';
import Button from '../button';
import { ISubmitEvent, UiSchema, withTheme } from '@rjsf/core';
import { Theme as Bootstrap5Theme } from '@rjsf/bootstrap-5';
import cx from 'classnames';
import { JSONSchema7 } from 'json-schema';
import cloneDeep from 'lodash/cloneDeep';
import uiSchemas from './uiSchema.json';
import { BridgeApi } from '../../actions/BridgeApi';
import { WithTranslation, withTranslation } from 'react-i18next';
import { DescriptionField, TitleField } from '../../i18n/rjsf-translation-fields';
import { Stats } from './stats';
import frontendPackageJson from './../../../package.json';
import {
    computeSettingsDiff,
    formatDate,
    getBackendURLs,
    setBackendURLs,
    getCurrentBackendURL,
    setCurrentBackendURL,
    formatDisplayURL,
    getWebSocketURL,
} from '../../utils';
import { saveAs } from 'file-saver';
import Spinner from '../spinner';
import { TranslatedImageLocaliser } from './image-localiser';
import { DeviceApi } from '../../actions/DeviceApi';
import { tabs } from './tabs';

const Form = withTheme(Bootstrap5Theme);

type SettingsTab = 'settings' | 'bridge' | 'about' | 'tools' | 'donate' | 'translate' | 'ui-options';

type SettingsKeys = string;
type UrlParams = {
    tab?: SettingsTab;
};
type SettingsPageProps = RouteComponentProps<UrlParams>;

type SettingsPageState = {
    keyName: SettingsKeys;
};

const ROOT_KEY_NAME = 'main';

const ignoredFields = ['groups', 'devices', 'device_options', 'ban', 'whitelist', 'map_options'];
const validJsonSchemasAsTabs = ['object', 'array'];

const removePropertiesFromSchema = (
    names: string[],
    schema: JSONSchema7 = {},
    config: Record<string, unknown> = {},
) => {
    if (schema.required) {
        schema.required = schema.required.filter((item) => names.includes(item));
    }

    for (const name of names) {
        if (schema.properties) {
            delete schema.properties[name];
        }
        delete config[name];
    }

    return { schema, config };
};

const rows = [
    <div key="nurikk" className="row pb-2">
        <div className="col">
            <a target="_blank" rel="noopener noreferrer" href="https://www.buymeacoffee.com/nurikk">
                <img
                    crossOrigin="anonymous"
                    src="https://img.buymeacoffee.com/button-api/?text=Thanks for frontend&emoji=🍺&slug=nurikk&button_colour=FFDD00&font_colour=000000&font_family=Arial&outline_colour=000000&coffee_colour=ffffff"
                />
            </a>
        </div>
    </div>,
    <div key={'koenkk'} className="row pb-2">
        <div className="col">
            <a target="_blank" rel="noopener noreferrer" href="https://www.buymeacoffee.com/koenkk">
                <img
                    crossOrigin="anonymous"
                    src="https://img.buymeacoffee.com/button-api/?text=Thanks for zigbee2mqtt&emoji=☕&slug=koenkk&button_colour=FFDD00&font_colour=000000&font_family=Arial&outline_colour=000000&coffee_colour=ffffff"
                />
            </a>
        </div>
    </div>,
].sort(() => Math.random() - 0.5);

const isValidKeyToRenderAsTab = (key: string, value: JSONSchema7): boolean =>
    (validJsonSchemasAsTabs.includes(value.type as string) && !ignoredFields.includes(key)) ||
    (value && value.oneOf ? value.oneOf.length > 0 : false);
type PropsFromStore = Pick<
    GlobalState,
    'bridgeInfo' | 'missingTranslations' | 'devices' | 'backup' | 'preparingBackup'
>;
class SettingsPage extends Component<
    PropsFromStore & SettingsPageProps & DeviceApi & BridgeApi & UtilsApi & WithTranslation<'setting'>,
    SettingsPageState & {
        backends: string[];
        newBackend: string;
        newSecure: boolean;
    }
> {
    state = {
        keyName: ROOT_KEY_NAME,
        backends: getBackendURLs(),
        newBackend: '',
        newSecure: false,
    };
    settingsFormData: { [s: string]: Record<string, unknown> } = {};
    renderCategoriesTabs(): JSX.Element {
        const { t } = this.props;
        return (
            <ul className="nav nav-tabs">
                {tabs.map((tab) => (
                    <li key={tab.url} className="nav-item">
                        <NavLink className="nav-link" activeClassName="active" to={tab.url}>
                            {t(tab.translationKey)}
                        </NavLink>
                    </li>
                ))}
            </ul>
        );
    }
    render(): JSX.Element {
        return (
            <div className="tab">
                {this.renderCategoriesTabs()}
                <div className="tab-content h-100 p-0 p-sm-3">
                    <div className="tab-pane fade show active">{this.renderSwitcher()}</div>
                </div>
            </div>
        );
    }
    renderSwitcher(): JSX.Element {
        const { match } = this.props;
        const { tab } = match.params;
        switch (tab) {
            case 'tools':
                return this.renderTools();
            case 'bridge':
                return this.renderBridgeInfo();
            case 'about':
                return this.renderAbout();
            case 'settings':
                return this.renderSettings();
            case 'donate':
                return this.renderDonate();
            case 'translate':
                return this.renderTranslate();
            case 'ui-options':
                return this.renderUiOptions();
            default:
                return <Redirect to={`/settings/settings`} />;
        }
    }
    handleAddBackend = () => {
        const { newBackend, newSecure, backends } = this.state;
        if (!newBackend) return;
        const updatedBackends = [...backends, getWebSocketURL(newBackend, newSecure)];
        setBackendURLs(updatedBackends);
        this.setState({ backends: updatedBackends, newBackend: '', newSecure: false });
        window.location.reload();
    };

    handleRemoveBackend = (index: number) => {
        const { backends } = this.state;
        const updatedBackends = backends.filter((_, i) => i !== index);
        setBackendURLs(updatedBackends);
        this.setState({ backends: updatedBackends });
        window.location.reload();
    };

    handleUpdateBackend = (index: number, url: string, secure: boolean) => {
        const { backends } = this.state;
        const updatedBackend = getWebSocketURL(url, secure);
        const updatedBackends = backends.map((backend, i) => (i === index ? updatedBackend : backend));
        setBackendURLs(updatedBackends);
        this.setState({ backends: updatedBackends });
        window.location.reload();
    };

    renderUiOptions(): JSX.Element {
        const { t } = this.props;
        const { backends, newBackend, newSecure } = this.state;

        return (
            <div className="p-3">
                <p>
                    <h4>{t('settings:additional_backend_header')} </h4>
                    <hr />
                    <p>
                        {t('settings:additional_backend_title')} <br />
                        {t('settings:additional_backend_description')}{' '}
                    </p>
                    <p>{t('settings:additional_backend_secure_description')} </p>
                </p>
                <div className="mb-3">
                    {backends.length === 0 ? (
                        <div className="d-flex align-items-center mb-2">
                            <input
                                type="text"
                                className="form-control me-2"
                                placeholder={t('settings:additional_backend_host_tip')}
                                value={newBackend}
                                onChange={(e) => this.setState({ newBackend: e.target.value })}
                            />
                            <div className="form-check me-2">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="secureCheckbox"
                                    checked={newSecure}
                                    onChange={() => this.setState({ newSecure: !newSecure })}
                                />
                                <label className="form-check-label" htmlFor="secureCheckbox">
                                    {t('settings:additional_backend_secure_label')}
                                </label>
                            </div>
                            <button className="btn btn-primary" onClick={this.handleAddBackend}>
                                +
                            </button>
                        </div>
                    ) : (
                        <>
                            {backends.map((backend, index) => {
                                const parsedBackend = new URL(backend);
                                const isSecure = parsedBackend.protocol === 'wss:';
                                const hostname = parsedBackend.hostname;

                                if (index === 0) {
                                    return (
                                        <div key={index} className="d-flex align-items-center mb-2">
                                            <input
                                                type="text"
                                                className="form-control me-5"
                                                value={hostname}
                                                disabled
                                            />
                                            <span className="badge bg-secondary me-2">
                                                This host is derived and cannot be edited
                                            </span>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={index} className="d-flex align-items-center mb-2">
                                        <input
                                            type="text"
                                            className="form-control me-2"
                                            defaultValue={hostname}
                                            onBlur={(e) => this.handleUpdateBackend(index, e.target.value, isSecure)}
                                        />
                                        <div className="form-check me-2">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id={`secureCheckbox-${index}`}
                                                checked={isSecure}
                                                onChange={(e) =>
                                                    this.handleUpdateBackend(index, hostname, e.target.checked)
                                                }
                                            />
                                            <label
                                                className="form-check-label me-7"
                                                htmlFor={`secureCheckbox-${index}`}
                                            >
                                                {t('settings:additional_backend_secure_label')}
                                            </label>
                                        </div>
                                        <button
                                            className="btn btn-danger w-25"
                                            onClick={() => this.handleRemoveBackend(index)}
                                        >
                                            -
                                        </button>
                                    </div>
                                );
                            })}
                            <div className="d-flex align-items-center mt-3">
                                <input
                                    type="text"
                                    className="form-control me-2"
                                    placeholder={t('settings:additional_backend_host_tip')}
                                    value={newBackend}
                                    onChange={(e) => this.setState({ newBackend: e.target.value })}
                                />
                                <div className="form-check me-2">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="newSecureCheckbox"
                                        checked={newSecure}
                                        onChange={() => this.setState({ newSecure: !newSecure })}
                                    />
                                    <label className="form-check-label me-7" htmlFor="newSecureCheckbox">
                                        {t('settings:additional_backend_secure_label')}
                                    </label>
                                </div>
                                <button className="btn btn-primary w-25" onClick={this.handleAddBackend}>
                                    +
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }
    renderTranslate(): JSX.Element {
        const { t } = this.props;
        return (
            <div className="p-3">
                <p>
                    {t('settings:translation_prompt')}{' '}
                    <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href="https://poeditor.com/join/project?hash=Az88waAhPd"
                    >
                        POEditor
                    </a>
                </p>
            </div>
        );
    }
    renderAbout(): JSX.Element {
        const { bridgeInfo, devices, t } = this.props;
        const isZigbee2mqttDevVersion = bridgeInfo.version?.match(/^\d+\.\d+\.\d+$/) === null;
        const zigbee2mqttVersion = isZigbee2mqttDevVersion ? (
            bridgeInfo.version
        ) : (
            <a
                target="_blank"
                rel="noopener noreferrer"
                href={`https://github.com/Koenkk/zigbee2mqtt/releases/tag/${bridgeInfo.version}`}
            >
                {bridgeInfo.version}
            </a>
        );
        const zigbee2mqttCommit = bridgeInfo.commit ? (
            <>
                commit:{' '}
                <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://github.com/Koenkk/zigbee2mqtt/commit/${bridgeInfo.commit}`}
                >
                    {bridgeInfo.commit}
                </a>
            </>
        ) : null;

        const rows = [
            {
                translationKey: 'zigbee2mqtt_version',
                content: (
                    <>
                        {zigbee2mqttVersion} {zigbee2mqttCommit}
                    </>
                ),
            },
            { translationKey: 'coordinator_type', content: <>{bridgeInfo.coordinator?.type ?? t('common:unknown')}</> },
            {
                translationKey: 'coordinator_revision',
                content: <>{bridgeInfo.coordinator?.meta?.revision ?? t('common:unknown')}</>,
            },
            {
                translationKey: 'coordinator_ieee_address',
                content: <>{bridgeInfo.coordinator?.ieee_address ?? t('common:unknown')}</>,
            },
            { translationKey: 'frontend_version', content: frontendPackageJson.version },
            {
                translationKey: 'zigbee_herdsman_converters_version',
                content: bridgeInfo.zigbee_herdsman_converters?.version ?? t('common:unknown'),
            },
            {
                translationKey: 'zigbee_herdsman_version',
                content: bridgeInfo.zigbee_herdsman?.version ?? t('common:unknown'),
            },
            { translationKey: 'stats', content: <Stats devices={devices} /> },
        ];

        return (
            <div className="p-3">
                {rows.map((row) => (
                    <dl key={row.translationKey} className="row">
                        <dt className="col-sm-3">{t(row.translationKey)}</dt>
                        <dd className="col-sm-9">{row.content}</dd>
                    </dl>
                ))}
            </div>
        );
    }
    renderBridgeInfo(): JSX.Element {
        const { bridgeInfo } = this.props;
        return (
            <div className="p-3">
                <pre>{JSON.stringify(bridgeInfo, null, 4)}</pre>
            </div>
        );
    }
    downloadBackup = (): void => {
        const { backup, bridgeInfo } = this.props;
        const ts = formatDate(new Date()).replace(/[\s_:]/g, '-');
        const backupFileName = `z2m-backup.${bridgeInfo.version}.${ts}.zip`;
        saveAs(`data:application/zip;base64,${backup}`, backupFileName);
    };

    renderBackupControls(): JSX.Element {
        const { backup, preparingBackup, requestBackup, t } = this.props;
        if (preparingBackup) {
            return (
                <Button className="btn btn-primary d-block mt-2 disabled">
                    <Spinner />
                </Button>
            );
        } else {
            if (backup) {
                return (
                    <Button className="btn btn-primary d-block mt-2" onClick={this.downloadBackup}>
                        {t('download_z2m_backup')}
                    </Button>
                );
            } else {
                return (
                    <Button className="btn btn-primary d-block mt-2" onClick={requestBackup}>
                        {t('request_z2m_backup')}
                    </Button>
                );
            }
        }
    }

    addInstallCode = () => {
        const { t, addInstallCode } = this.props;
        const code = prompt(t('enter_install_code'));
        if (code) {
            addInstallCode(code);
        }
    };

    renderTools(): JSX.Element {
        const { exportState, restartBridge, setDeviceOptions, devices, t } = this.props;
        return (
            <div className="p-3">
                <Button className="btn btn-primary d-block mt-2" onClick={exportState}>
                    {t('download_state')}
                </Button>
                <Button className="btn btn-danger d-block mt-2" onClick={restartBridge} prompt>
                    {t('restart_zigbee2mqtt')}
                </Button>
                {this.renderBackupControls()}
                <Button className="btn btn-primary d-block mt-2" onClick={this.addInstallCode}>
                    {t('add_install_code')}
                </Button>
                <TranslatedImageLocaliser setDeviceOptions={setDeviceOptions} devices={devices} />
            </div>
        );
    }
    onSettingsSave = (e: ISubmitEvent<Record<string, unknown>>): void => {
        const { formData } = e;
        const { updateBridgeConfig } = this.props;
        const { keyName } = this.state;
        const diff = computeSettingsDiff(this.getSettingsInfo().currentConfig, formData);
        if (keyName === ROOT_KEY_NAME) {
            updateBridgeConfig(diff);
        } else {
            updateBridgeConfig({ [keyName]: diff });
        }
    };

    getSettingsTabs(): { name: string; title: string }[] {
        const {
            bridgeInfo: { config_schema: configSchema = { properties: {} } },
            t,
        } = this.props;
        const tabs = Object.entries<JSONSchema7>(configSchema.properties as unknown as ArrayLike<JSONSchema7>)
            .filter(([key, value]) => isValidKeyToRenderAsTab(key, value))
            .map(([key, value]) => ({
                name: key,
                title: t(key, { defaultValue: value.title }),
            }));
        tabs.unshift({
            name: ROOT_KEY_NAME,
            title: t('main', { defaultValue: 'Main' }),
        });
        return tabs;
    }
    getSettingsInfo(): { currentSchema: JSONSchema7; currentConfig: Record<string, unknown> } {
        const { keyName } = this.state;
        const {
            bridgeInfo: { config_schema: configSchema, config: originalConfig },
        } = this.props;

        let configAndSchema = removePropertiesFromSchema(
            ignoredFields,
            cloneDeep(configSchema),
            cloneDeep<Record<string, unknown>>(originalConfig),
        );

        let currentSchema: JSONSchema7 = configAndSchema.schema;
        let currentConfig: Record<string, unknown>;

        if (keyName === ROOT_KEY_NAME) {
            const ignoreTabNames = this.getSettingsTabs().map((tab) => tab.name);
            configAndSchema = removePropertiesFromSchema(
                ignoreTabNames,
                configAndSchema.schema,
                configAndSchema.config,
            );
            currentSchema = configAndSchema.schema;
            currentConfig = configAndSchema.config;
        } else {
            currentConfig = configAndSchema.config[keyName] as Record<string, unknown>;
            if (configAndSchema.schema.properties) {
                currentSchema = configAndSchema.schema.properties[keyName] as JSONSchema7;
            }
        }
        return { currentSchema, currentConfig };
    }
    renderSettingsTabs(): JSX.Element {
        const { t } = this.props;
        const tabs = this.getSettingsTabs();
        const { keyName } = this.state;
        return (
            <div className="nav nav-pills">
                {tabs.map((tab) => (
                    <li key={tab.name} className="nav-item">
                        <a
                            className={cx('nav-link', { 'bg-primary active': keyName === tab.name })}
                            aria-current="page"
                            href="#"
                            onClick={(e) => {
                                this.setState({ keyName: tab.name });
                                e.preventDefault();
                            }}
                        >
                            {t(tab.name, { defaultValue: tab.title })}
                        </a>
                    </li>
                ))}
            </div>
        );
    }
    renderSettings(): JSX.Element {
        const { keyName } = this.state;
        const { currentSchema, currentConfig } = this.getSettingsInfo();
        // Put formData in separate variable to prevent overwrites on re-render.
        if (!(keyName in this.settingsFormData)) {
            this.settingsFormData[keyName] = currentConfig;
        }
        return (
            <div className="tab">
                {this.renderSettingsTabs()}
                <div className="tab-content">
                    <div className="tab-pane active">
                        <Form
                            idPrefix={keyName}
                            schema={currentSchema}
                            formData={this.settingsFormData[keyName]}
                            onChange={(data) => (this.settingsFormData[keyName] = data.formData)}
                            onSubmit={this.onSettingsSave}
                            uiSchema={uiSchemas[keyName] as UiSchema}
                            fields={{ TitleField, DescriptionField }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    renderDonate(): JSX.Element {
        const { t } = this.props;
        const donateText: string[] = t('donation_text', { returnObjects: true, defaultValue: [] });
        return (
            <div className="container-fluid">
                {donateText.map((row) => (
                    <p key={row}>{row}</p>
                ))}
                {rows}
            </div>
        );
    }
}
const SettingsPageWithRouter = withRouter(SettingsPage);
const mappedProps = ['bridgeInfo', 'missingTranslations', 'devices', 'backup', 'preparingBackup'];
export const ConnectedSettingsPage = withTranslation(['settings', 'common'])(
    connect<Record<string, unknown>, Record<string, unknown>, GlobalState, DeviceApi & BridgeApi>(
        mappedProps,
        actions,
    )(SettingsPageWithRouter),
);
