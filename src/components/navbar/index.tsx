import React, { FunctionComponent, useRef, useState, useEffect } from 'react';

import { GlobalState } from '../../store';
import actions, { ThemeActions } from '../../actions/actions';
import { connect } from 'unistore/react';
import Button from '../button';
import cx from 'classnames';
import { Link, NavLink } from 'react-router-dom';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import { BridgeApi } from '../../actions/BridgeApi';
import { ThemeSwitcher } from '../theme-switcher';
import { WithTranslation, withTranslation } from 'react-i18next';
import LocalePicker from '../../i18n/LocalePicker';
import { StartStopJoinButton } from './StartStopJoinButton';
import { SettingsDropdown } from './SettingsDropdown';
import {
    isIframe,
    getCurrentBackendURL,
    getBackendURLs,
    setCurrentBackendURL,
    getWebSocketURL,
    formatDisplayURL,
} from '../../utils';
import api from '../../ws-client';

const urls = [
    {
        href: '/',
        key: 'devices',
        exact: true,
    },
    {
        href: '/dashboard',
        key: 'dashboard',
    },
    {
        href: '/map',
        key: 'map',
    },
    {
        href: '/groups',
        key: 'groups',
    },
    {
        href: '/ota',
        key: 'ota',
    },
    {
        href: '/touchlink',
        key: 'touchlink',
    },
    {
        href: '/logs',
        key: 'logs',
    },
    {
        href: '/extensions',
        key: 'extensions',
    },
];

type PropsFromStore = Pick<GlobalState, 'devices' | 'bridgeInfo'>;

const NavBar: FunctionComponent<PropsFromStore & ThemeActions & WithTranslation<'navbar'> & BridgeApi> = (props) => {
    const { devices, setPermitJoin, bridgeInfo, restartBridge, setTheme, t } = props;
    const ref = useRef<HTMLDivElement>();
    const [navbarIsVisible, setNavbarIsVisible] = useState<boolean>(false);
    const [backends, setBackends] = useState<string[]>([]);
    const [currentBackend, setCurrentBackend] = useState<string>('');

    useEffect(() => {
        const loadedBackends = getBackendURLs();
        setBackends(loadedBackends);
        if (loadedBackends.length > 1 || (loadedBackends.length === 1 && loadedBackends[0])) {
            setCurrentBackend(getCurrentBackendURL() || loadedBackends[0]);
        }
    }, []);

    const handleSelectBackend = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newBackend = event.target.value;
        setCurrentBackendURL(newBackend);
        setCurrentBackend(newBackend);
        const newUrl = getWebSocketURL(newBackend);
        api.updateUrl(newUrl); // Update the WebSocket connection
    };

    useOnClickOutside(ref, () => {
        setNavbarIsVisible(false);
    });

    return (
        <nav className="navbar navbar-expand-md navbar-light">
            <div ref={ref as React.MutableRefObject<HTMLDivElement>} className="container-fluid">
                <Link onClick={() => setNavbarIsVisible(false)} to="/">
                    {isIframe() ? `Z2M@${document.location.hostname}` : 'Zigbee2MQTT'}
                </Link>

                <button
                    onClick={() => {
                        setNavbarIsVisible(!navbarIsVisible);
                    }}
                    className="navbar-toggler"
                    type="button"
                >
                    <span className="navbar-toggler-icon" />
                </button>
                <div className={cx('navbar-collapse collapse', { show: navbarIsVisible })}>
                    <ul className="navbar-nav">
                        {urls.map((url) => (
                            <li key={url.href} className="nav-item">
                                <NavLink
                                    onClick={() => setNavbarIsVisible(false)}
                                    exact={url.exact}
                                    className="nav-link"
                                    to={url.href}
                                    activeClassName="active"
                                >
                                    {t(url.key)}
                                </NavLink>
                            </li>
                        ))}
                        <SettingsDropdown />
                        <LocalePicker />
                    </ul>
                    <StartStopJoinButton devices={devices} setPermitJoin={setPermitJoin} bridgeInfo={bridgeInfo} />
                    <ThemeSwitcher saveCurrentTheme={setTheme} />
                </div>
                {bridgeInfo.restart_required ? (
                    <Button onClick={restartBridge} prompt className="btn btn-danger me-1">
                        {t('restart')}
                    </Button>
                ) : null}
                {backends.length > 1 && (
                    <div className="backend-selector dropdown">
                        <label htmlFor="backend-select" class="visually-hidden"></label>
                        <select
                            id="backend-select"
                            value={currentBackend}
                            onChange={handleSelectBackend}
                            class="form-select rounded border-secondary"
                        >
                            {backends.map((backend, index) => (
                                <option key={index} value={backend}>
                                    {formatDisplayURL(backend)}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </nav>
    );
};

const mappedProps = ['bridgeInfo', 'devices'];
const ConnectedNavBar = withTranslation('navbar')(
    connect<unknown, unknown, PropsFromStore, BridgeApi>(mappedProps, actions)(NavBar),
);
export default ConnectedNavBar;
