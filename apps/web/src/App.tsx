import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
} from "lucide-react";
import {
  ApiError,
  api,
  canAdmin,
  type Principal,
} from "./api";
import { Login } from "./Login";
import { Dashboard } from "./Dashboard";
import { broadcastLanguage, formatLocale, localizedTerms, setLanguage, t, useLanguage } from './i18n';
import { Contacts } from './Contacts';
import { Chat } from './Chat';
import { VoiceCall } from './VoiceCall';
import { GlobalSearch } from './GlobalSearch';
import { ExportCenter } from './ExportCenter';
import { SchedulerAlert } from './SchedulerAlert';
import { DeliveryAlert } from './DeliveryAlert';
import { AuditDeliveryAlert } from './AuditDeliveryAlert';
import { Audit } from "./Audit";
import { Calendar } from './Calendar';
import { Treasury } from './Treasury';
import { Inventory } from './Inventory';
import { Folders } from './Folders';
import { Downloads } from './Downloads';
import { InvitationAcceptance } from "./Memberships";
import { SettingsPanel } from "./SettingsPanel";
import { AppHeader } from "./AppHeader";
import { AppNavigation } from "./AppNavigation";
import { ErrorBox, Loading } from "./ui";
import { Persons, PersonForm } from "./Persons";

export function App() {
  useLanguage();
  const [principal, setPrincipal] = useState<Principal | null>(null),
    [organizationLogo, setOrganizationLogo] = useState<string | null>(null),
    [profilePhoto, setProfilePhoto] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [bootError, setBootError] = useState<unknown>(),
    [page, setPage] = useState("home"),
    [menu, setMenu] = useState(false),
    [profile, setProfile] = useState(false),
    [presenceSaving, setPresenceSaving] = useState(false),
    [languageSaving, setLanguageSaving] = useState(false),
    [calendarTarget, setCalendarTarget] = useState<string>(),
    [personExportTarget, setPersonExportTarget] = useState<string>(),
    [chatTarget, setChatTarget] = useState<string>(),
    [chatConversationTarget, setChatConversationTarget] = useState<string>(),
    [voiceConversation, setVoiceConversation] = useState<{ id: string; name: string }>(),
    [folderTarget, setFolderTarget] = useState<string>(),
    [folderRead, setFolderRead] = useState(false),
    [themeSaving, setThemeSaving] = useState(false),
    [theme, setTheme] = useState(localStorage.getItem("srd-theme") || "light"),
    [error, setError] = useState<unknown>();
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const mobile = window.matchMedia('(max-width: 650px)');
    if (!mobile.matches) { setMenu(false); return; }
    document.querySelector<HTMLButtonElement>('#main-sidebar nav button')?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(false);
        menuButton.current?.focus();
      }
    };
    const closeOnResize = () => { if (!mobile.matches) setMenu(false); };
    window.addEventListener('keydown', closeOnEscape);
    mobile.addEventListener('change', closeOnResize);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      mobile.removeEventListener('change', closeOnResize);
    };
  }, [menu]);
  useEffect(() => {
    if (location.pathname === '/invite') { setLoading(false); return; }
    api<Principal>("me")
      .then(p => { setPrincipal(p); setLanguage(p.user.language, p.user_id); })
      .catch(value => { if (!(value instanceof ApiError && value.status === 401)) setBootError(value); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("srd-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!principal || principal.terms_required) { setFolderRead(false); return; }
    let active = true;
    const refresh = () => { void api<{can_read:boolean}>('folder-access').then(value => { if (active) setFolderRead(value.can_read); })
      .catch(() => { if (active) setFolderRead(false); }); };
    refresh();
    const visible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', refresh);
    return () => { active = false; document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', refresh); };
  }, [principal?.organization.id, principal?.user_id, principal?.role, principal?.terms_required]);
  useEffect(() => {
    if (!principal || principal.terms_required) { setOrganizationLogo(null); return; }
    let active = true;
    let latest = 0;
    setOrganizationLogo(null);
    const refresh = () => {
      const request = ++latest;
      void api<{logo_data: string | null}>('planilla-settings')
        .then(value => { if (active && request === latest) setOrganizationLogo(value.logo_data); })
        .catch(() => { if (active && request === latest) setOrganizationLogo(null); });
    };
    refresh();
    window.addEventListener('srd-planilla-logo-updated', refresh);
    return () => { active = false; window.removeEventListener('srd-planilla-logo-updated', refresh); };
  }, [principal?.organization.id, principal?.terms_required]);
  useEffect(() => {
    if (!principal || principal.terms_required) { setProfilePhoto(null); return; }
    let active = true;
    let latest = 0;
    setProfilePhoto(null);
    const refresh = () => {
      const request = ++latest;
      void (principal.person_id
        ? api<{content: string; mime: string}>(`persons/${principal.person_id}/photos/person`).catch(() => null)
        : Promise.resolve(null))
        .then(personPhoto => personPhoto || api<{items: {present: boolean}[]}>(`users/${principal.user_id}/photos`)
          .then(data => data.items[0]?.present ? api<{content: string; mime: string}>(`users/${principal.user_id}/photos/avatar`) : null))
        .then(data => { if (active && request === latest) setProfilePhoto(data?.mime === 'image/png' ? `data:image/png;base64,${data.content}` : null); })
        .catch(() => { if (active && request === latest) setProfilePhoto(null); });
    };
    refresh();
    window.addEventListener('srd-profile-photo-updated', refresh);
    window.addEventListener('srd-person-photo-updated', refresh);
    return () => { active = false; window.removeEventListener('srd-profile-photo-updated', refresh); window.removeEventListener('srd-person-photo-updated', refresh); };
  }, [principal?.organization.id, principal?.user_id, principal?.person_id, principal?.terms_required]);
  useEffect(() => {
    const fn = (e: StorageEvent) => {
      if (e.key === "srd-theme") setTheme(e.newValue || "light");
    };
    window.addEventListener("storage", fn);
    return () => window.removeEventListener("storage", fn);
  }, []);
  async function reload() {
    const p = await api<Principal>("me");
    setPrincipal(p);
    setLanguage(p.user.language, p.user_id);
  }
  async function toggleTheme() {
    if (themeSaving || presenceSaving) return;
    const next = theme === "light" ? "dark" : "light";
    if (principal) {
      setThemeSaving(true);
      try {
        await api("profile", "PATCH", {
          name: principal.user.name,
          theme: next,
          presence: principal.user.presence,
        });
        setTheme(next);
        await reload();
      } catch (e) {
        setError(e);
      } finally {
        setThemeSaving(false);
      }
    } else setTheme(next);
  }
  async function changePresence(value: string) {
    if (!principal || presenceSaving || themeSaving || value === principal.user.presence) return;
    setPresenceSaving(true);
    try {
      await api('profile', 'PATCH', {
        name: principal.user.name,
        theme: principal.user.theme,
        presence: value,
      });
      await reload();
    } catch (cause) {
      setError(cause);
    } finally {
      setPresenceSaving(false);
    }
  }
  async function changeLanguage(value: 'es' | 'en') {
    if (!principal || languageSaving || value === principal.user.language) return;
    setLanguageSaving(true);
    try {
      await api('profile', 'PATCH', {
        name: principal.user.name,
        theme: principal.user.theme,
        presence: principal.user.presence,
        language: value,
      });
      broadcastLanguage(value, principal.user_id);
      await reload();
    } catch (cause) {
      setError(cause);
    } finally {
      setLanguageSaving(false);
    }
  }
  async function logout() {
    try {
      await api("auth/logout", "POST");
      setPrincipal(null);
      setProfile(false);
      setPage("home");
    } catch (e) {
      setError(e);
    }
  }
  function navigate(value: string) {
    const wasNavigationOpen = menu || profile;
    setFolderTarget(undefined);
    setPage(value);
    setMenu(false);
    setProfile(false);
    setError(null);
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      if (wasNavigationOpen) document.querySelector<HTMLElement>('.workspace')?.focus({ preventScroll: true });
    });
  }
  const chatStarted = useCallback(() => setChatTarget(undefined), []);
  const chatOpened = useCallback(() => setChatConversationTarget(undefined), []);
  if (location.pathname === '/invite') return <InvitationAcceptance />;
  if (loading)
    return (
      <main className="boot">
        <Building2 size={40} />
        <Loading />
      </main>
    );
  if (bootError && !principal)
    return <main className="boot"><div className="panel"><ErrorBox error={bootError} /><button type="button" className="primary" onClick={() => {
      setBootError(undefined); setLoading(true);
      void api<Principal>('me').then(p => { setPrincipal(p); setLanguage(p.user.language, p.user_id); })
        .catch(value => { if (!(value instanceof ApiError && value.status === 401)) setBootError(value); })
        .finally(() => setLoading(false));
    }}>{t('Reintentar')}</button></div></main>;
  if (!principal)
    return (
      <Login
        onLogin={(p) => {
          setPrincipal(p);
          setLanguage(p.user.language, p.user_id);
          setTheme(p.user.theme);
        }}
      />
    );
  if (principal.terms_required)
    return (
      <main className="boot">
        <div className="panel">
          <h1>{t('Los términos de tu junta cambiaron')}</h1>
          <p>{t('Lee la versión vigente para continuar.')}</p>
          <p className="terms-text">{localizedTerms(principal.organization.terms)}</p>
          <ErrorBox error={error} />
          <button
            className="primary"
            onClick={async () => {
              try {
                await api("auth/switchOrganization", "POST", {
                  organization_code: principal.organization.code,
                  terms_version_id: principal.organization.terms.id,
                  accepted: true,
                });
                await reload();
              } catch (e) {
                setError(e);
              }
            }}
          >
            {t('Aceptar y continuar')}
          </button>
          <button onClick={logout}>{t('Cerrar sesión')}</button>
        </div>
      </main>
    );
  return (
    <div
      className="app-shell"
      style={
        { "--accent": principal.organization.accent } as React.CSSProperties
      }
    >
      <AppHeader
        principal={principal}
        organizationLogo={organizationLogo}
        profilePhoto={profilePhoto}
        menu={menu}
        menuButton={menuButton}
        onToggleMenu={() => setMenu(!menu)}
        profile={profile}
        onProfileChange={setProfile}
        presenceSaving={presenceSaving}
        languageSaving={languageSaving}
        themeSaving={themeSaving}
        theme={theme}
        onNavigate={navigate}
        onChangePresence={(value) => void changePresence(value)}
        onChangeLanguage={(value) => void changeLanguage(value)}
        onToggleTheme={() => void toggleTheme()}
        onLogout={() => void logout()}
        onCopyEmailError={setError}
        onNotificationEvent={(id) => { setCalendarTarget(id); navigate("calendar"); }}
        onNotificationChat={(id) => { setChatTarget(undefined); setChatConversationTarget(id); navigate("chat"); }}
        onNotificationExport={(id) => { setPersonExportTarget(id); navigate("list"); }}
      />
      <AppNavigation
        principal={principal}
        folderRead={folderRead}
        page={page}
        menu={menu}
        menuButton={menuButton}
        onNavigate={navigate}
        onCloseMenu={() => setMenu(false)}
      />      <main className="workspace" tabIndex={-1} inert={menu}>
        <ErrorBox error={error} />
        <VoiceCall key={`${principal.organization.id}:${principal.user_id}`} conversationId={page === 'chat' ? voiceConversation?.id : undefined} contactName={voiceConversation?.name} selfId={principal.user_id} selfName={principal.user.name} selfPhoto={profilePhoto} organizationId={principal.organization.id} doNotDisturb={principal.user.presence === 'dnd'} />
        {canAdmin(principal.role) && <SchedulerAlert key={`${principal.organization.id}:${principal.user_id}`} onOpen={() => {
          navigate('settings');
          requestAnimationFrame(() => document.getElementById('settings-services')?.scrollIntoView({ block: 'start' }));
        }} />}
        {canAdmin(principal.role) && <DeliveryAlert key={`${principal.organization.id}:${principal.user_id}`} onOpen={() => {
          navigate('settings');
          requestAnimationFrame(() => document.getElementById('settings-services')?.scrollIntoView({ block: 'start' }));
        }} />}
        {canAdmin(principal.role) && <AuditDeliveryAlert key={`${principal.organization.id}:${principal.user_id}`} onOpen={() => {
          navigate('audit');
          window.scrollTo({ top: 0 });
        }} />}
        {page === "home" && (
          <Dashboard key={`${principal.organization.id}:dashboard`} principal={principal} navigate={navigate} />
        )}
        {page === "register" && (
          <PersonForm
            principal={principal}
            onSaved={() => navigate("list")}
            onBack={() => navigate("list")}
          />
        )}
        {(page === "list" || page === "lookup") && (
          <Persons
            principal={principal}
            mode={page === "list" ? "list" : "lookup"}
            openExportJobId={personExportTarget}
            onExportOpened={() => setPersonExportTarget(undefined)}
            onCreate={() => navigate("register")}
          />
        )}
        {page === "settings" && (
          <SettingsPanel
            key={`${principal.organization.id}:${principal.user_id}`}
            principal={principal}
            reload={reload}
            setTheme={setTheme}
          />
        )}
          {page === "audit" && <Audit key={`${principal.organization.id}:audit`} principal={principal} logoData={organizationLogo} />}
          {page === 'calendar' && <Calendar key={`${principal.organization.id}:calendar`} principal={principal} openEventId={calendarTarget} onOpened={() => setCalendarTarget(undefined)} />}
          {page === 'treasury' && <Treasury key={`${principal.organization.id}:treasury`} principal={principal} logoData={organizationLogo} />}
          {page === 'inventory' && <Inventory key={`${principal.organization.id}:inventory`} principal={principal} logoData={organizationLogo} />}
          {page === 'export' && <ExportCenter principal={principal} onOpen={navigate} />}
          {page === 'folders' && (canAdmin(principal.role) || folderRead) && <Folders key={`${principal.organization.id}:folders:${folderTarget ?? 'root'}`} canManage={canAdmin(principal.role)} initialFolder={folderTarget} />}
          {page === 'contacts' && <Contacts key={`${principal.organization.id}:contacts`} organizationId={principal.organization.id} onChat={id => { setChatTarget(id); navigate('chat'); }} />}
          {page === 'chat' && <Chat key={`${principal.organization.id}:chat`} userId={chatTarget} conversationId={chatConversationTarget} onStarted={chatStarted} onOpened={chatOpened} selfId={principal.user_id} organizationId={principal.organization.id} onContacts={() => navigate('contacts')} onVoiceSelection={setVoiceConversation} />}
          {page === 'search' && <GlobalSearch key={`${principal.organization.id}:search`} principal={principal} folderRead={folderRead || canAdmin(principal.role)} onOpenFolder={id => { navigate('folders'); setFolderTarget(id); }} />}
        {page === "downloads" && <Downloads />}
        <footer>
          ©{" "}
          {new Date().toLocaleDateString(formatLocale(), {
            year: "numeric",
            timeZone: "America/Bogota",
          })}{" "}
          · {principal.organization.name}
        </footer>
      </main>
    </div>
  );
}
