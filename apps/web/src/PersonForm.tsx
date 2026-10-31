import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { api, roleNames, type Principal } from "./api";
import { ErrorBox, Loading, Modal } from "./ui";
import { AdditionalInputs, type FieldSchema } from "./PersonFields";
import { type PositionCatalog } from "./PersonPositions";
import { PersonPhotos } from "./PersonPhotos";
import { localizedLabel, t } from "./i18n";
import { documents, genders, positions, type Person } from "./personTypes";

export function PersonForm({
  principal,
  initial,
  onSaved,
  onBack,
}: {
  principal: Principal;
  initial?: Person;
  onSaved: () => void;
  onBack: () => void;
}) {
  const [zone, setZone] = useState(initial?.zone || ""),
    [status, setStatus] = useState(initial?.status || "pending"),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [clear, setClear] = useState(false),
    [formKey, setFormKey] = useState(0),
    [changeZone, setChangeZone] = useState<string | null>(null);
  const complete = status === "complete";
  const [schema, setSchema] = useState<FieldSchema>(), [schemaError, setSchemaError] = useState<unknown>(), [schemaBusy, setSchemaBusy] = useState(false);
  const [catalog, setCatalog] = useState<PositionCatalog>();
  const [createdId, setCreatedId] = useState<string>();
  const [inviteAccess, setInviteAccess] = useState(false);
  const [inviteFailure, setInviteFailure] = useState<{person_id: string; email: string; role: string}>();
  const [inviteNotice, setInviteNotice] = useState('');
  async function retryInvitation() {
    if (!inviteFailure) return;
    setBusy(true); setError(undefined);
    try {
      await api('invitations', 'POST', inviteFailure);
      setInviteFailure(undefined);
      setInviteNotice('Invitación creada. La persona recibirá un correo para activar su cuenta.');
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  }
  async function loadSchema() {
    setSchemaBusy(true); setSchemaError(undefined);
    try { const [fields, cargos] = await Promise.all([api<FieldSchema>('person-fields'), api<PositionCatalog>('person-positions')]); setSchema(fields); setCatalog(cargos); } catch (e) { setSchemaError(e); }
    finally { setSchemaBusy(false); }
  }
  useEffect(() => { loadSchema(); }, []);
  function todayInBogota() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function field(
    name: string,
    label: string,
    type = "text",
    required = false,
    max = 120,
  ) {
    const examples: Record<string, string> = {
      document_number: 'Ej.: 1234567890',
      first_names: 'Ej.: María Elena',
      last_names: 'Ej.: Pérez López',
      phone: 'Ej.: 300 123 4567',
      email: 'nombre@ejemplo.com',
    };
    return (
      <label>
        {t(label)}
        {required ? " *" : ""}
        <input
          name={name}
          type={type}
          defaultValue={initial?.[name] ?? ""}
          required={required}
          maxLength={max}
          max={name === 'birth_date' ? todayInBogota() : undefined}
          placeholder={examples[name] ? t(examples[name]) : undefined}
        />
      </label>
    );
  }
  function select(
    name: string,
    label: string,
    options: Record<string, string>,
    required = false,
  ) {
    return (
      <label>
        {t(label)}
        {required ? " *" : ""}
        <select
          name={name}
          defaultValue={
            initial?.[name] === null ? "" : String(initial?.[name] ?? "")
          }
          required={required}
        >
          <option value="">{t('Seleccionar')}</option>
          {Object.entries(options).map(([v, l]) => (
            <option key={v} value={v}>
              {t(l)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || createdId) return;
    const addPhotos = !initial && (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-after-save') === 'photos';
    setError(null);
    setBusy(true);
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    const requestedRole = d.invite_role || 'viewer';
    delete d.invite_role;
    if (!initial && inviteAccess && !String(d.email || '').trim()) {
      setError(new Error(t('Escribe el correo de la persona para enviar la invitación.')));
      setBusy(false);
      return;
    }
    if (!schema || !catalog || schemaBusy || schemaError) { setBusy(false); return; }
    d.schema_version = schema.version;
    d.positions_version = catalog.version;
    d.custom_values = {};
    for (const key of Object.keys(d)) if (key.startsWith('custom_') && key !== 'custom_values') { d.custom_values[key.slice(7)] = d[key] || null; delete d[key]; }
    for (const k of Object.keys(d)) if (d[k] === "") d[k] = null;
    if (d.affiliated !== null) d.affiliated = d.affiliated === "1";
    if (initial) d.version = initial.version;
    try {
      const saved = await api<{id: string}>(
        "persons" + (initial ? "/" + initial.id : ""),
        initial ? "PATCH" : "POST",
        d,
      );
      if (!initial && inviteAccess && d.email) {
        const request = {person_id: saved.id, email: String(d.email), role: requestedRole};
        setCreatedId(saved.id);
        try {
          await api('invitations', 'POST', request);
          setInviteNotice('Invitación creada. La persona recibirá un correo para activar su cuenta.');
        } catch (inviteError) {
          setInviteFailure(request);
          setError(inviteError);
        }
      } else if (addPhotos) setCreatedId(saved.id);
      else onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (createdId) return <>
    <div className="page-heading"><div><span className="eyebrow">{principal.organization.name}</span><h1>{t('Fotografías del nuevo registro')}</h1>
      <p role="status">{t('El registro ya está guardado. Puedes añadir sus fotografías ahora o hacerlo después desde la lista.')}</p></div></div>
    <ErrorBox error={error} />
    {inviteNotice && <p className="notice" role="status">{t(inviteNotice)}</p>}
    {inviteFailure && <button type="button" disabled={busy} onClick={retryInvitation}>{t('Reintentar invitación')}</button>}
    <div className="panel"><PersonPhotos id={createdId} /></div>
    <div className="actions end"><button type="button" className="primary" onClick={onSaved}>{t('Terminar e ir a la lista')}</button></div>
  </>;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{principal.organization.name}</span>
          <h1>{t(initial ? 'Editar persona' : 'Nuevo registro')}</h1>
          <p className="muted">
            {t('Los campos con * son obligatorios para el estado elegido.')} {t(initial ? 'Puedes gestionar las fotografías desde el detalle de la persona.' : 'Puedes guardar y continuar con sus fotografías.')}
          </p>
        </div>
        <button onClick={onBack}>
          <ArrowLeft size={18} />
          {t('Volver')}
        </button>
      </div>
      <ErrorBox error={error} />
      <form key={formKey} onSubmit={save} className="person-form">
        <ErrorBox error={schemaError} />
        {schemaBusy && <Loading />}
        <button type="button" disabled={schemaBusy || busy} onClick={loadSchema}>{t('Recargar configuración de campos')}</button>
        <section className="panel">
          <div className="section-heading">
            <h2>{t('01 · Identificación')}</h2>
            <label className="inline">
              {t('Estado')}
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="pending">{t('Pendiente')}</option>
                <option value="complete">{t('Completado')}</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            {select("document_type", "Tipo de documento", documents, true)}
            {field("document_number", "Número de documento", "text", true, 30)}
            {field("first_names", "Nombres", "text", true)}
            {field("last_names", "Apellidos", "text", complete)}
            {select("gender", "Género", genders, complete)}
            {field("birth_date", "Fecha de nacimiento", "date", complete)}
          </div>
        </section>
        <section className="panel">
          <h2>{t('02 · Comunidad y ubicación')}</h2>
          <div className="form-grid">
            {select(
              "affiliated",
              "Afiliado",
              { "1": "Sí", "0": "No" },
              complete,
            )}
            <label>
              {t('Zona')}{complete ? ' *' : ''}
              <select
                name="zone"
                value={zone}
                required={complete}
                onChange={(e) => {
                  if (zone && zone !== e.target.value)
                    setChangeZone(e.target.value);
                  else setZone(e.target.value);
                }}
              >
                <option value="">{t('Seleccionar')}</option>
                <option value="rural">{t('Rural')}</option>
                <option value="urban">{t('Urbana')}</option>
              </select>
            </label>
            {zone === "rural" &&
              field(
                "property_name",
                "Nombre del predio",
                "text",
                complete,
                160,
              )}
            {zone === "urban" && (
              <>
                {field("address", "Dirección", "text", complete, 180)}
                {field("neighborhood", "Barrio", "text", complete, 100)}
              </>
            )}
            {catalog && select("position_code", "Cargo", Object.fromEntries(catalog.items.filter(i => i.active || i.code === initial?.position_code).map(i => [i.code, i.code === initial?.position_code
              ? `${localizedLabel({label: initial.position_label || i.label, label_en: initial.position_label_en})}${i.active ? '' : ` ${t('(inactivo)')}`}`
              : localizedLabel(i)])), complete)}
            {select(
              "descriptive_role",
              "Función en la comunidad",
              Object.fromEntries(
                Object.entries(roleNames).filter(([v]) => v !== "superadmin"),
              ),
              complete,
            )}
            <label>
              {t('Junta de pertenencia')}
              <input value={principal.organization.name} readOnly />
            </label>
          </div>
          <p className="muted">
            {t('La función en la comunidad describe a la persona en la ficha. El rol de acceso de la invitación define qué puede hacer dentro de SRD.')}
          </p>
        </section>
        {!initial && <section className="panel">
          <h2>{t('Acceso al sistema')}</h2>
          <label className="inline">
            <input type="checkbox" checked={inviteAccess} onChange={e => setInviteAccess(e.target.checked)} />
            {t('Enviar invitación al correo de esta persona después de guardar')}
          </label>
          {inviteAccess && <div className="form-grid"><label>
            {t('Rol de acceso')}
            <select name="invite_role" defaultValue="viewer">
              {(principal.role === 'registrar' ? ['viewer'] : ['viewer', 'registrar', 'treasurer', 'auditor', 'admin']).map(role =>
                <option key={role} value={role}>{t(roleNames[role])}</option>)}
            </select>
          </label></div>}
          <p className="muted">{t('Se requiere un correo en la ficha. La persona confirma la invitación, acepta los términos y crea su propia contraseña. El registrador solo puede invitar con rol Consultor.')}</p>
        </section>}
        <section className="panel">
          <h2>{t('03 · Contacto')}</h2>
          <div className="form-grid">
            {field("phone", "Teléfono", "tel", complete, 20)}
            {field("email", "Correo electrónico", "email", complete, 254)}
          </div>
        </section>
        <section className="panel">
          <h2>{t('04 · Autorización de tratamiento')}</h2>
          <div className="form-grid">
            <label>
              {t('Fundamento o referencia del soporte')}{complete ? ' *' : ''}
              <input
                name="authorization_basis"
                required={complete}
                maxLength={120}
                placeholder={t('Ej.: consentimiento firmado el 10/10/2026')}
                defaultValue={initial?.authorization?.basis || ""}
              />
            </label>
            <label>
              {t('Finalidad de la captura')}{complete ? ' *' : ''}
              <input
                name="authorization_purpose"
                required={complete}
                maxLength={1000}
                placeholder={t('Ej.: gestionar el registro de la junta')}
                defaultValue={initial?.authorization?.purpose || ""}
              />
            </label>
          </div>
          <p className="muted">
            {t('Indica cómo autorizó la persona el uso de sus datos y para qué se usarán. En Pendiente puedes dejar ambos campos vacíos; para completar la ficha debes diligenciarlos.')} {t('La aceptación de términos del usuario no sustituye la autorización de la persona registrada.')}
          </p>
        </section>
        {schema && <AdditionalInputs schema={schema} previous={initial?.custom_fields} complete={complete} />}
        <section className="panel internal-note">
          <h2>{t('Nota interna')}</h2>
          <label>
            {t('Información reservada a administración y registro')}
            <textarea
              name="note"
              rows={4}
              maxLength={4000}
              defaultValue={initial?.note || ""}
            />
          </label>
        </section>
        <div className="form-actions">
          <button type="button" onClick={() => setClear(true)}>
            {t('Vaciar formulario')}
          </button>
          <button className="primary" disabled={busy || schemaBusy || !schema || !!schemaError}>
            <Save size={18} />
            {busy
              ? t('Guardando…')
              : initial
                ? t('Guardar cambios')
                : t('Guardar registro')}
          </button>
          {!initial && <button type="submit" data-after-save="photos" disabled={busy || schemaBusy || !schema || !!schemaError}>{t('Guardar y añadir fotos')}</button>}
        </div>
      </form>
      {clear && (
        <Modal title={t('Vaciar formulario')} onClose={() => setClear(false)}>
          <p>{t('Se descartarán los datos que has digitado en este formulario.')}</p>
          <div className="actions end">
            <button onClick={() => setClear(false)}>{t('Cancelar')}</button>
            <button
              className="primary"
              onClick={() => {
                document
                  .querySelector<HTMLFormElement>(".person-form")
                  ?.reset();
                setZone(initial?.zone || "");
                setStatus(initial?.status || "pending");
                setFormKey(formKey + 1);
                setClear(false);
              }}
            >
              {t('Confirmar')}
            </button>
          </div>
        </Modal>
      )}
      {changeZone !== null && (
        <Modal title={t('Cambiar zona')} onClose={() => setChangeZone(null)}>
          <p>
            {t('Los datos de ubicación que dejen de aplicar se retirarán al guardar.')}
          </p>
          <div className="actions end">
            <button onClick={() => setChangeZone(null)}>{t('Cancelar')}</button>
            <button
              className="primary"
              onClick={() => {
                setZone(changeZone);
                setChangeZone(null);
              }}
            >
              {t('Cambiar zona')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
