import { useEffect, useState, type FormEvent } from "react";
import {
  Eye,
  Pencil,
  Trash2,
  Search,
  Plus,
} from "lucide-react";
import { api, canAdmin, canWrite, roleNames, type Principal } from "./api";
import { documents, genders, positions, type Person } from "./personTypes";
export { documents, genders, positions } from "./personTypes";
export type { Person } from "./personTypes";
import { Empty, ErrorBox, Loading, Modal } from "./ui";
import { AdditionalInputs, AdditionalDetail, type FieldSchema } from './PersonFields';
import { PersonFilters, type ExtraFilter } from './PersonFilters';
import { type PositionCatalog } from './PersonPositions';
import { PersonPhotos } from './PersonPhotos';
import { PersonForm } from './PersonForm';
export { PersonForm } from './PersonForm';
import type { FilterSettings } from './PersonFilterSettings';
import { ExportFilename, addExportFilename, exportFilenameReady, safeXlsxFilename, type ExportFilenameChoice } from './ExportFilename';
import { Planilla } from './Planilla';
import type { PersonExportPdfData } from './PersonExportPdf';
import type { PersonIndividualPdfData } from './PersonIndividualPdf';
import { loadPersonPdfPhotos } from './PersonPdfPhotos';
import { formatLocale, localizedLabel, t, useLanguage } from './i18n';

