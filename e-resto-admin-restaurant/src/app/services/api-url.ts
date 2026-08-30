declare global {
  interface Window {
    __E_RESTO_API_ROOT__?: string;
  }
}

const configuredApiRoot = window.__E_RESTO_API_ROOT__;
const LAN_HOST = '192.168.1.67';
const frontendHost = window.location.hostname || LAN_HOST;
const localHosts = ['localhost', '127.0.0.1', '::1'];
const isPrivateLanHost = /^(10|192\.168|172\.(1[6-9]|2\d|3[0-1]))\./.test(frontendHost);
const productionHosts = ['restaurascan.com', 'www.restaurascan.com', 'admin.restaurascan.com'];
const isLocalApiHost = localHosts.includes(frontendHost) || isPrivateLanHost;
const apiProtocol = isLocalApiHost ? 'http:' : window.location.protocol;
const defaultApiRoot = productionHosts.includes(frontendHost)
  ? 'https://api.restaurascan.com/api'
  : isLocalApiHost
  ? `${apiProtocol}//${frontendHost}:8000/api`
  : `${window.location.origin}/api`;

export const API_ROOT = (configuredApiRoot || defaultApiRoot).replace(/\/+$/, '');
export const STORAGE_ROOT = API_ROOT.replace(/\/api$/, '/storage');

