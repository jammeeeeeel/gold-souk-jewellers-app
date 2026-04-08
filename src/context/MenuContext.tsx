import React, { createContext, useContext, useState } from "react";

interface MenuContextType {
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
}

const MenuContext = createContext<MenuContextType>({
  menuOpen: false,
  openMenu: () => {},
  closeMenu: () => {},
  toggleMenu: () => {},
});

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <MenuContext.Provider
      value={{
        menuOpen,
        openMenu: () => setMenuOpen(true),
        closeMenu: () => setMenuOpen(false),
        toggleMenu: () => setMenuOpen((v) => !v),
      }}
    >
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  return useContext(MenuContext);
}