type Workbook = { filename: string; mime: string; content: string; count: number };
type PersonExportJob = { id: string; status: 'queued' | 'processing' | 'ready' | 'failed' | 'expired'; format: 'xlsx' | 'pdf'; count: number; cutoff_at: string; filename: string; ticket?: string };
export function Status({ value }: { value: string }) {
  return (
    <span className={"status " + value}>
      {t(value === 'complete' ? 'Completado' : 'Pendiente')}
    </span>
  );
}
export function PersonTable({
  rows,
  onView,
  onEdit,
  onDelete,
}: {
  rows: Person[];
  onView: (p: Person) => void;
  onEdit?: (p: Person) => void;
  onDelete?: (p: Person) => void;
}) {
  useLanguage();
  return (
    <><div className="table-scroll person-desktop-table">
      <table>
        <thead>
          <tr>
            <th>{t('Nombre')}</th>
            <th>{t('Documento')}</th>
            <th>{t('Fecha de registro')}</th>
            <th>{t('Estado')}</th>
            <th>{t('Acciones')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>
                  {p.first_names} {p.last_names}
                </strong>
              </td>
              <td>
                <span className="muted">{p.document_type}</span>{" "}
                {p.document_number}
              </td>
              <td>
                {new Date(
                  p.created_at.replace(" ", "T") + "Z",
                ).toLocaleDateString(formatLocale(), { timeZone: "America/Bogota" })}
              </td>
              <td>
                <Status value={p.status} />
              </td>
              <td>
                <div className="actions">
                  <button
                    className="icon-button"
                    title={t('Ver detalle')}
                    aria-label={t('Ver {name}', {name: p.first_names})}
                    onClick={() => onView(p)}
                  >
                    <Eye size={18} />
                  </button>
                  {onEdit && (
                    <button
                      className="icon-button"
                      aria-label={t('Editar {name}', {name: p.first_names})}
                      onClick={() => onEdit(p)}
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="icon-button danger"
                      aria-label={t('Eliminar {name}', {name: p.first_names})}
                      onClick={() => onDelete(p)}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ul className="person-mobile-list" aria-label={t('Lista de personas')}>
      {rows.map(p => <li className="person-mobile-card" key={p.id}>
        <div className="person-mobile-heading"><strong>{p.first_names} {p.last_names}</strong><Status value={p.status} /></div>
        <dl>
          <div><dt>{t('Documento')}</dt><dd>{p.document_type} {p.document_number}</dd></div>
          <div><dt>{t('Fecha de registro')}</dt><dd>{new Date(p.created_at.replace(' ', 'T') + 'Z').toLocaleDateString(formatLocale(), { timeZone: 'America/Bogota' })}</dd></div>
        </dl>
        <div className="person-mobile-actions">
          <button type="button" aria-label={t('Ver {name}', { name: p.first_names })} onClick={() => onView(p)}><Eye size={16} aria-hidden="true" />{t('Ver detalle')}</button>
          {onEdit && <button type="button" aria-label={t('Editar {name}', { name: p.first_names })} onClick={() => onEdit(p)}><Pencil size={16} aria-hidden="true" />{t('Editar')}</button>}
          {onDelete && <button type="button" className="danger" aria-label={t('Eliminar {name}', { name: p.first_names })} onClick={() => onDelete(p)}><Trash2 size={16} aria-hidden="true" />{t('Eliminar')}</button>}
        </div>
      </li>)}
    </ul></>
  );
}
export function PersonDetail({
  id,
  onClose,
  principal,
}: {
  id: string;
  onClose: () => void;
  principal: Principal;
}) {
  const language = useLanguage();
  const [person, setPerson] = useState<Person>(),
    [error, setError] = useState<unknown>();
  const [detailRevision, setDetailRevision] = useState(0);
  const [portrait, setPortrait] = useState<string>();
  const [individualName, setIndividualName] = useState<ExportFilenameChoice>({ name: '', confirmed: false });
  const [individualBusy, setIndividualBusy] = useState(false), [individualError, setIndividualError] = useState<unknown>();
  const [includePdfPhotos, setIncludePdfPhotos] = useState(false);
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<unknown>();
  const [inviteNotice, setInviteNotice] = useState('');
  const [invitationStatus, setInvitationStatus] = useState<'loading' | 'available' | 'pending' | 'active' | 'error'>('loading');
  const [invitationRevision, setInvitationRevision] = useState(0);
  useEffect(() => {
    if (!canWrite(principal.role)) return;
    let active = true;
    setInvitationStatus('loading');
    api<{status: 'available' | 'pending' | 'active'}>(`invitations/person/${id}/status`)
      .then(result => { if (active) setInvitationStatus(result.status); })
      .catch(() => { if (active) setInvitationStatus('error'); });
    return () => { active = false; };
  }, [id, principal.role, invitationRevision]);
  useEffect(() => {
    setPerson(undefined); setError(undefined); setIndividualError(undefined);
    setIndividualName({ name: '', confirmed: false });
    setIncludePdfPhotos(false);
    let active = true;
    api("persons/" + id)
      .then(data => { if (active) setPerson(data); })
      .catch(value => { if (active) setError(value); });
    return () => { active = false; };
  }, [id, detailRevision]);
  async function invitePerson() {
    if (!person?.email || inviteBusy) return;
    setInviteBusy(true); setInviteError(undefined); setInviteNotice('');
    try {
      await api('invitations', 'POST', { person_id: id, email: person.email, role: inviteRole });
      setInvitationStatus('pending');
      setInviteNotice('Invitación creada. La persona recibirá un correo para activar su cuenta.');
    } catch (cause) { setInviteError(cause); }
    finally { setInviteBusy(false); }
  }
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const photos = await api<{items: {slot: string; present: boolean}[]}>(`persons/${id}/photos`);
        if (!photos.items.some(photo => photo.slot === 'person' && photo.present)) { if (active) setPortrait(undefined); return; }
        const image = await api<{content: string; mime: string}>(`persons/${id}/photos/person`);
        if (active) setPortrait(image.mime === 'image/png' ? `data:image/png;base64,${image.content}` : undefined);
      } catch { if (active) setPortrait(undefined); }
    };
    const updated = (event: Event) => { if ((event as CustomEvent<string>).detail === id) void load(); };
    setPortrait(undefined);
    void load();
    window.addEventListener('srd-person-photo-updated', updated);
    return () => { active = false; window.removeEventListener('srd-person-photo-updated', updated); };
  }, [id]);
  async function downloadIndividual(format: 'xlsx' | 'pdf' = 'xlsx') {
    if (!person || individualBusy || !exportFilenameReady(individualName)) return;
    setIndividualBusy(true); setIndividualError(undefined);
    try {
      const params = new URLSearchParams();
      addExportFilename(params, individualName);
      params.set('language', language);
      if (format === 'pdf') {
        const photos = includePdfPhotos ? await loadPersonPdfPhotos(id, api) : undefined;
        const data = await api<PersonIndividualPdfData>(`persons/${id}/pdf?${params}`);
        const { downloadPersonIndividualPdf } = await import('./PersonIndividualPdf');
        await downloadPersonIndividualPdf(data, photos);
        return;
      }
      const file = await api<Workbook>(`persons/${id}/xlsx?${params}`);
      if (!safeXlsxFilename(file.filename) || file.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') throw new Error(t('La exportación no tiene un formato válido.'));
      const bytes = Uint8Array.from(atob(file.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
      const link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (value) { setIndividualError(value); }
    finally { setIndividualBusy(false); }
  }
  const labels: Record<string, string> = {
    document_type: "Tipo de documento",
    document_number: "Número de documento",
    zone: "Zona",
    affiliated: "Afiliación",
    gender: "Género",
    birth_date: "Fecha de nacimiento",
    phone: "Teléfono",
    email: "Correo electrónico",
    position_code: "Cargo",
    descriptive_role: "Función en la comunidad",
    property_name: "Predio",
    address: "Dirección",
    neighborhood: "Barrio",
  };
  function value(key: string, v: any) {
    if (v === null || v === undefined || v === "") return t('Sin registrar');
    if (key === "affiliated") return t(v ? 'Sí' : 'No');
    if (key === "document_type") return t(documents[v] || v);
    if (key === "gender") return t(genders[v] || v);
    if (key === "position_code") return person?.position_label
      ? localizedLabel({label: person.position_label, label_en: person.position_label_en})
      : t(positions[v] || v);
    if (key === "descriptive_role") return t(roleNames[v] || v);
    if (key === "zone") return t(v === "rural" ? "Rural" : "Urbana");
    return String(v);
  }
  return (
    <Modal title={t('Detalle de persona')} onClose={onClose}>
      <ErrorBox error={error} />
      {!!error && <button type="button" onClick={() => setDetailRevision(value => value + 1)}>{t('Reintentar detalle')}</button>}
      {!person && !error ? (
        <Loading />
      ) : (
        person && (
          <>
            <div className="person-title">
              <span className="avatar person-detail-avatar">{portrait ? <img src={portrait} alt={t('Foto de la persona')} /> : person.first_names.slice(0, 1)}</span>
              <div>
                <h3>
                  {person.first_names} {person.last_names}
                </h3>
                <Status value={person.status} />
              </div>
            </div>
            <dl className="details">
              {Object.entries(labels).map(([key, label]) => (
                <div key={key}>
                  <dt>{t(label)}</dt>
                  <dd>{value(key, person[key])}</dd>
                </div>
              ))}
            </dl>
            {"note" in person && (
              <section className="internal-note">
                <h3>{t('Nota interna')}</h3>
                <p>{person.note || t('Sin nota interna.')}</p>
              </section>
            )}
            <AdditionalDetail values={person.custom_fields} />
            {canWrite(principal.role) && invitationStatus !== 'active' && <section className="person-invite">
              <h3>{t('Acceso al sistema')}</h3>
              {invitationStatus === 'loading' ? <Loading /> : invitationStatus === 'error' ? <button type="button" onClick={() => setInvitationRevision(value => value + 1)}>{t('Reintentar detalle')}</button> : invitationStatus === 'pending' ? <p className="muted">{language === 'en' ? 'An invitation is pending for this person.' : 'Esta persona ya tiene una invitación pendiente.'}</p> : <>
              <p className="muted">{t('Invita a esta persona con el correo guardado en su ficha. La invitación le permitirá crear su contraseña.')}</p>
              {person.email ? <div className="actions">
                <label>{t('Rol de acceso')}
                  <select value={inviteRole} onChange={event => setInviteRole(event.target.value)}>
                    {(principal.role === 'registrar' ? ['viewer'] : ['viewer', 'registrar', 'treasurer', 'auditor', 'admin']).map(role =>
                      <option key={role} value={role}>{t(roleNames[role])}</option>)}
                  </select>
                </label>
                <button type="button" disabled={inviteBusy} onClick={() => void invitePerson()}>{t('Enviar invitación')}</button>
              </div> : <p className="muted">{t('Agrega un correo a la ficha antes de invitar.')}</p>}
              <ErrorBox error={inviteError} />
              {inviteNotice && <p className="notice" role="status">{t(inviteNotice)}</p>}
              </>}
            </section>}
            <section aria-label={t('Exportar ficha individual')}>
              <h3>{t('Descargar ficha')}</h3>
              <p className="muted">{t('Incluye los datos base y campos adicionales guardados. No incluye notas internas ni autorizaciones. Excel contiene solo texto.')}</p>
              <label className="check-label"><input type="checkbox" checked={includePdfPhotos} disabled={individualBusy} onChange={event => setIncludePdfPhotos(event.target.checked)} />{t('Incluir fotografías en el PDF')}</label>
              <ExportFilename value={individualName} onChange={setIndividualName} type="ficha_persona" />
              <ErrorBox error={individualError} />
              <button type="button" disabled={individualBusy || !exportFilenameReady(individualName)} onClick={() => void downloadIndividual()}>{t(individualBusy ? 'Preparando ficha…' : 'Descargar ficha Excel')}</button>
              <button type="button" disabled={individualBusy || !exportFilenameReady(individualName)} onClick={() => void downloadIndividual('pdf')}>{t(individualBusy ? 'Preparando ficha…' : 'Descargar ficha PDF')}</button>
            </section>
            <PersonPhotos key={id} id={id} />
            <p className="muted">
            {t('El acceso al sistema se concede mediante una invitación.')}
            </p>
          </>
        )
      )}
    </Modal>
  );
}
type BaseFilters = { document_type: string; gender: string; descriptive_role: string; position_code: string; birth_date_from: string; birth_date_to: string; registered_from: string; registered_to: string };
const emptyBaseFilters: BaseFilters = { document_type: '', gender: '', descriptive_role: '', position_code: '', birth_date_from: '', birth_date_to: '', registered_from: '', registered_to: '' };

function BasePersonFilters({ value, onChange, visible }: { value: BaseFilters; onChange: (value: BaseFilters) => void; visible: string[] }) {
  const [catalog, setCatalog] = useState<PositionCatalog>(), [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!visible.includes('position_code')) return;
    let active = true;
    setError(undefined); setCatalog(undefined);
    api<PositionCatalog>('person-positions').then(data => { if (active) setCatalog(data); }).catch(e => { if (active) setError(e); });
    return () => { active = false; };
  }, [revision, visible]);
  const select = (key: keyof BaseFilters, label: string, options: Record<string, string>) => visible.includes(key) ? <label>{t(label)}
    <select value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })}>
      <option value="">{t('Todos')}</option>{Object.entries(options).map(([code, name]) => <option key={code} value={code}>{t(name)}</option>)}
    </select></label> : null;
  if (!Object.keys(emptyBaseFilters).some(key=>visible.includes(key)) && !visible.includes('birth_date') && !visible.includes('registered_at')) return null;
  return <fieldset className="person-extra-filters"><legend>{t('Más filtros de la ficha')}</legend>
    <div className="person-extra-filter">
      {select('document_type', 'Tipo de documento', documents)}
      {select('gender', 'Género', genders)}
      {select('descriptive_role', 'Rol en la comunidad', Object.fromEntries(Object.entries(roleNames).filter(([code]) => code !== 'superadmin')))}
      {visible.includes('position_code') && <label>{t('Cargo')}<select value={value.position_code} disabled={!catalog} onChange={e => onChange({ ...value, position_code: e.target.value })}>
        <option value="">{catalog ? t('Todos') : t('Cargando cargos…')}</option>
        {catalog?.items.map(item => <option key={item.code} value={item.code}>{localizedLabel(item)}{item.active ? '' : ` ${t('(inactivo)')}`}</option>)}
      </select></label>}
      {visible.includes('birth_date') && <><label>{t('Nacimiento desde')}<input type="date" required={!!value.birth_date_to} max={value.birth_date_to || undefined} value={value.birth_date_from} onChange={e=>onChange({...value,birth_date_from:e.target.value})}/></label><label>{t('Nacimiento hasta')}<input type="date" required={!!value.birth_date_from} min={value.birth_date_from || undefined} value={value.birth_date_to} onChange={e=>onChange({...value,birth_date_to:e.target.value})}/></label></>}
      {visible.includes('registered_at') && <><label>{t('Registro desde')}<input type="date" required={!!value.registered_to} max={value.registered_to || undefined} value={value.registered_from} onChange={e=>onChange({...value,registered_from:e.target.value})}/></label><label>{t('Registro hasta')}<input type="date" required={!!value.registered_from} min={value.registered_from || undefined} value={value.registered_to} onChange={e=>onChange({...value,registered_to:e.target.value})}/></label></>}
    </div>
    <p className="muted">{t('Todos los criterios deben coincidir. Cargo y rol describen la ficha, no los permisos de una cuenta. También puedes buscar cargos inactivos.')}</p>
    <ErrorBox error={error} />{!!error && <button type="button" onClick={() => setRevision(r => r + 1)}>{t('Reintentar cargos')}</button>}
  </fieldset>;
}

