declare global {
  interface Window {
    __E_RESTO_API_ROOT__?: string;
  }
}

const configuredApiRoot = window.__E_RESTO_API_ROOT__;
const LAN_HOST = '192.168.1.67';
const frontendHost = window.location.hostname || LAN_HOST;
const localHosts = ['localhost', '127.0.0.1', '::1'];
const productionHosts = ['restaurascan.com', 'www.restaurascan.com', 'admin.restaurascan.com'];
const apiProtocol = localHosts.includes(frontendHost) ? 'http:' : window.location.protocol;
const defaultApiRoot = productionHosts.includes(frontendHost)
  ? 'https://api.restaurascan.com/api'
  : `${apiProtocol}//${frontendHost}:8000/api`;

export const API_ROOT = (configuredApiRoot || defaultApiRoot).replace(/\/+$/, '');
export const STORAGE_ROOT = API_ROOT.replace(/\/api$/, '/storage');
