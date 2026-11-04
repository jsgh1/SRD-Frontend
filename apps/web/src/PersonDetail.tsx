import { useEffect, useState } from 'react';
import { api, canWrite, roleNames, type Principal } from './api';
import { documents, genders, positions, type Person } from './personTypes';
import { AdditionalDetail } from './PersonFields';
import { PersonPhotos } from './PersonPhotos';
import { ExportFilename, addExportFilename, exportFilenameReady, safeXlsxFilename, type ExportFilenameChoice } from './ExportFilename';
import { loadPersonPdfPhotos } from './PersonPdfPhotos';
import type { PersonIndividualPdfData } from './PersonIndividualPdf';
import { formatLocale, localizedLabel, t, useLanguage } from './i18n';
import { ErrorBox, Loading, Modal } from './ui';
import { Status } from './PersonTable';

type Workbook = { filename: string; mime: string; content: string; count: number };
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
