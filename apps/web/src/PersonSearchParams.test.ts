import { describe, expect, it } from 'vitest';
import { buildPersonSearchParams, emptyPersonBaseFilters } from './PersonSearchParams';

describe('buildPersonSearchParams', () => {
  it('includes only base filters enabled for the current junta', () => {
    const params = buildPersonSearchParams({
      query: 'Ana Perez',
      status: 'pending',
      zone: 'rural',
      affiliated: '1',
      baseFilters: { ...emptyPersonBaseFilters, document_type: 'CC', gender: 'female' },
      customFilters: [],
      filterSettings: { base: ['status', 'zone', 'document_type'] },
    });

    expect(params.get('q')).toBe('Ana Perez');
    expect(params.get('status')).toBe('pending');
    expect(params.get('zone')).toBe('rural');
    expect(params.get('document_type')).toBe('CC');
    expect(params.has('affiliated')).toBe(false);
    expect(params.has('gender')).toBe(false);
  });

  it('adds only complete date ranges and keeps custom filters in their submitted order', () => {
    const params = buildPersonSearchParams({
      query: '',
      status: '',
      zone: '',
      affiliated: '',
      baseFilters: {
        ...emptyPersonBaseFilters,
        birth_date_from: '1990-01-01',
        birth_date_to: '2000-12-31',
        registered_from: '2025-01-01',
      },
      customFilters: [
        { field_id: 'document-status', value: 'active' },
        { field_id: 'age-range', value: '18', operator: 'between', value_to: '65' },
      ],
      filterSettings: { base: ['birth_date', 'registered_at'] },
    });

    expect(params.get('birth_date_from')).toBe('1990-01-01');
    expect(params.get('birth_date_to')).toBe('2000-12-31');
    expect(params.has('registered_from')).toBe(false);
    expect(params.has('registered_to')).toBe(false);
    expect(params.get('custom_filters[0][field_id]')).toBe('document-status');
    expect(params.get('custom_filters[0][value]')).toBe('active');
    expect(params.has('custom_filters[0][operator]')).toBe(false);
    expect(params.get('custom_filters[1][field_id]')).toBe('age-range');
    expect(params.get('custom_filters[1][operator]')).toBe('between');
    expect(params.get('custom_filters[1][value_to]')).toBe('65');
  });
});
