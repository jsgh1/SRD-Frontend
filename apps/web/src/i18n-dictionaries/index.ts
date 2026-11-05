import { authTranslations } from './auth';
import { peopleTranslations } from './people';
import { organizationTranslations } from './organization';
import { calendarTranslations } from './calendar';
import { chatTranslations } from './chat';
import { treasuryTranslations } from './treasury';
import { inventoryTranslations } from './inventory';
import { filesTranslations } from './files';
import { auditTranslations } from './audit';
import { sharedTranslations } from './shared';

export const englishDictionaries = [
  authTranslations,
  peopleTranslations,
  organizationTranslations,
  calendarTranslations,
  chatTranslations,
  treasuryTranslations,
  inventoryTranslations,
  filesTranslations,
  auditTranslations,
  sharedTranslations,
] as const;

export const english: Record<string, string> = {
  ...authTranslations,
  ...peopleTranslations,
  ...organizationTranslations,
  ...calendarTranslations,
  ...chatTranslations,
  ...treasuryTranslations,
  ...inventoryTranslations,
  ...filesTranslations,
  ...auditTranslations,
  ...sharedTranslations,
};
