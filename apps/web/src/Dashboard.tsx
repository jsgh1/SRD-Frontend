import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, Hand } from 'lucide-react';
import { api, roleNames, type Principal } from './api';
import { QuickLinks } from './QuickLinks';
import { PersonDetail, PersonTable, documents, genders } from './Persons';
import { Empty, ErrorBox, Loading } from './ui';
import { formatLocale, t } from './i18n';
export function Dashboard({
  principal,
  navigate,
}: {
  principal: Principal;
  navigate: (p: string) => void;
}) {
  const [data, setData] = useState<any>(),
    [error, setError] = useState<unknown>(),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(true),
    [detail, setDetail] = useState<string>();
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setBusy(true); setData(undefined); setError(undefined);
    api("dashboard", 'GET', undefined, { signal: controller.signal }).then(value => { if (active) setData(value); }).catch(e => { if (active) setError(e); }).finally(() => { window.clearTimeout(timeout); if (active) setBusy(false); });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [principal.organization.id, refresh]);
  const total = data?.total ?? 0;
  const max = Math.max(
    1,
    ...(data?.last_seven_days.map((d: any) => d.count) || []),
  );
  return (
    <>
      <section className="welcome">
        <div>
          <h1>
            {t('Hola, {role}', {role: t(roleNames[principal.role])})}{' '}
            <Hand className="wave" size={30} />
          </h1>
          <p>{t('Bienvenido al panel de {organization}.', {organization: principal.organization.name})}</p>
          <QuickLinks navigate={navigate} />
        </div>
        <div className="today-card">
          <CalendarDays size={24} />
          <span>{t('Fecha de hoy')}</span>
          <strong>
            {data ? new Date(data.date + 'T12:00:00-05:00').toLocaleDateString(formatLocale(), {
              timeZone: "America/Bogota",
              day: "2-digit",
              month: "long",
              year: "numeric",
            }) : busy ? t('Consultando fecha…') : t('Fecha no disponible')}
          </strong>
          <small>{t('Hora de Colombia')}</small>
        </div>
      </section>
      <div className="section-heading">
        <p className="muted">{data ? t('Datos consultados: {date} (Colombia)', {date: new Date(data.generated_at).toLocaleString(formatLocale(), { timeZone: 'America/Bogota' })}) : t('Los indicadores se calculan con la fecha del servidor.')}</p>
        <button disabled={busy} onClick={() => setRefresh(value => value + 1)}>{t('Actualizar indicadores')}</button>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stats-grid">
              {[
                [t('Personas registradas'), data.total, t('En esta junta')],
                [t('Registradas hoy'), data.today, t('Desde las 00:00')],
                [t('Esta semana'), data.week, t('Desde el lunes')],
                [t('Este mes'), data.month, t('Mes en curso')],
              ].map(([label, value, help]) => (
                <article className="stat" key={label}>
                  <span>{label}</span>
                  <strong>{value.toLocaleString(formatLocale())}</strong>
                  <small>{help}</small>
                </article>
              ))}
            </div>
            <div className="charts-grid">
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>{t('Actividad de registro')}</h2>
                    <p className="muted">{t('Últimos siete días')}</p>
                  </div>
                  <span className="chip">
                    {data.last_seven_days.reduce(
                      (s: number, d: any) => s + d.count,
                      0,
                    )}{" "}
                    {t('registros')}
                  </span>
                </div>
                <div
                  className="bar-chart"
                  role="img"
                  aria-label={data.last_seven_days
                    .map((d: any) => `${d.date}: ${d.count}`)
                    .join(", ")}
                >
                  {data.last_seven_days.map((d: any) => (
                    <div className="bar-column" key={d.date}>
                      <span>{d.count}</span>
                      <div className="bar-track">
                        <div style={{ height: `${(d.count / max) * 100}%` }} />
                      </div>
                      <small>
                        {new Date(
                          d.date + "T12:00:00-05:00",
                        ).toLocaleDateString(formatLocale(), { weekday: "short" })}
                      </small>
                    </div>
                  ))}
                </div>
              </section>
              <section className="panel">
                <h2>{t('Distribución de personas')}</h2>
                {total ? (
                  <>
                    <Distribution
                      rows={data.gender}
                      field="gender"
                      labels={genders}
                      total={total}
                      title={t('Por género')}
                    />
                    <Distribution
                      rows={data.document_types}
                      field="document_type"
                      labels={documents}
                      total={total}
                      title={t('Por documento')}
                    />
                  </>
                ) : (
                  <Empty title={t('Cada registro cuenta')}>
                    {t('Cuando agregues personas verás aquí su distribución.')}
                  </Empty>
                )}
              </section>
            </div>
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>{t('Últimos registros')}</h2>
                  <p className="muted">
                    {t('Las diez incorporaciones más recientes')}
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("list")}
                >
                  {t('Ver lista completa')} <ArrowUpRight size={16} />
                </button>
              </div>
              {data.latest.length ? (
                <PersonTable
                  rows={data.latest}
                  onView={(p) => setDetail(p.id)}
                />
              ) : (
                <Empty title={t('Tu registro comunitario empieza aquí')}>
                  {t('Aún no se han guardado personas en esta junta.')}
                </Empty>
              )}
            </section>
          </>
        )
      )}
      {detail && (
        <PersonDetail id={detail} principal={principal} onClose={() => setDetail(undefined)} />
      )}
    </>
  );
}
function Distribution({
  rows,
  field,
  labels,
  total,
  title,
}: {
  rows: any[];
  field: string;
  labels: Record<string, string>;
  total: number;
  title: string;
}) {
  const colors = [
    "#245bce",
    "#5ca7a0",
    "#f1b65c",
    "#9a85c6",
    "#77879f",
    "#ba7188",
  ];
  let start = 0;
  const gradient = rows
    .map((r, i) => {
      const end = start + (r.count / total) * 100;
      const x = `${colors[i % colors.length]} ${start}% ${end}%`;
      start = end;
      return x;
    })
    .join(",");
  return (
    <div className="distribution">
      <div
        className="donut"
        style={{ background: `conic-gradient(${gradient})` }}
        role="img"
        aria-label={title}
      >
        <span>{total}</span>
      </div>
      <div>
        <h3>{title}</h3>
        {rows.map((r, i) => (
          <div className="legend" key={r[field] || "none"}>
            <i style={{ background: colors[i % colors.length] }} />
            <span>{t(labels[r[field]] || 'Sin registrar')}</span>
            <strong>{r.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
