import 'react-app-polyfill/stable';
import 'react-notifications-component/dist/theme.css';
import '@fortawesome/fontawesome-free/css/all.css';
import './styles/styles.global.scss';

import React from 'react';
import { createRoot } from 'react-dom/client';
import debounce from 'lodash/debounce';

import api from './ws-client';
import { Main } from './Main';
import { setBackendURLs, getWebSocketURL, getCurrentBackendURL, setCurrentBackendURL } from './utils';

async function initApp() {
    const defaultUrl = getWebSocketURL(window.location.host);
    try {
        // obviously we need a better solution for configuration management but it's functional as a POC ;)
        const headResponse = await fetch('backends.json', { method: 'HEAD' });
        if (headResponse.ok) {
            const response = await fetch('backends.json');
            const data = await response.json();
            const backendUrls = data.backends.map(backend => getWebSocketURL(backend.url, backend.secure));
            setBackendURLs([defaultUrl, ...backendUrls]);
            setCurrentBackendURL(getCurrentBackendURL() || backendUrls[0]);
        }
    } catch (error) {
        // In the event there are no additional backends defined, this falls back to the
        // old logic of (essentially):
        //      const apiUrl = `${window.location.host}${document.location.pathname}api`;
        //      const api = new Api(`${isSecurePage() ? 'wss' : 'ws'}://${apiUrl}`);
        setBackendURLs([defaultUrl]);
        setCurrentBackendURL(defaultUrl);
    }

    await Promise.resolve();
    api.connect()

    const domNode = document.getElementById('root');
    if (domNode) {
        createRoot(domNode).render(<Main />);
    }
}

initApp();
