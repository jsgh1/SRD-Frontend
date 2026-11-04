import { useEffect } from 'react';
import Pusher from 'pusher-js';
import { api } from './api';
import { reportAuthorizationLoss } from './chatAuthorization';

export function useChatRealtime(identityId: string, tenantId: string) {
  useEffect(() => {
    let active = true;
    let socket: Pusher | undefined;
    let stopped = false;
    let connecting = false;
    let generation = 0;
    const disconnect = () => {
      generation++;
      connecting = false;
      socket?.disconnect();
      socket = undefined;
    };
    const stop = () => { stopped = true; disconnect(); };
    const connect = () => {
      if (!active || stopped || document.hidden || socket || connecting) return;
      connecting = true;
      const attempt = ++generation;
      void api<{ key: string; channel: string }>('chat/broadcast-config').then(value => {
        if (!active || stopped || document.hidden || attempt !== generation) return;
        const port = Number(window.location.port) || (window.location.protocol === 'https:' ? 443 : 80);
        const currentSocket = new Pusher(value.key, {
          cluster: 'mt1', wsHost: window.location.hostname, wsPort: port, wssPort: port,
          forceTLS: window.location.protocol === 'https:', enabledTransports: ['ws', 'wss'],
          channelAuthorization: { customHandler: (params, callback) => {
            void api<{ auth: string; channel_data: string }>('chat/broadcast-auth', 'POST', {
              socket_id: params.socketId, channel_name: params.channelName,
            }).then(auth => callback(null, auth)).catch(error => {
              if (active && attempt === generation && socket === currentSocket) reportAuthorizationLoss(error);
              callback(error instanceof Error ? error : new Error('No se pudo autorizar Chat.'), null);
            });
          } },
        });
        socket = currentSocket;
        currentSocket.subscribe(value.channel).bind('chat.changed', () => {
          if (!active || stopped || document.hidden || attempt !== generation || socket !== currentSocket) return;
          document.dispatchEvent(new Event('srd-chat-change'));
        });
      }).catch(error => {
        if (active && attempt === generation) reportAuthorizationLoss(error);
        // El sondeo recupera la conexión indisponible.
      }).finally(() => { if (attempt === generation) connecting = false; });
    };
    const onVisibility = () => { if (document.hidden) disconnect(); else connect(); };
    document.addEventListener('srd-chat-auth-lost', stop);
    document.addEventListener('visibilitychange', onVisibility);
    connect();
    return () => {
      active = false;
      document.removeEventListener('srd-chat-auth-lost', stop);
      document.removeEventListener('visibilitychange', onVisibility);
      disconnect();
    };
  }, [identityId, tenantId]);
}
