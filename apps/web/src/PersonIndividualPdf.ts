export type PersonIndividualPdfData = {
  filename: string; date: string; count: number; headers: string[]; rows: string[][]; language?: 'es' | 'en'; logo_data?: string | null;
};

export function personIndividualPdfDefinition(data: PersonIndividualPdfData, photos?: PersonPdfPhoto[]) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.pdf$/.test(data.filename)
    || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.count !== 1
    || data.headers.length !== 2 || data.rows.length < 17
    || data.headers.some(value => typeof value !== 'string')
    || data.rows.some(row => row.length !== 2 || row.some(value => typeof value !== 'string'))
    || (data.logo_data != null && !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.logo_data))) {
    throw new Error('La ficha PDF recibida no tiene un formato válido.');
  }
  if (photos && (photos.length > 3 || new Set(photos.map(photo => photo.slot)).size !== photos.length
    || photos.some(photo => !(photo.slot in personPhotoLabels) || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo.dataUrl)))) {
    throw new Error('Las fotografías de la ficha no tienen un formato válido.');
  }
  const english = data.language === 'en';
  const photoLabels = english ? { person: 'Person photo', document: 'Document photo', property: 'Property photo' } : personPhotoLabels;
  return {
    pageSize: 'A4', pageMargins: [36, 36, 36, 42],
    info: { title: data.filename.slice(0, -4), subject: english ? 'SRD individual person record' : 'Ficha individual de persona SRD' },
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#111827' },
    content: [
      ...(data.logo_data ? [{ columns: [
        { image: data.logo_data, fit: [64, 64], width: 70 },
        { stack: [
          { text: english ? 'Individual person record' : 'Ficha individual de persona', bold: true, fontSize: 19, margin: [0, 0, 0, 6] },
          { text: english ? `Download date (Colombia): ${data.date}` : `Fecha de descarga (Colombia): ${data.date}` },
        ] },
      ], columnGap: 12, margin: [0, 0, 0, 14] }] : [
        { text: english ? 'Individual person record' : 'Ficha individual de persona', bold: true, fontSize: 19, margin: [0, 0, 0, 6] },
        { text: english ? `Download date (Colombia): ${data.date}` : `Fecha de descarga (Colombia): ${data.date}`, margin: [0, 0, 0, 14] },
      ]),
      { table: {
        headerRows: 1, dontBreakRows: true, widths: [150, '*'],
        body: [data.headers.map(text => ({ text, bold: true, fillColor: '#edf4fa' })),
          ...data.rows.map(([label, value]) => [{ text: label, bold: true }, { text: value }])],
      }, layout: {
        hLineColor: () => '#b7c4d0', vLineColor: () => '#b7c4d0',
        hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 5, paddingBottom: () => 5,
      } },
      { text: english ? 'Position and descriptive role do not grant system access.' : 'El cargo y el rol descriptivo no conceden acceso al sistema.', fontSize: 9, color: '#475569', margin: [0, 12, 0, 0] },
      ...(photos?.length ? [
        { text: english ? 'Record photos' : 'Fotografías de la ficha', pageBreak: 'before', bold: true, fontSize: 16, margin: [0, 0, 0, 14] },
        ...photos.map(photo => ({ unbreakable: true, columns: [
          { image: photo.dataUrl, fit: [130, 105], width: 145 },
          { stack: [
            { text: photoLabels[photo.slot], bold: true, fontSize: 12, margin: [0, 6, 0, 4] },
            { text: english ? 'Saved in this record' : 'Guardada en esta ficha', fontSize: 9, color: '#475569' },
          ] },
        ], columnGap: 15, margin: [0, 0, 0, 14] })),
      ] : photos ? [{ text: english ? 'No photos are saved for this person.' : 'No hay fotografías guardadas para esta persona.', margin: [0, 12, 0, 0], color: '#475569' }] : []),
    ],
    footer: (page: number, pages: number) => ({ text: english ? `Page ${page} of ${pages}` : `Página ${page} de ${pages}`, alignment: 'right', margin: [36, 10, 36, 0], fontSize: 8 }),
  };
}

export async function downloadPersonIndividualPdf(data: PersonIndividualPdfData, photos?: PersonPdfPhoto[]): Promise<void> {
  const definition = personIndividualPdfDefinition(data, photos);
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake.js'), import('pdfmake/build/vfs_fonts.js'),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  await pdfMake.createPdf(definition).download(data.filename);
}
import { personPhotoLabels, type PersonPdfPhoto } from './PersonPdfPhotos';
