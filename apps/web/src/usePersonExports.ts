import { useEffect, useState } from 'react';
import { api, type Principal } from './api';
import { addExportFilename, exportFilenameReady, safeXlsxFilename, type ExportFilenameChoice } from './ExportFilename';
import type { PersonExportPdfData } from './PersonExportPdf';
import { t } from './i18n';

type Workbook = { filename: string; mime: string; content: string; count: number };
export type PersonExportJob = {
  id: string;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'expired';
  format: 'xlsx' | 'pdf';
  count: number;
  cutoff_at: string;
  filename: string;
  ticket?: string;
};

export function usePersonExports({
  principal,
  mode,
  openExportJobId,
  onExportOpened,
  applied,
  exportName,
  total,
  language,
}: {
  principal: Principal;
  mode: 'list' | 'lookup';
  openExportJobId?: string;
  onExportOpened?: () => void;
  applied: string;
  exportName: ExportFilenameChoice;
  total: number;
  language: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportJob, setExportJob] = useState<PersonExportJob>();
  const jobStorageKey = `srd-person-export:${principal.organization.id}:${principal.user_id}`;

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

  async function exportExcel() {
    if (exporting) return;
    setExporting(true); setExportError(undefined);
    try {
      const params = new URLSearchParams(applied);
      addExportFilename(params, exportName);
      params.set('language', language);
      if (total > 500) {
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
      // Each request issues a fresh 15-minute link and checks permissions again at download time.
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
      if (total > 500) {
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

  async function refreshExportJob() {
    if (!exportJob) return;
    try { setExportJob(await api<PersonExportJob>(`persons/export-jobs/${exportJob.id}`)); }
    catch (value) { setExportError(value); }
  }

  return { exporting, exportError, exportingPdf, exportJob, exportExcel, exportPdf, downloadExportJob, refreshExportJob };
}
