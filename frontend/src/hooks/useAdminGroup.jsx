import { createContext, useContext, useState } from 'react';

const AdminGroupContext = createContext(null);

export function AdminGroupProvider({ children }) {
  const [group, setGroupState] = useState(
    () => localStorage.getItem('admin_group') || 'F'
  );

  const setGroup = (g) => {
    localStorage.setItem('admin_group', g);
    setGroupState(g);
  };

  return (
    <AdminGroupContext.Provider value={{ group, setGroup }}>
      {children}
    </AdminGroupContext.Provider>
  );
}

export function useAdminGroup() {
  const ctx = useContext(AdminGroupContext);
  if (!ctx) throw new Error('useAdminGroup must be used within AdminGroupProvider');
  return ctx;
}
