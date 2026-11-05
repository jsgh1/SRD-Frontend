import { useEffect, useState } from 'react';
import { api, roleNames } from './api';
import { documents, genders } from './personTypes';
import { type PositionCatalog } from './PersonPositions';
import { emptyPersonBaseFilters, type PersonBaseFilters as PersonBaseFiltersValue } from './PersonSearchParams';
import { localizedLabel, t } from './i18n';
import { ErrorBox } from './ui';
export function BasePersonFilters({ value, onChange, visible }: { value: PersonBaseFiltersValue; onChange: (value: PersonBaseFiltersValue) => void; visible: string[] }) {
  const [catalog, setCatalog] = useState<PositionCatalog>(), [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!visible.includes('position_code')) return;
    let active = true;
    setError(undefined); setCatalog(undefined);
    api<PositionCatalog>('person-positions').then(data => { if (active) setCatalog(data); }).catch(e => { if (active) setError(e); });
    return () => { active = false; };
  }, [revision, visible]);
  const select = (key: keyof PersonBaseFiltersValue, label: string, options: Record<string, string>) => visible.includes(key) ? <label>{t(label)}
    <select value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })}>
      <option value="">{t('Todos')}</option>{Object.entries(options).map(([code, name]) => <option key={code} value={code}>{t(name)}</option>)}
    </select></label> : null;
  if (!Object.keys(emptyPersonBaseFilters).some(key=>visible.includes(key)) && !visible.includes('birth_date') && !visible.includes('registered_at')) return null;
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
