import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonTable } from './Persons';
import type { Person } from './personTypes';
import { setLanguage } from './i18n';

const person = {
  id: 'person-1',
  first_names: 'Ana',
  last_names: 'Pérez',
  document_type: 'CC',
  document_number: '123456789',
  status: 'complete',
  version: 2,
  created_at: '2026-10-30 18:00:00',
} as Person;

beforeEach(() => setLanguage('es'));
afterEach(() => {
  cleanup();
  setLanguage('es');
});

describe('PersonTable', () => {
  it('shows the same person in desktop and mobile views and wires permitted actions', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<PersonTable rows={[person]} onView={onView} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Lista de personas' })).toBeTruthy();
    const mobile = within(screen.getByRole('list', { name: 'Lista de personas' }));
    expect(mobile.getByText('Ana Pérez')).toBeTruthy();
    expect(mobile.getByText('CC 123456789')).toBeTruthy();
    expect(mobile.getByText('Completado')).toBeTruthy();
    expect(mobile.getByText('30/10/2026')).toBeTruthy();

    fireEvent.click(mobile.getByRole('button', { name: 'Ver Ana' }));
    fireEvent.click(mobile.getByRole('button', { name: 'Editar Ana' }));
    fireEvent.click(mobile.getByRole('button', { name: 'Eliminar Ana' }));
    expect(onView).toHaveBeenCalledExactlyOnceWith(person);
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(person);
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(person);
  });

  it('translates headings and status while omitting edit and delete actions when unavailable', () => {
    setLanguage('en');
    const onView = vi.fn();
    render(<PersonTable rows={[person]} onView={onView} />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Document' })).toBeTruthy();
    const mobile = within(screen.getByRole('list', { name: 'People' }));
    expect(mobile.getByText('Complete')).toBeTruthy();
    expect(mobile.queryByRole('button', { name: 'Edit Ana' })).toBeNull();
    expect(mobile.queryByRole('button', { name: 'Delete Ana' })).toBeNull();
    fireEvent.click(mobile.getByRole('button', { name: 'View Ana' }));
    expect(onView).toHaveBeenCalledExactlyOnceWith(person);
  });
});
