import { useEffect, useState } from 'react';
import { Download, MonitorDown, Smartphone, ShieldCheck } from 'lucide-react';
import { formatLocale, t } from './i18n';

type WindowsRelease = {
  version: string;
  platform: 'windows-x64';
  filename: 'SRD-Setup.exe';
  url: string;
  sizeBytes: number;
  publishedAt: string;
  sha256: string;
  signed: boolean;
};

function validRelease(value: unknown): value is WindowsRelease {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.version === 'string' && /^\d+\.\d+\.\d+$/.test(item.version)
    && item.platform === 'windows-x64' && item.filename === 'SRD-Setup.exe'
    && typeof item.url === 'string'
    && item.url === `/downloads/windows/${item.version}/SRD-Setup.exe`
    && typeof item.sizeBytes === 'number' && Number.isSafeInteger(item.sizeBytes) && item.sizeBytes > 0
    && typeof item.publishedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt)
    && typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256)
    && typeof item.signed === 'boolean';
}

export function Downloads() {
  const [release, setRelease] = useState<WindowsRelease | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/downloads/manifest.json', { signal: controller.signal, cache: 'no-store', credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null;
        const data: unknown = await response.json();
        return validRelease(data) ? data : null;
      })
      .then(setRelease)
      .catch(() => { if (!controller.signal.aborted) setRelease(null); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  return <div className="downloads-page">
    <div className="page-heading"><div>
      <h1>{t('Descargas')}</h1>
      <p className="muted">{t('Instala SRD en tu computador o consulta las opciones móviles.')}</p>
    </div></div>
    <section className="panel download-release" aria-labelledby="windows-release-title">
      <div className="download-release-main">
        <span className="download-platform-icon" aria-hidden="true"><MonitorDown size={28} strokeWidth={1.8} /></span>
        <div>
          <h2 id="windows-release-title">{t('SRD para Windows')}</h2>
          <p>{t('La misma plataforma de tu junta en una ventana de escritorio. Necesita conexión a Internet.')}</p>
        </div>
      </div>
      {release ? <>
        <dl className="download-details">
          <div><dt>{t('Versión')}</dt><dd>{release.version}</dd></div>
          <div><dt>{t('Sistema')}</dt><dd>Windows x64</dd></div>
          <div><dt>{t('Instalador')}</dt><dd>{release.filename}</dd></div>
          <div><dt>{t('Tamaño')}</dt><dd>{(release.sizeBytes / 1024 / 1024).toLocaleString(formatLocale(), { maximumFractionDigits: 1 })} MB</dd></div>
          <div><dt>{t('Publicado')}</dt><dd>{new Date(`${release.publishedAt}T12:00:00Z`).toLocaleDateString(formatLocale(), { dateStyle: 'medium', timeZone: 'UTC' })}</dd></div>
          <div><dt>{t('Firma digital')}</dt><dd>{release.signed ? t('Firmado') : t('Sin firma de código')}</dd></div>
        </dl>
        <div className="download-actions">
          <a className="primary download-button" href={release.url} download={release.filename}><Download size={18} /> {t('Descargar para Windows')}</a>
          <p>{release.signed
            ? t('Ejecuta el instalador y sigue los pasos de Windows.')
            : t('Esta versión de demostración no tiene firma de código. Windows puede mostrar una advertencia al instalarla.')}</p>
        </div>
        <div className="download-checksum">
          <ShieldCheck size={17} aria-hidden="true" />
          <div><strong>SHA-256</strong><code>{release.sha256}</code></div>
        </div>
      </> : <p className="download-unavailable" role="status">
        {loading ? t('Comprobando la versión disponible…') : t('El instalador para Windows todavía no está disponible.')}
      </p>}
    </section>
    <section className="panel download-release" aria-labelledby="android-release-title">
      <div className="download-release-main">
        <span className="download-platform-icon" aria-hidden="true"><Smartphone size={28} strokeWidth={1.8} /></span>
        <div>
          <h2 id="android-release-title">{t('SRD para Android')}</h2>
          <p>{t('Instala SRD en tu celular y accede a la junta con una conexión segura a Internet.')}</p>
        </div>
      </div>
      <dl className="download-details">
        <div><dt>{t('Versión')}</dt><dd>1.0.1</dd></div>
        <div><dt>{t('Sistema')}</dt><dd>{t('Android 7.0 o posterior')}</dd></div>
        <div><dt>{t('Paquete')}</dt><dd>SRD-Android-1.0.1-Demo.apk</dd></div>
        <div><dt>{t('Tamaño')}</dt><dd>{(123908991 / 1024 / 1024).toLocaleString(formatLocale(), { maximumFractionDigits: 1 })} MB</dd></div>
        <div><dt>{t('Publicado')}</dt><dd>{new Date('2026-10-28T12:00:00Z').toLocaleDateString(formatLocale(), { dateStyle: 'medium', timeZone: 'UTC' })}</dd></div>
        <div><dt>{t('Firma')}</dt><dd>{t('Certificado de demostración')}</dd></div>
      </dl>
      <div className="download-actions">
        <a className="primary download-button" href="https://github.com/jsgh1/SRD-Frontend/releases/download/srd-android-demo-1.0.1/SRD-Android-1.0.1-Demo.apk">
          <Download size={18} /> {t('Descargar para Android')}
        </a>
        <p>{t('Es una APK de demostración firmada con una clave de depuración; no es una publicación de Play Store y está destinada a la exposición.')}</p>
      </div>
      <div className="download-checksum">
        <ShieldCheck size={17} aria-hidden="true" />
        <div><strong>SHA-256</strong><code>52ed15e3f72ff12a910ebb8eefeb522a39132047205575f5db3771e787aea5ae</code></div>
      </div>
      <p className="download-install-note">{t('Android puede pedir autorización para instalar esta aplicación descargada. Verifica que el archivo se llame SRD-Android-1.0.1-Demo.apk.')}</p>
    </section>
  </div>;
}
