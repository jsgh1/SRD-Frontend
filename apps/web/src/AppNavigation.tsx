import type { RefObject } from "react";
import {
  CalendarDays,
  ClipboardList,
  Download,
  Folder,
  Home,
  MessageCircle,
  Package,
  Search,
  Settings,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { canAdmin, canWrite, type Principal } from "./api";
import { t } from "./i18n";

type AppNavigationProps = {
  principal: Principal;
  folderRead: boolean;
  page: string;
  menu: boolean;
  menuButton: RefObject<HTMLButtonElement | null>;
  onNavigate: (page: string) => void;
  onCloseMenu: () => void;
};

export function AppNavigation({
  principal,
  folderRead,
  page,
  menu,
  menuButton,
  onNavigate,
  onCloseMenu,
}: AppNavigationProps) {
  const links = [
    { key: "home", label: "Home", icon: Home },
    { key: "register", label: "Registro", icon: UserPlus, allow: canWrite(principal.role) },
    { key: "list", label: "Lista", icon: Users },
    { key: "lookup", label: "Consultar", icon: Search },
    { key: "contacts", label: "Contactos", icon: Users },
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "folders", label: "Carpeta", icon: Folder, allow: canAdmin(principal.role) || folderRead },
    { key: "calendar", label: "Calendario", icon: CalendarDays },
    { key: "treasury", label: "Tesorería", icon: Wallet, allow: ["superadmin", "admin", "treasurer"].includes(principal.role) },
    { key: "inventory", label: "Inventario", icon: Package, allow: ["superadmin", "admin", "treasurer"].includes(principal.role) },
    { key: "export", label: "Exportar", icon: Download },
    { key: "settings", label: "Configuración", icon: Settings },
    { key: "audit", label: "Auditoría", icon: ClipboardList, allow: ["superadmin", "admin", "auditor"].includes(principal.role) },
    { key: "downloads", label: "Descargas", icon: Download },
  ].filter((item) => item.allow !== false);

  return (
    <>
      <aside id="main-sidebar" className={"sidebar " + (menu ? "open" : "")}>
        <span className="nav-label">{t("MI JUNTA")}</span>
        <nav>
          {links.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => onNavigate(key)}
            >
              <Icon size={19} />
              {t(label)}
            </button>
          ))}
        </nav>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label={t("Cerrar menú")}
          onClick={() => {
            onCloseMenu();
            menuButton.current?.focus();
          }}
        />
      )}
    </>
  );
}
