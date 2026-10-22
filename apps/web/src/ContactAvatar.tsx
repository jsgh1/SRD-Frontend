import { useEffect, useState } from 'react';
import { api } from './api';

export function ContactAvatar({ organizationId, userId, name }: { organizationId: string; userId: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSrc(null);
    void (async () => {
      try {
        const photo = await api<{ content: string; mime: string }>(`users/${userId}/photos/avatar`);
        if (active && photo.mime === 'image/png') { setSrc(`data:image/png;base64,${photo.content}`); return; }
      } catch { /* A linked person photo may still be available. */ }
      try {
        const contact = await api<{ person_id?: string | null }>(`contacts/${userId}`);
        if (!contact.person_id) return;
        const photo = await api<{ content: string; mime: string }>(`persons/${contact.person_id}/photos/person`);
        if (active && photo.mime === 'image/png') setSrc(`data:image/png;base64,${photo.content}`);
      } catch { if (active) setSrc(null); }
    })();
    return () => { active = false; };
  }, [organizationId, userId]);

  return <span className="avatar" aria-hidden="true">{src ? <img src={src} alt="" /> : name.slice(0, 1)}</span>;
}
