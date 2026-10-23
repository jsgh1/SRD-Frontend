# SRD · Frontend

> Interfaces de **Sistema de Registro Digital (SRD)** para web, escritorio y dispositivos móviles. Clientes de una plataforma multi‑tenant para Juntas de Acción Comunal.

[Backend](https://github.com/jsgh1/SRD-Backend/tree/dev) · [Database](https://github.com/jsgh1/SRD-Database/tree/dev) · [Docker e Infraestructura](https://github.com/jsgh1/SRD-Docker-Infra/tree/dev) · [Entregables](https://github.com/jsgh1/SRD-Docs/tree/dev)

## 1. ¿Qué contiene?

Este repositorio concentra las aplicaciones de usuario y sus dependencias. **No contiene los microservicios Laravel ni las migraciones MySQL**. La web se publica detrás de Nginx, que enruta `/api/v1/` al Gateway Laravel. El entorno Docker que ensambla todos los componentes vive en [SRD-Docker-Infra](https://github.com/jsgh1/SRD-Docker-Infra/tree/dev).

| Carpeta | Tecnología comprobada | Propósito |
| --- | --- | --- |
| [`apps/web/`](apps/web) | React 19, TypeScript, Vite 7 | Aplicación principal de navegador |
| [`apps/desktop/`](apps/desktop) | Electron 44, Electron Forge | Cliente Windows que abre la interfaz web del servidor |
| [`apps/mobile-expo/`](apps/mobile-expo) | React Native 0.86, Expo SDK 57 | Cliente móvil Expo, conexión con servidor SRD |
| [`apps/mobile/`](apps/mobile) | React Native 0.87, Metro, Jest | Proyecto móvil React Native separado del cliente Expo |
| [`.github/workflows/`](.github/workflows) | GitHub Actions | Validación automática del build web |

> `mobile/` y `mobile-expo/` son **dos proyectos distintos**, con versiones y comandos propios. No se deben mezclar sus `node_modules` ni asumir que uno sustituye automáticamente al otro.

## 2. Interfaz web

```text
apps/web/
├── src/
│   ├── App.tsx                   # Pantallas, navegación y contexto de sesión
│   ├── api.ts                    # Cliente HTTP, CSRF, sesiones y errores
│   ├── Login.tsx                 # Inicio de sesión
│   ├── Persons.tsx               # CRUD de personas
│   ├── Organizations.tsx         # Juntas y gestión de organizaciones
│   ├── Memberships.tsx           # Membresías e invitaciones
│   ├── Folders.tsx               # Carpetas y documentos privados
│   ├── Inventory.tsx             # Inventario
│   ├── Treasury.tsx              # Tesorería
│   ├── Calendar.tsx              # Agenda y eventos
│   ├── Chat.tsx                  # Conversaciones
│   ├── Notifications.tsx         # Bandeja y preferencias
│   ├── Audit.tsx                 # Auditoría
│   └── ...                       # Configuración, filtros, exportaciones, idioma
├── package.json
├── package-lock.json
└── vite.config.ts
```

Las pantallas se componen con **componentes React y hooks**, mientras que `api.ts` encapsula las solicitudes `fetch` contra el Gateway: credenciales `same-origin`, `X-CSRF-TOKEN` para escrituras, tratamiento de errores y cancelación de solicitudes.

Los flujos visibles incluyen personas, juntas, configuración, carpetas, documentos, foto de perfil, inventario, tesorería, calendario, auditoría, notificaciones, chat y búsqueda global. **Los permisos efectivos se verifican en el Backend**, nunca solamente ocultando controles en React.

### Desarrollo web independiente

Requisitos: Node.js compatible con las dependencias instaladas y npm.

```powershell
cd apps/web
npm ci
npm run dev
```

Vite utiliza `127.0.0.1:5173` por defecto según `package.json`. Esta forma de ejecutar **solo el frontend** requiere disponer de una API de SRD accesible y correctamente configurada. Para autenticación y datos reales de prueba es preferible usar el entorno integrado de Docker.

### Compilación de producción

```powershell
cd apps/web
npm ci --no-audit --no-fund
npm run build
```

`npm run build` ejecuta `tsc -b` y después `vite build`. La CI [migration-web-build.yml](.github/workflows/migration-web-build.yml) reproduce estos pasos en PR a `dev`.

## 3. Cliente de escritorio

La aplicación Electron usa los archivos:

- `apps/desktop/main.cjs`: proceso principal y ventana de la aplicación.
- `apps/desktop/server-url.cjs`: gestión de URL del servidor.
- `apps/desktop/forge.config.cjs`: configuración de empaquetado.
- `apps/desktop/tests/server-url.test.cjs`: prueba del manejo de URL.

```powershell
cd apps/desktop
npm ci
npm test
npm start
# Empaquetado Windows, cuando se requiera:
npm run make
```

El escritorio **depende de un servidor SRD disponible**: no almacena una segunda copia independiente del Backend Laravel. Consulta `server-url.cjs` antes de publicar instaladores o modificar dominios.

## 4. Clientes móviles

### Expo (`apps/mobile-expo`)

```powershell
cd apps/mobile-expo
npm ci
npx expo start
# O, para Android con el entorno preparado:
npm run android
```

Incluye módulos de agenda, notificaciones, perfil, cambio de organización y una capa API en `src/api.ts`. Configurar una URL alcanzable desde el teléfono o emulador: **`localhost` dentro del móvil no es el computador que ejecuta Docker**.

### React Native CLI (`apps/mobile`)

```powershell
cd apps/mobile
npm ci
npm test
npm start
# En otro terminal, con Android SDK/emulador correctamente configurado:
npm run android
```

Requiere herramientas nativas adicionales. El diseño y las funciones de estos dos clientes no deben darse por idénticos sin pruebas en dispositivo.

## 5. Arquitectura de integración

```text
   React Web ────────────┐
   Electron → Web ───────┼── HTTP(S) ── Nginx ── /api/v1 ── Laravel Gateway
   Expo / React Native ──┘                                 │
                                           Identity · Records · Files · ...
                                                         │
                                                 MySQL por servicio
```

- **Web:** peticiones relativas `/api/v1/...`, mismo origen y cookies de sesión.
- **Chat:** cliente de tiempo real con Reverb/WebSocket cuando está disponible; requiere proxy y configuración del servidor.
- **Desktop:** ventana Electron conectada al SRD web desplegado.
- **Mobile:** consumen endpoints del Backend; conexión y permisos de red se configuran por entorno.
- **Multi‑tenant:** después de autenticarse, la sesión incluye el contexto de junta permitido; los accesos entre organizaciones no se resuelven en el navegador.

## 6. ¿Cómo levantar toda la plataforma con Docker?

La **guía de ensamblaje y despliegue** está centralizada en [SRD-Docker-Infra → README](https://github.com/jsgh1/SRD-Docker-Infra/blob/dev/README.md). En resumen:

1. Clonar los cinco repositorios desde `dev` en carpetas hermanas.
2. Ensamblar **temporalmente** `apps/` (este repo), `services/` y `packages/` (Backend), `services/*/database/migrations` (Database), y la raíz de Infra.
3. En el `workspace` ensamblado, establecer un nombre Compose exclusivo cuando sea una máquina compartida y ejecutar `./scripts/Up.ps1` en PowerShell.
4. Abrir `http://127.0.0.1:8080` (web) y `http://127.0.0.1:8025` (Mailpit de desarrollo).

**No** ejecutes Docker Compose desde `apps/web`: ahí no están los servicios ni la base MySQL.

## 7. Validación funcional

Las suites E2E viven en `SRD-Docker-Infra/tools/browser-tests/`. Hay pruebas de login con verificación por correo, CSRF, CRUD, juntas, carpetas y permisos, calendario y conversación en tiempo real. Un ejemplo en un entorno SRD **aislado**:

```powershell
# Desde el workspace ensamblado de SRD, nunca desde un VPS real:
$env:COMPOSE_PROJECT_NAME = "srd-mi-qa"
npm ci --prefix tools/browser-tests --no-audit --no-fund
.\scripts\Test-Browser.ps1 -Compose -Spec "access.spec.mjs"
```

Las pruebas de navegador insertan cuentas/juntas ficticias. No ejecutarlas sobre datos de usuarios reales. En la QA de migración del 23/10/2026, el build web en GitHub Actions aprobó y `access.spec.mjs` ejecutó **2 pruebas E2E sin fallos** en el entorno aislado del SENA.

## 8. Convenciones y contribución

- Un cambio en contratos API debe coordinarse con [SRD-Backend](https://github.com/jsgh1/SRD-Backend/tree/dev).
- Mantener textos de interfaz en español/inglés en los módulos de internacionalización; evitar cadenas sueltas sin traducción.
- Nunca subir credenciales, tokens, `node_modules`, archivos de build ni datos personales.
- Trabajar en una rama hija desde `dev`, ejecutar `npm run build` y las pruebas pertinentes, crear PR y solicitar revisión. Pasar a `qa`/`main` únicamente con evidencia de aceptación.

## 9. Problemas frecuentes

| Caso | Verificación |
| --- | --- |
| `/api/v1` devuelve 502/404 | Estado de Gateway, configuración Nginx y proxy de Docker |
| La web compila pero no inicia sesión | Cookies, CSRF, Identity, Mailpit/SMTP, código de junta |
| Reverb no conecta | Proxy WebSocket, servicio `chat-reverb` y configuración HTTPS/WSS |
| El móvil no encuentra la API | IP o dominio accesible desde el dispositivo, red/Wi‑Fi y certificado |
| Electron abre la página incorrecta | URL elegida en `apps/desktop/server-url.cjs` |

---

**Frontend:** [jsgh1/SRD-Frontend](https://github.com/jsgh1/SRD-Frontend) · **Backend:** [jsgh1/SRD-Backend](https://github.com/jsgh1/SRD-Backend) · **Orquestación:** [jsgh1/SRD-Docker-Infra](https://github.com/jsgh1/SRD-Docker-Infra).
