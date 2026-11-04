import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { api, canAdmin, type Principal, type Organization } from "./api";
import { EmailChange } from "./EmailChange";
import { ProfilePhoto } from "./ProfilePhoto";
import { Organizations } from "./Organizations";
import { PlatformAccounts } from "./PlatformAccounts";
import { QuickLinkSettings } from "./QuickLinks";
import { PersonFieldSettings } from "./PersonFields";
import { PersonPositionSettings } from "./PersonPositions";
import { PersonFilterSettings } from "./PersonFilterSettings";
import { PlanillaSettings } from "./PlanillaSettings";
import { PrivacyRequests } from "./PrivacyRequests";
import { broadcastLanguage, localizedTerms, t } from "./i18n";
import { ServiceStatus } from "./ServiceStatus";
import { FolderAccessSettings } from "./FolderAccessSettings";
import { Memberships } from "./Memberships";
import { ErrorBox, Modal } from "./ui";

export function SettingsPanel({
  principal,
  reload,
  setTheme,
}: {
  principal: Principal;
  reload: () => Promise<void>;
  setTheme: (v: string) => void;
}) {
  const [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState<Organization>(),
    [code, setCode] = useState("");
  const [title, setTitle] = useState(principal.user.title ?? ''),
    [titleEn, setTitleEn] = useState(principal.user.title_en ?? '');
  const [bio, setBio] = useState(principal.user.bio ?? ''),
    [bioEn, setBioEn] = useState(principal.user.bio_en ?? '');
  async function submit(
    e: FormEvent<HTMLFormElement>,
    path: string,
    method: string,
  ) {
    e.preventDefault();
    setError(null);
    setNotice("");
    setBusy(true);
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    if (d.version) d.version = +d.version;
    try {
      await api(path, method, d);
      if (d.theme) setTheme(d.theme);
      if (d.language) broadcastLanguage(d.language, principal.user_id);
      await reload();
      setNotice(t('Cambios guardados.'));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('Configuración')}</h1>
          <p className="muted">{t('Tu perfil, la identidad y los permisos de tu junta.')}</p>
        </div>
      </div>
      <nav className="settings-jump" aria-label={t('Secciones de configuración')}>
        <a href="#settings-profile">{t('Mi perfil')}</a>
        <a href="#settings-persons">{t('Personas y fichas')}</a>
        {canAdmin(principal.role) && <a href="#settings-access">{t('Acceso y permisos')}</a>}
        {canAdmin(principal.role) && <a href="#settings-services">{t('Estado de servicios')}</a>}
        <a href="#settings-security">{t('Seguridad y junta')}</a>
      </nav>
      <ErrorBox error={error} />
      {notice && (
        <p className="notice" role="status">
          <Check size={18} />
          {notice}
        </p>
      )}
      <section className="panel" id="settings-profile">
        <h2>{t('Mi perfil')}</h2>
        <ProfilePhoto key={`${principal.organization.id}:${principal.user_id}`} userId={principal.user_id} personId={principal.person_id} />
        <form onSubmit={(e) => submit(e, "profile", "PATCH")}>
          <div className="form-grid">
            <label>
              {t('Nombre')}
              <input
                name="name"
                defaultValue={principal.user.name}
                required
                maxLength={120}
              />
            </label>
            <label>
              {t('Correo de acceso')}
              <input value={principal.user.email} readOnly />
            </label>
            <label>
              {t('Cargo visible en esta junta (ES)')}
              <input name="title" value={title} onChange={event => setTitle(event.target.value)} required={Boolean(titleEn.trim())} maxLength={120} placeholder={t('Ej.: Coordinadora')} />
            </label>
            <label>
              {t('Cargo visible en esta junta (EN)')}
              <input name="title_en" value={titleEn} onChange={event => setTitleEn(event.target.value)} required={Boolean(title.trim())} maxLength={120} placeholder={t('Ejemplo: Community coordinator')} />
            </label>
            <label>
              {t('Acerca de mí (ES)')}
              <textarea name="bio" value={bio} onChange={event => setBio(event.target.value)} required={Boolean(bioEn.trim())} maxLength={500} rows={3} placeholder={t('Cuenta a tus contactos qué haces en la junta')} />
            </label>
            <label>
              {t('Acerca de mí (EN)')}
              <textarea name="bio_en" value={bioEn} onChange={event => setBioEn(event.target.value)} required={Boolean(bio.trim())} maxLength={500} rows={3} placeholder={t('Tell your contacts what you do in the council')} />
            </label>
            <label>
              {t('Tema')}
              <select name="theme" defaultValue={principal.user.theme}>
                <option value="light">{t('Claro')}</option>
                <option value="dark">{t('Oscuro')}</option>
              </select>
            </label>
            <label>
              {t('Preferencia de presencia')}
              <select name="presence" defaultValue={principal.user.presence}>
                <option value="online">{t('En línea')}</option>
                <option value="away">{t('Ausente')}</option>
                <option value="dnd">{t('No molestar')}</option>
                <option value="invisible">{t('Invisible')}</option>
              </select>
            </label>
            <label>
              {t('Idioma')}
              <select name="language" key={principal.user.language} defaultValue={principal.user.language}>
                <option value="es">{t('Español')}</option>
                <option value="en">{t('Inglés')}</option>
              </select>
            </label>
          </div>
          <p className="muted">{t('El cargo es opcional; si lo escribes, completa ambas versiones. Se muestra en Contactos y no cambia tus permisos.')}</p>
          <p className="muted">
            {t('Invisible aparece como Desconectado. No molestar oculta el indicador de avisos, pero conserva los mensajes en la bandeja.')}
          </p>
          <button className="primary" disabled={busy}>
            {t('Guardar perfil')}
          </button>
        </form>
      </section>
      <EmailChange onChanged={reload} />
      <QuickLinkSettings principal={principal} />
      <span id="settings-persons" className="settings-anchor" />
      <PersonFieldSettings key={`${principal.organization.id}:fields`} />
      {canAdmin(principal.role) && <PersonPositionSettings key={`${principal.organization.id}:positions`} />}
      <PersonFilterSettings key={`${principal.organization.id}:filters`} />
      <PlanillaSettings key={`${principal.organization.id}:planilla`} organizationName={principal.organization.name} />
      {canAdmin(principal.role) && <PrivacyRequests key={`${principal.organization.id}:privacy`} userId={principal.user_id} />}
      <span id="settings-access" className="settings-anchor" />
      {canAdmin(principal.role) && <FolderAccessSettings key={`${principal.organization.id}:folder-access`} />}
      {canAdmin(principal.role) && <Memberships key={`${principal.organization.id}:memberships`} principal={principal} />}
      {principal.role === 'superadmin' && <Organizations key={`${principal.organization.id}:organizations`} principal={principal} />}
      {principal.role === 'superadmin' && <PlatformAccounts key={`${principal.organization.id}:platform-accounts`} />}
      {canAdmin(principal.role) && <div id="settings-services"><div id="service-status"><ServiceStatus key={principal.organization.id} /></div></div>}
        <section className="panel" id="settings-security">
          <h2>{t('Seguridad de la cuenta')}</h2>
        <button
          disabled={busy}
          onClick={async () => {
            try {
              await api("auth/revokeOthers", "POST");
              setNotice(t('Las demás sesiones fueron revocadas.'));
            } catch (e) {
              setError(e);
            }
          }}
        >
          {t('Cerrar las demás sesiones')}
        </button>
      </section>
      <section className="panel">
        <h2>{t('Cambiar de junta')}</h2>
        <p className="muted">
          {t('Solo puedes entrar a una junta autorizada para tu cuenta. Debes aceptar sus términos.')}
        </p>
        <form
          className="filters"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setTarget(await api("organizations/" + encodeURIComponent(code)));
            } catch (e) {
              setError(e);
            }
          }}
        >
          <label className="grow">
            {t('Código de la junta')}
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('Ejemplo: barrio-central')}
            />
          </label>
          <button>{t('Cargar términos')}</button>
        </form>
      </section>
      {canAdmin(principal.role) && (
        <>
          <section className="panel">
            <h2>{t('Identidad de la junta')}</h2>
            <form onSubmit={(e) => submit(e, "organization", "PATCH")}>
              <input
                type="hidden"
                name="version"
                value={principal.organization.version}
              />
              <div className="form-grid">
                <label>
                  {t('Nombre')}
                  <input
                    name="name"
                    defaultValue={principal.organization.name}
                    required
                    maxLength={160}
                  />
                </label>
                <label>
                  {t('Color principal')}
                  <input
                    name="accent"
                    type="color"
                    defaultValue={principal.organization.accent}
                  />
                </label>
              </div>
              <button className="primary" disabled={busy}>
                {t('Guardar identidad')}
              </button>
            </form>
          </section>
          <section className="panel">
            <h2>
                  {t('Términos de uso')}
            </h2>
            <form onSubmit={(e) => submit(e, "organization/terms", "POST")}>
              <input
                type="hidden"
                name="version"
                value={principal.organization.terms.version}
              />
              <label>
                {t('Texto de los términos')}
                <textarea
                  name="body"
                  defaultValue={principal.organization.terms.body}
                  required
                  minLength={20}
                  maxLength={50000}
                  rows={8}
                />
              </label>
              <label>
                {t('Texto de los términos en inglés')}
                <textarea name="body_en" defaultValue={principal.organization.terms.body_en ?? ''}
                  required minLength={20} maxLength={50000} rows={8} />
              </label>
              <p className="muted">
                {t('Publicar una nueva versión exigirá que cada usuario la acepte para continuar.')}
              </p>
              <button className="primary" disabled={busy}>
                {t('Publicar nueva versión')}
              </button>
            </form>
          </section>
        </>
      )}
      {target && (
        <Modal
          title={t('Términos de {organization}', {organization: target.name})}
          onClose={() => setTarget(undefined)}
        >
          <p className="terms-text">{localizedTerms(target.terms)}</p>
          <button
            className="primary"
            onClick={async () => {
              try {
                await api("auth/switchOrganization", "POST", {
                  organization_code: target.code,
                  terms_version_id: target.terms.id,
                  accepted: true,
                });
                await reload();
                setTarget(undefined);
              } catch (e) {
                setError(e);
                setTarget(undefined);
              }
            }}
          >
            {t('Aceptar y cambiar de junta')}
          </button>
        </Modal>
      )}
    </>
  );
}