export function Persons({
  principal,
  mode,
  onCreate,
  openExportJobId,
  onExportOpened,
}: {
  principal: Principal;
  mode: "list" | "lookup";
  onCreate: () => void;
  openExportJobId?: string;
  onExportOpened?: () => void;
}) {
  const language = useLanguage();
  const [result, setResult] = useState<any>(),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [zone, setZone] = useState(""),
    [affiliated, setAffiliated] = useState(""),
    [baseFilters, setBaseFilters] = useState<BaseFilters>(emptyBaseFilters),
    [customFilters, setCustomFilters] = useState<ExtraFilter[]>([]),
    [advancedOpen, setAdvancedOpen] = useState(false),
    [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [applied, setApplied] = useState(""),
    [error, setError] = useState<unknown>(),
    [detail, setDetail] = useState<string>(),
    [edit, setEdit] = useState<Person>(),
    [remove, setRemove] = useState<Person>(),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState<unknown>();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportJob, setExportJob] = useState<PersonExportJob>();
  const jobStorageKey = `srd-person-export:${principal.organization.id}:${principal.user_id}`;
  const [exportName, setExportName] = useState<ExportFilenameChoice>({ name: '', confirmed: false });
  const [filterSettings,setFilterSettings]=useState<FilterSettings>(), [filterError,setFilterError]=useState<unknown>(), [filterRevision,setFilterRevision]=useState(0);
  useEffect(() => {
    if (mode !== 'list') return;
    const id = openExportJobId || localStorage.getItem(jobStorageKey);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    if (openExportJobId) localStorage.setItem(jobStorageKey, openExportJobId);
    let active = true;
    void api<PersonExportJob>(`persons/export-jobs/${id}`)
      .then(value => { if (active) { setExportJob(value); if (openExportJobId) onExportOpened?.(); } })
      .catch(() => { if (active) { localStorage.removeItem(jobStorageKey); if (openExportJobId) onExportOpened?.(); } });
    return () => { active = false; };
  }, [jobStorageKey, mode, openExportJobId]);
  useEffect(() => {
    if (!exportJob || !['queued', 'processing'].includes(exportJob.status)) return;
    let active = true;
    const timer = setTimeout(() => {
      void api<PersonExportJob>(`persons/export-jobs/${exportJob.id}`)
        .then(value => { if (active) setExportJob(value); })
        .catch(value => { if (active) setExportError(value); });
    }, 5000);
    return () => { active = false; clearTimeout(timer); };
  }, [exportJob]);
  useEffect(()=>{
    if(mode !== 'list') return;
    let active=true;
    setFilterSettings(undefined); setFilterError(undefined); setApplied(''); setPage(1);
    setStatus(''); setZone(''); setAffiliated(''); setBaseFilters(emptyBaseFilters); setCustomFilters([]);
    api<FilterSettings>('person-filter-settings').then(value=>{if(active)setFilterSettings(value);}).catch(e=>{if(active)setFilterError(e);});
    return ()=>{active=false;};
  },[mode,filterRevision]);
  useEffect(() => {
    if (mode !== "list") {
      setResult(undefined);
      return;
    }
    setResult(undefined);
    setError(undefined);
    let active = true;
    api(`persons?page=${page}&page_size=${size}&${applied}`)
      .then(value => { if (active) setResult(value); })
      .catch(error => { if (active) setError(error); });
    return () => { active = false; };
  }, [mode, page, size, applied, refresh]);
  async function exportExcel() {
    if (exporting) return;
    setExporting(true); setExportError(undefined);
    try {
      const params = new URLSearchParams(applied);
      addExportFilename(params, exportName);
      params.set('language', language);
      if (result.total > 500) {
        const queued = await api<PersonExportJob>(`persons/export-jobs?${params}`, 'POST');
        setExportJob(queued);
        localStorage.setItem(jobStorageKey, queued.id);
        return;
      }
      const file = await api<Workbook>(`persons/export?${params}`);
      if (!safeXlsxFilename(file.filename)
        || file.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        throw new Error(t('La exportación no tiene un formato válido.'));
      }
      const bytes = Uint8Array.from(atob(file.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
      const link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (value) { setExportError(value); }
    finally { setExporting(false); }
  }
  async function downloadExportJob() {
    if (!exportJob || exportJob.status !== 'ready') return;
    setExportError(undefined);
    try {
      // Cada consulta emite un enlace nuevo de 15 minutos; el permiso se comprueba también al descargar.
      const current = await api<PersonExportJob>(`persons/export-jobs/${exportJob.id}`);
      setExportJob(current);
      if (!current.ticket) throw new Error(t('El archivo ya no está disponible.'));
      if (current.format === 'pdf') {
        const data = await api<PersonExportPdfData | Workbook>(`persons/export-jobs/${current.id}/download?ticket=${current.ticket}`);
        if ('content' in data) {
          if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.pdf$/.test(data.filename)
            || data.mime !== 'application/pdf' || data.count !== current.count) {
            throw new Error(t('La exportación no tiene un formato válido.'));
          }
          const bytes = Uint8Array.from(atob(data.content), char => char.charCodeAt(0));
          if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') {
            throw new Error(t('La exportación no tiene un formato válido.'));
          }
          const url = URL.createObjectURL(new Blob([bytes], { type: data.mime }));
          const link = document.createElement('a');
          link.href = url; link.download = data.filename;
          document.body.append(link); link.click(); link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          const { downloadPersonExportPdf } = await import('./PersonExportPdf');
          await downloadPersonExportPdf(data, principal.organization.name);
        }
        return;
      }
      const file = await api<Workbook>(`persons/export-jobs/${current.id}/download?ticket=${current.ticket}`);
      if (!safeXlsxFilename(file.filename)
        || file.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        throw new Error(t('La exportación no tiene un formato válido.'));
      }
      const bytes = Uint8Array.from(atob(file.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
      const link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (value) { setExportError(value); }
  }
  async function exportPdf() {
    if (exportingPdf) return;
    setExportingPdf(true); setExportError(undefined);
    try {
      const params = new URLSearchParams(applied);
      addExportFilename(params, exportName);
      params.set('language', language);
      if (result.total > 500) {
        params.set('format', 'pdf');
        const queued = await api<PersonExportJob>(`persons/export-jobs?${params}`, 'POST');
        setExportJob(queued);
        localStorage.setItem(jobStorageKey, queued.id);
        return;
      }
      const data = await api<PersonExportPdfData>(`persons/export-pdf?${params}`);
      const { downloadPersonExportPdf } = await import('./PersonExportPdf');
      await downloadPersonExportPdf(data, principal.organization.name);
    } catch (value) { setExportError(value); }
    finally { setExportingPdf(false); }
  }
  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPage(1);
    if (mode === "list") {
      const criteria={status,zone,affiliated,...baseFilters};
      const params = new URLSearchParams({ q: query });
      Object.entries(criteria).forEach(([key,value])=>{if(filterSettings?.base.includes(key))params.set(key,value);});
      if(filterSettings?.base.includes('birth_date') && baseFilters.birth_date_from && baseFilters.birth_date_to) {
        params.set('birth_date_from',baseFilters.birth_date_from);
        params.set('birth_date_to',baseFilters.birth_date_to);
      }
      if(filterSettings?.base.includes('registered_at') && baseFilters.registered_from && baseFilters.registered_to) {
        params.set('registered_from',baseFilters.registered_from);
        params.set('registered_to',baseFilters.registered_to);
      }
      customFilters.forEach((filter, index) => {
        params.set(`custom_filters[${index}][field_id]`, filter.field_id);
        params.set(`custom_filters[${index}][value]`, filter.value);
        if (filter.operator === 'between') {
          params.set(`custom_filters[${index}][operator]`, 'between');
          params.set(`custom_filters[${index}][value_to]`, filter.value_to ?? '');
        }
      });
      setApplied(params.toString());
      setRefresh(value => value + 1);
    } else {
      setBusy(true);
      setResult(undefined);
      try {
        const data = await api(
          "persons/lookup?" +
            new URLSearchParams(
              Object.fromEntries(
                new FormData(e.target as HTMLFormElement),
              ) as Record<string, string>,
            ),
        );
        setResult({ items: data.id ? [data] : [], total: data.id ? 1 : 0 });
      } catch (e) {
        setError(e);
      } finally {
        setBusy(false);
      }
    }
  }
  async function editPerson(p: Person) {
    try {
      setEdit(await api("persons/" + p.id));
    } catch (e) {
      setError(e);
    }
  }
  async function deletePerson() {
    if (!remove) return;
    setBusy(true);
    try {
      await api("persons/" + remove.id, "DELETE", {
        confirmed: true,
        version: remove.version,
      });
      setRemove(undefined);
      setRefresh(refresh + 1);
    } catch (e) {
      setError(e);
      setRemove(undefined);
    } finally {
      setBusy(false);
    }
  }
  if (edit)
    return (
      <PersonForm
        principal={principal}
        initial={edit}
        onSaved={() => {
          setEdit(undefined);
          setRefresh(refresh + 1);
        }}
        onBack={() => setEdit(undefined)}
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t(mode === "list" ? "Lista de personas" : "Consultar persona")}</h1>
          <p className="muted">
            {t(mode === "list"
              ? "Encuentra y mantén al día los registros de tu junta."
              : "Busca una ficha por su tipo y número de documento.")}
          </p>
        </div>
        {canWrite(principal.role) && (
          <button className="primary" onClick={onCreate}>
            <Plus size={18} />
            {t('Nuevo registro')}
          </button>
        )}
      </div>
      <ErrorBox error={error} />
      {mode === 'list' && error && <div className="actions"><button type="button" onClick={() => setRefresh(value => value + 1)}>{t('Reintentar personas')}</button></div>}
      <section className="panel">
        <form className="filters" onSubmit={search} aria-label={t('Filtros de personas')}>
          {mode === "list" ? (
            <>
              <label className="grow">
                {t('Buscar')}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('Nombre, apellido o documento')}
                />
              </label>
              {filterSettings?.base.includes('status') && <label>
                {t('Estado')}
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">{t('Todos')}</option>
                  <option value="pending">{t('Pendiente')}</option>
                  <option value="complete">{t('Completado')}</option>
                </select>
              </label>}
              {filterSettings?.base.includes('zone') && <label>
                {t('Zona')}
                <select value={zone} onChange={(e) => setZone(e.target.value)}>
                  <option value="">{t('Todas')}</option>
                  <option value="rural">{t('Rural')}</option>
                  <option value="urban">{t('Urbana')}</option>
                </select>
              </label>}
              {filterSettings?.base.includes('affiliated') && <label>{t('Afiliación')}<select value={affiliated} onChange={e => setAffiliated(e.target.value)}><option value="">{t('Todas')}</option><option value="1">{t('Afiliados')}</option><option value="0">{t('No afiliados')}</option></select></label>}
              {filterSettings ? <details className="person-advanced" open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
                <summary>{t('Más filtros de la ficha')}{(Object.values(baseFilters).some(Boolean) || customFilters.length > 0) && <span className="person-advanced-active">{t('Filtros seleccionados')}</span>}</summary>
                <BasePersonFilters value={baseFilters} onChange={setBaseFilters} visible={filterSettings.base} />
                <PersonFilters value={customFilters} onChange={setCustomFilters} allowed={filterSettings.custom} />
              </details> : filterError ? <div className="person-extra-filters"><ErrorBox error={filterError}/><button type="button" onClick={()=>setFilterRevision(v=>v+1)}>{t('Reintentar configuración de filtros')}</button></div> : <Loading/>}
            </>
          ) : (
            <>
              <label>
                {t('Tipo de documento')}
                <select name="document_type">
                  {Object.entries(documents).map(([v, l]) => (
                    <option value={v} key={v}>
                      {t(l)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grow">
                {t('Número de documento')}
                <input name="document_number" required maxLength={30} placeholder={t('Ej.: 1234567890')} />
              </label>
            </>
          )}
          <button className="primary" disabled={busy}>
            <Search size={18} />
            {t(mode === "list" ? "Aplicar filtros" : "Consultar")}
          </button>
          {mode === 'list' && <button type="button" onClick={() => { setQuery(''); setStatus(''); setZone(''); setAffiliated(''); setBaseFilters(emptyBaseFilters); setCustomFilters([]); setAdvancedOpen(false); setPage(1); setApplied(''); setRefresh(value => value + 1); }}>{t('Limpiar filtros')}</button>}
        </form>
        {mode === 'lookup' && busy ? <Loading /> : result ? (
          <>
            {result.items.length ? (
              <PersonTable
                rows={result.items}
                onView={(p) => setDetail(p.id)}
                onEdit={canWrite(principal.role) ? editPerson : undefined}
                onDelete={canAdmin(principal.role) ? setRemove : undefined}
              />
            ) : (
              <Empty title={t('No encontramos registros')}>
                {t('Prueba con otros criterios o crea el primer registro de tu junta.')}
              </Empty>
            )}
            <div className="pagination person-results-pagination">
              <span>{t('{count} registros encontrados', {count: result.total})}</span>
              {mode === "list" && (
                <>
                  <label>
                    {t('Filas')}
                    <select
                      aria-label={t('Filas por página')}
                      value={size}
                      onChange={(e) => {
                        setSize(+e.target.value);
                        setPage(1);
                      }}
                    >
                      {[10, 25, 50].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    {t('Anterior')}
                  </button>
                  <span>{t('Página {page}', {page})}</span>
                  <button
                    disabled={page * size >= result.total}
                    onClick={() => setPage(page + 1)}
                  >
                    {t('Siguiente')}
                  </button>
                </>
              )}
            </div>
          </>
        ) : mode === "list" ? (
          error ? null : <Loading />
        ) : error ? null : (
          <Empty title={t('Consulta exacta')}>
            {t('Completa los dos campos para buscar.')}
          </Empty>
        )}
        {mode === 'list' && <div className="person-exports">
          <section aria-label={t('Exportación de personas')}>
            <h2>{t('Exportación de personas')}</h2>
            <ExportFilename value={exportName} onChange={setExportName} type="personas" />
            <ErrorBox error={exportError} />
            {exportJob && <div className="notice" role="status">
              <strong>{t(exportJob.status === 'queued' ? 'En cola' : exportJob.status === 'processing' ? 'Procesando' : exportJob.status === 'ready' ? 'Lista para descargar' : exportJob.status === 'expired' ? 'Vencida' : 'Fallida')}</strong>
              <span> · {exportJob.count} {t('personas')} · {t('Corte')}: {new Date(exportJob.cutoff_at).toLocaleString(formatLocale(), { timeZone: 'America/Bogota' })}</span>
              {exportJob.status === 'ready' && <button type="button" onClick={() => void downloadExportJob()}>{t(exportJob.format === 'pdf' ? 'Descargar PDF preparado' : 'Descargar Excel preparado')}</button>}
              {exportJob.status === 'expired' && <p>{t('El archivo venció después de 24 horas. Exporta de nuevo para crear otro.')}</p>}
              {exportJob.status !== 'ready' && exportJob.status !== 'expired' && <button type="button" onClick={() => void api<PersonExportJob>(`persons/export-jobs/${exportJob.id}`).then(setExportJob).catch(setExportError)}>{t('Actualizar estado')}</button>}
            </div>}
            <div className="pagination"><button type="button" disabled={busy || exporting || exportingPdf || !result || result.total > 2000 || !exportFilenameReady(exportName)} onClick={() => void exportExcel()}>{t(exporting ? 'Preparando Excel…' : 'Exportar Excel')}</button><button type="button" disabled={busy || exporting || exportingPdf || !result || result.total > 2000 || !exportFilenameReady(exportName)} onClick={() => void exportPdf()}>{t(exportingPdf ? 'Preparando PDF…' : 'Exportar PDF')}</button><span className="export-help">{t('Descarga hasta 2000 personas según los filtros, sin notas ni fotografías.')}</span></div>
          </section>
          <Planilla applied={applied} total={result?.total} busy={busy} organizationName={principal.organization.name} />
        </div>}
      </section>
      {detail && (
        <PersonDetail id={detail} principal={principal} onClose={() => setDetail(undefined)} />
      )}
      {remove && (
        <Modal title={t('Eliminar registro')} onClose={() => setRemove(undefined)}>
          <p>
            {t('Se eliminará el registro de')} {" "}
            <strong>
              {remove.first_names} {remove.last_names}
            </strong>
            {t('. Esta acción no puede deshacerse desde el sistema.')}
          </p>
          <div className="actions end">
            <button onClick={() => setRemove(undefined)}>{t('Cancelar')}</button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={deletePerson}
            >
              {t('Sí, eliminar')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
