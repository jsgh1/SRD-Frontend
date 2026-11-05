import {NativeModules} from 'react-native';

export const SRD_PRODUCTION_API_ORIGIN = 'https://srd-jsgh1.duckdns.org';

type MobileBuildConfig = {apiOrigin?: unknown; qaBuild?: unknown};

function isPrivateIpv4(host: string): boolean {
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function isLaboratoryHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.test')
    || normalized === '127.0.0.1'
    || normalized === '10.0.2.2'
    || isPrivateIpv4(normalized);
}

export function resolveSrdApiOrigin(config: MobileBuildConfig): string {
  if (typeof config.apiOrigin !== 'string' || typeof config.qaBuild !== 'boolean') {
    throw new Error('La compilación no contiene una configuración de servidor válida.');
  }

  let url: URL;
  try {
    url = new URL(config.apiOrigin);
  } catch {
    throw new Error('La dirección del servidor configurada no es válida.');
  }

  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('La dirección del servidor debe ser un origen sin credenciales ni rutas.');
  }

  if (config.qaBuild) {
    if (url.origin === SRD_PRODUCTION_API_ORIGIN || !isLaboratoryHost(url.hostname)) {
      throw new Error('La variante QA solo puede conectarse a un servidor local o de laboratorio.');
    }
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLaboratoryHost(url.hostname))) {
      throw new Error('El servidor QA debe usar HTTPS, salvo un Gateway local o privado de laboratorio.');
    }
    return url.origin;
  }

  if (config.apiOrigin !== SRD_PRODUCTION_API_ORIGIN) {
    throw new Error('La variante de producción solo puede usar el Gateway HTTPS oficial.');
  }
  return SRD_PRODUCTION_API_ORIGIN;
}

/** Reads the origin fixed into the native product flavor; a missing value fails closed. */
export function getSrdApiOrigin(): string {
  // React Native exposes values returned by NativeModule.getConstants() as
  // properties on NativeModules.SrdConnection; the native method itself is
  // not callable from JavaScript.
  const nativeConfig = NativeModules.SrdConnection as MobileBuildConfig | undefined;
  if (!nativeConfig) throw new Error('No se pudo leer la configuración segura de esta compilación.');
  return resolveSrdApiOrigin(nativeConfig);
}
