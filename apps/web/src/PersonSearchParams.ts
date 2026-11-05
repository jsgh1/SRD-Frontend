import type { ExtraFilter } from './PersonFilters';
import type { FilterSettings } from './PersonFilterSettings';

export type PersonBaseFilters = {
  document_type: string;
  gender: string;
  descriptive_role: string;
  position_code: string;
  birth_date_from: string;
  birth_date_to: string;
  registered_from: string;
  registered_to: string;
};

export const emptyPersonBaseFilters: PersonBaseFilters = {
  document_type: '',
  gender: '',
  descriptive_role: '',
  position_code: '',
  birth_date_from: '',
  birth_date_to: '',
  registered_from: '',
  registered_to: '',
};

type PersonSearchInput = {
  query: string;
  status: string;
  zone: string;
  affiliated: string;
  baseFilters: PersonBaseFilters;
  customFilters: ExtraFilter[];
  filterSettings?: Pick<FilterSettings, 'base'>;
};

export function buildPersonSearchParams({
  query,
  status,
  zone,
  affiliated,
  baseFilters,
  customFilters,
  filterSettings,
}: PersonSearchInput): URLSearchParams {
  const criteria = { status, zone, affiliated, ...baseFilters };
  const params = new URLSearchParams({ q: query });
  Object.entries(criteria).forEach(([key, value]) => {
    if (filterSettings?.base.includes(key)) params.set(key, value);
  });

  if (filterSettings?.base.includes('birth_date') && baseFilters.birth_date_from && baseFilters.birth_date_to) {
    params.set('birth_date_from', baseFilters.birth_date_from);
    params.set('birth_date_to', baseFilters.birth_date_to);
  }
  if (filterSettings?.base.includes('registered_at') && baseFilters.registered_from && baseFilters.registered_to) {
    params.set('registered_from', baseFilters.registered_from);
    params.set('registered_to', baseFilters.registered_to);
  }

  customFilters.forEach((filter, index) => {
    params.set(`custom_filters[${index}][field_id]`, filter.field_id);
    params.set(`custom_filters[${index}][value]`, filter.value);
    if (filter.operator === 'between') {
      params.set(`custom_filters[${index}][operator]`, 'between');
      params.set(`custom_filters[${index}][value_to]`, filter.value_to ?? '');
    }
  });

  return params;
}
