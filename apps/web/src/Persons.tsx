import { useEffect, useState, type FormEvent } from "react";
import { Plus, Search } from "lucide-react";
import { api, canAdmin, canWrite, type Principal } from "./api";
import { documents, type Person } from "./personTypes";
export { documents, genders, positions } from "./personTypes";
export type { Person } from "./personTypes";
import { Empty, ErrorBox, Loading, Modal } from "./ui";
import { PersonFilters, type ExtraFilter } from './PersonFilters';
import { buildPersonSearchParams, emptyPersonBaseFilters, type PersonBaseFilters } from './PersonSearchParams';
import { PersonForm } from './PersonForm';
export { PersonForm } from './PersonForm';
import type { FilterSettings } from './PersonFilterSettings';
import { ExportFilename, exportFilenameReady, type ExportFilenameChoice } from './ExportFilename';
import { Planilla } from './Planilla';
import { formatLocale, t, useLanguage } from './i18n';
import { BasePersonFilters } from './PersonBaseFilters';
import { PersonDetail } from './PersonDetail';
import { PersonTable, Status } from './PersonTable';
import { usePersonExports } from './usePersonExports';
export { PersonDetail, PersonTable, Status };

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
    [baseFilters, setBaseFilters] = useState<PersonBaseFilters>(emptyPersonBaseFilters),
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
  const [exportName, setExportName] = useState<ExportFilenameChoice>({ name: '', confirmed: false });
  const { exporting, exportError, exportingPdf, exportJob, exportExcel, exportPdf, downloadExportJob, refreshExportJob } = usePersonExports({
    principal, mode, openExportJobId, onExportOpened, applied, exportName, total: result?.total ?? 0, language,
  });
  const [filterSettings,setFilterSettings]=useState<FilterSettings>(), [filterError,setFilterError]=useState<unknown>(), [filterRevision,setFilterRevision]=useState(0);
  useEffect(()=>{
    if(mode !== 'list') return;
    let active=true;
    setFilterSettings(undefined); setFilterError(undefined); setApplied(''); setPage(1);
    setStatus(''); setZone(''); setAffiliated(''); setBaseFilters(emptyPersonBaseFilters); setCustomFilters([]);
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
  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPage(1);
    if (mode === "list") {
      const params = buildPersonSearchParams({ query, status, zone, affiliated, baseFilters, customFilters, filterSettings });
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
          {mode === 'list' && <button type="button" onClick={() => { setQuery(''); setStatus(''); setZone(''); setAffiliated(''); setBaseFilters(emptyPersonBaseFilters); setCustomFilters([]); setAdvancedOpen(false); setPage(1); setApplied(''); setRefresh(value => value + 1); }}>{t('Limpiar filtros')}</button>}
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
              {exportJob.status !== 'ready' && exportJob.status !== 'expired' && <button type="button" onClick={() => void refreshExportJob()}>{t('Actualizar estado')}</button>}
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
