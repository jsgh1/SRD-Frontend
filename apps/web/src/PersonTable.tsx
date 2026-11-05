import { Eye, Pencil, Trash2 } from 'lucide-react';
import { formatLocale, t, useLanguage } from './i18n';
import type { Person } from './personTypes';
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
