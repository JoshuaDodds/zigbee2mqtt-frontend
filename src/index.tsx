import 'react-app-polyfill/stable';
import 'react-notifications-component/dist/theme.css';
import '@fortawesome/fontawesome-free/css/all.css';
import './styles/styles.global.scss';

import React from 'react';
import { createRoot } from 'react-dom/client';

import api from './ws-client';
import { Main } from './Main';
import { setBackendURLs, getWebSocketURL, getCurrentBackendURL, setCurrentBackendURL, getBackendURLs } from './utils';

async function initApp() {
    const defaultUrl = getWebSocketURL(window.location.host);
    try {
        const storedBackends = getBackendURLs();
        const backendUrls = storedBackends.length > 0 ? storedBackends : [defaultUrl];
        setBackendURLs(backendUrls);
        setCurrentBackendURL(getCurrentBackendURL() || backendUrls[0]);
    } catch (error) {
        // falls back to old logic of (essentially):
        //      const apiUrl = `${window.location.host}${document.location.pathname}api`;
        //      const api = new Api(`${isSecurePage() ? 'wss' : 'ws'}://${apiUrl}`);
        setBackendURLs([defaultUrl]);
        setCurrentBackendURL(defaultUrl);
    }

    await Promise.resolve();
    api.connect();

    const domNode = document.getElementById('root');
    if (domNode) {
        createRoot(domNode).render(<Main />);
    }
}

initApp();
