import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../App';

const Layout = () => {
    const { admin, logout } = useAuth();
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'Dashboard', icon: '📊' },
        { path: '/users', label: 'User Management', icon: '👥' },
        { path: '/analytics', label: 'Analytics', icon: '📈' },
        { path: '/system', label: 'System Control', icon: '⚡' },
    ];

    return (
        <div className="app-container">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="logo">
                    <div className="logo-icon">👑</div>
                    <div className="logo-text">
                        <h1>Super Admin</h1>
                        <span>Control Center</span>
                    </div>
                </div>

                <nav className="nav-menu">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-item ${isActive ? 'active' : ''}`
                            }
                            end={item.path === '/'}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-text">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info" style={{ marginBottom: '16px' }}>
                        <div className="user-avatar">
                            {admin?.email?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div className="user-details">
                            <h4>Super Admin</h4>
                            <span>{admin?.email}</span>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={logout}>
                        <span>🚪</span>
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
