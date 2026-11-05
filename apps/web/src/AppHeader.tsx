import { useEffect, useRef, type RefObject } from "react";
import {
  Building2,
  ChevronDown,
  Copy,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { roleNames, type Principal } from "./api";
import { Notifications } from "./Notifications";
import { Presence } from "./Presence";
import { t } from "./i18n";

type AppHeaderProps = {
  principal: Principal;
  organizationLogo: string | null;
  profilePhoto: string | null;
  menu: boolean;
  menuButton: RefObject<HTMLButtonElement | null>;
  onToggleMenu: () => void;
  profile: boolean;
  onProfileChange: (open: boolean) => void;
  presenceSaving: boolean;
  languageSaving: boolean;
  themeSaving: boolean;
  theme: string;
  onNavigate: (page: string) => void;
  onChangePresence: (value: string) => void;
  onChangeLanguage: (value: "es" | "en") => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  onCopyEmailError: (error: Error) => void;
  onNotificationEvent: (id: string) => void;
  onNotificationChat: (id: string) => void;
  onNotificationExport: (id: string) => void;
};

export function AppHeader({
  principal,
  organizationLogo,
  profilePhoto,
  menu,
  menuButton,
  onToggleMenu,
  profile,
  onProfileChange,
  presenceSaving,
  languageSaving,
  themeSaving,
  theme,
  onNavigate,
  onChangePresence,
  onChangeLanguage,
  onToggleTheme,
  onLogout,
  onCopyEmailError,
  onNotificationEvent,
  onNotificationChat,
  onNotificationExport,
}: AppHeaderProps) {
  const profileAnchor = useRef<HTMLDivElement>(null);
  const profileButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!profile) return;
    const closeOutside = (event: PointerEvent) => {
      if (!profileAnchor.current?.contains(event.target as Node)) onProfileChange(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [profile, onProfileChange]);

  return (
    <header className="app-header">
      <button
        ref={menuButton}
        className="icon-button hamburger"
        aria-label={t(menu ? "Cerrar menú" : "Abrir menú")}
        aria-expanded={menu}
        aria-controls="main-sidebar"
        onClick={onToggleMenu}
      >
        <Menu />
      </button>
      <a
        className="brand"
        href="#home"
        onClick={(event) => {
          event.preventDefault();
          onNavigate("home");
        }}
      >
        <span className={organizationLogo ? "brand-mark brand-mark-logo" : "brand-mark"}>
          {organizationLogo ? <img src={organizationLogo} alt="" /> : <Building2 size={22} />}
        </span>
        <span>
          {principal.organization.name}
          <small>{t("Sistema de Registro Digital")}</small>
        </span>
      </a>
      <button className="header-search" onClick={() => onNavigate("search")} aria-label={t("Buscar en la junta")}>
        <Search size={18} />
        <span>{t("Buscar en la junta")}</span>
      </button>
      <div
        className="profile-anchor"
        ref={profileAnchor}
        onKeyDown={(event) => {
          if (event.key === "Escape" && profile) {
            onProfileChange(false);
            profileButton.current?.focus();
          }
        }}
      >
        <Notifications
          key={principal.organization.id}
          organizationId={principal.organization.id}
          doNotDisturb={principal.user.presence === "dnd"}
          onEvent={onNotificationEvent}
          onChat={onNotificationChat}
          onExport={onNotificationExport}
        />
        <button
          ref={profileButton}
          className="profile-trigger"
          aria-label={t("Abrir perfil de {name}", { name: principal.user.name })}
          aria-expanded={profile}
          aria-controls="profile-menu"
          onClick={() => onProfileChange(!profile)}
        >
          <span className="avatar">
            {profilePhoto ? <img src={profilePhoto} alt="" /> : principal.user.name.slice(0, 1)}
          </span>
          <span className="profile-name">
            {principal.user.name}
            <small>{t(roleNames[principal.role])}</small>
          </span>
          <ChevronDown size={16} />
        </button>
        <div className="profile-menu" id="profile-menu" hidden={!profile}>
          {profilePhoto && <img className="profile-menu-photo" src={profilePhoto} alt={t("Mi foto de perfil")} />}
          <strong>{principal.user.name}</strong>
          <small>{t(roleNames[principal.role])}</small>
          <button
            className="copy-email"
            title={principal.user.email}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(principal.user.email);
              } catch {
                onCopyEmailError(new Error(t("No se pudo copiar el correo.")));
              }
            }}
          >
            <span>{principal.user.email}</span>
            <Copy size={14} />
          </button>
          <div className="profile-presence">
            <label htmlFor="profile-presence-choice">{t("Estado")}</label>
            <select
              id="profile-presence-choice"
              value={principal.user.presence}
              disabled={presenceSaving || themeSaving}
              onChange={(event) => onChangePresence(event.target.value)}
            >
              <option value="online">{t("En línea")}</option>
              <option value="away">{t("Ausente")}</option>
              <option value="dnd">{t("No molestar")}</option>
              <option value="invisible">{t("Invisible")}</option>
            </select>
            <Presence principal={principal} />
          </div>
          <div className="profile-presence">
            <label htmlFor="profile-language-choice">{t("Idioma")}</label>
            <select
              id="profile-language-choice"
              value={principal.user.language}
              disabled={languageSaving}
              onChange={(event) => onChangeLanguage(event.target.value as "es" | "en")}
            >
              <option value="es">{t("Español")}</option>
              <option value="en">{t("Inglés")}</option>
            </select>
          </div>
          <button onClick={onToggleTheme} disabled={themeSaving || presenceSaving}>
            {theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
            {t(theme === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro")}
          </button>
          <button onClick={() => onNavigate("settings")}>
            <Settings size={18} />
            {t("Editar perfil")}
          </button>
          <button onClick={onLogout}>
            <LogOut size={18} />
            {t("Cerrar sesión")}
          </button>
        </div>
      </div>
    </header>
  );
}
