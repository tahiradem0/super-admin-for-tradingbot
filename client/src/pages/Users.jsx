import { useState, useEffect } from 'react';
import { useAuth } from '../App';

const Users = () => {
    const { api } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);

    // Edit Modal State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editSettings, setEditSettings] = useState({});

    // Analytics Modal State
    const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
    const [analyticsData, setAnalyticsData] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const data = await api('/users');
            setUsers(data.users || []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleUserStatus = async (userId, currentStatus) => {
        try {
            await api(`/users/${userId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: !currentStatus })
            });
            fetchUsers();
        } catch (err) {
            console.error('Failed to toggle status:', err);
        }
    };

    const deleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to DELETE this user? This action cannot be undone.')) {
            return;
        }

        try {
            await api(`/users/${userId}`, { method: 'DELETE' });
            fetchUsers();
        } catch (err) {
            console.error('Failed to delete user:', err);
        }
    };

    const openEditModal = (user) => {
        setSelectedUser(user);
        setEditSettings({
            lot_per_base: user.lot_per_base || 0.35,
            max_lot: user.max_lot || 4.8,
            min_entry_gap: user.min_entry_gap || 0.00005,
            max_spread: user.max_spread || 0.00003,
        });
        setEditModalOpen(true);
    };

    const saveSettings = async () => {
        try {
            await api(`/users/${selectedUser.id}/settings`, {
                method: 'PATCH',
                body: JSON.stringify(editSettings)
            });
            setEditModalOpen(false);
            fetchUsers();
        } catch (err) {
            console.error('Failed to save settings:', err);
        }
    };

    const viewUserAnalytics = async (userId) => {
        try {
            const data = await api(`/users/${userId}`);
            setAnalyticsData(data);
            setAnalyticsModalOpen(true);
        } catch (err) {
            console.error('Failed to fetch user analytics:', err);
        }
    };

    // Calculate derived stats for the modal
    const getAnalyticsStats = () => {
        if (!analyticsData || !analyticsData.trades) return null;

        const trades = analyticsData.trades;
        const totalTrades = trades.length;
        const totalProfit = trades.reduce((sum, t) => sum + parseFloat(t.net_profit), 0);

        // Win Rate
        const wins = trades.filter(t => parseFloat(t.net_profit) > 0).length;
        const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;

        // Today's Stats
        const today = new Date().toDateString();
        const todayTrades = trades.filter(t => new Date(t.entry_time).toDateString() === today);
        const todayProfit = todayTrades.reduce((sum, t) => sum + parseFloat(t.net_profit), 0);

        return {
            totalTrades,
            totalProfit,
            winRate,
            todayTradesCount: todayTrades.length,
            todayProfit
        };
    };

    const filteredUsers = users.filter(user =>
        user.email?.toLowerCase().includes(search.toLowerCase()) ||
        user.username?.toLowerCase().includes(search.toLowerCase())
    );

    const formatCurrency = (value) => {
        const num = parseFloat(value) || 0;
        return num >= 0 ? `+$${num.toFixed(2)}` : `-$${Math.abs(num).toFixed(2)}`;
    };

    const analyticsStats = getAnalyticsStats();

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Loading users...</p>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">👥 User Management</h1>
                <p className="page-subtitle">Control and monitor all registered users</p>
            </div>

            {/* Search Bar */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="search-bar">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Search by email or username..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Users Table */}
            <div className="card">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">All Users ({filteredUsers.length})</h3>
                        <p className="card-subtitle">Click on actions to manage each user</p>
                    </div>
                </div>

                {filteredUsers.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">👤</div>
                        <h3 className="empty-title">No users found</h3>
                        <p className="empty-text">No users match your search criteria</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Status</th>
                                    <th>Trades</th>
                                    <th>Net Profit</th>
                                    <th>Lot Size</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td>
                                            <div className="user-info">
                                                <div className="user-avatar">
                                                    {user.username?.[0]?.toUpperCase() || 'U'}
                                                </div>
                                                <div className="user-details">
                                                    <h4>{user.username}</h4>
                                                    <span>{user.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                                                <span className={`status-dot ${user.is_active ? 'active' : 'inactive'}`}></span>
                                                {user.is_active ? 'Active' : 'Banned'}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: '600' }}>{user.total_trades || 0}</span>
                                            {user.open_trades > 0 && (
                                                <span className="badge badge-warning" style={{ marginLeft: '8px' }}>
                                                    {user.open_trades} open
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <span style={{
                                                fontWeight: '600',
                                                color: (user.total_profit || 0) >= 0 ? 'var(--success)' : 'var(--danger)'
                                            }}>
                                                {formatCurrency(user.total_profit)}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ color: 'var(--text-muted)' }}>
                                                {user.lot_per_base || 0.35}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    className="btn btn-sm btn-outline"
                                                    onClick={() => openEditModal(user)}
                                                    title="Edit Settings"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-outline"
                                                    onClick={() => viewUserAnalytics(user.id)}
                                                    title="View Analytics"
                                                >
                                                    👁️
                                                </button>
                                                <button
                                                    className={`btn btn-sm ${user.is_active ? 'btn-outline' : 'btn-success'}`}
                                                    onClick={() => toggleUserStatus(user.id, user.is_active)}
                                                    title={user.is_active ? 'Ban User' : 'Activate User'}
                                                >
                                                    {user.is_active ? '🚫' : '✅'}
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => deleteUser(user.id)}
                                                    title="Delete User"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit Settings Modal */}
            {editModalOpen && selectedUser && (
                <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Edit User Settings</h2>
                            <button className="modal-close" onClick={() => setEditModalOpen(false)}>×</button>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <div className="user-info">
                                <div className="user-avatar">
                                    {selectedUser.username?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <div className="user-details">
                                    <h4>{selectedUser.username}</h4>
                                    <span>{selectedUser.email}</span>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Lot Per Base ($100)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="form-input"
                                value={editSettings.lot_per_base}
                                onChange={(e) => setEditSettings({ ...editSettings, lot_per_base: parseFloat(e.target.value) })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Max Lot Size</label>
                            <input
                                type="number"
                                step="0.1"
                                className="form-input"
                                value={editSettings.max_lot}
                                onChange={(e) => setEditSettings({ ...editSettings, max_lot: parseFloat(e.target.value) })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Min Entry Gap (pips)</label>
                            <input
                                type="number"
                                step="0.00001"
                                className="form-input"
                                value={editSettings.min_entry_gap}
                                onChange={(e) => setEditSettings({ ...editSettings, min_entry_gap: parseFloat(e.target.value) })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Max Spread (pips)</label>
                            <input
                                type="number"
                                step="0.00001"
                                className="form-input"
                                value={editSettings.max_spread}
                                onChange={(e) => setEditSettings({ ...editSettings, max_spread: parseFloat(e.target.value) })}
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-outline" onClick={() => setEditModalOpen(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={saveSettings}>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Analytics Modal */}
            {analyticsModalOpen && analyticsData && (
                <div className="modal-overlay" onClick={() => setAnalyticsModalOpen(false)}>
                    <div className="modal" style={{ maxWidth: '800px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2 className="modal-title">Trader Analytics</h2>
                                <p className="modal-subtitle">Performance report for {analyticsData.user.username}</p>
                            </div>
                            <button className="modal-close" onClick={() => setAnalyticsModalOpen(false)}>×</button>
                        </div>

                        {/* Top Stats Cards */}
                        <div className="analytics-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '16px',
                            marginBottom: '24px'
                        }}>
                            <div className="stat-card" style={{ padding: '16px' }}>
                                <div className="stat-label">Total Profit</div>
                                <div className={`stat-value ${analyticsStats.totalProfit >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '24px' }}>
                                    {formatCurrency(analyticsStats.totalProfit)}
                                </div>
                            </div>

                            <div className="stat-card" style={{ padding: '16px' }}>
                                <div className="stat-label">Today's Profit</div>
                                <div className={`stat-value ${analyticsStats.todayProfit >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '24px' }}>
                                    {formatCurrency(analyticsStats.todayProfit)}
                                </div>
                                <div className="stat-subtext" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {analyticsStats.todayTradesCount} trades
                                </div>
                            </div>

                            <div className="stat-card" style={{ padding: '16px' }}>
                                <div className="stat-label">Win Rate</div>
                                <div className="stat-value" style={{ fontSize: '24px' }}>
                                    {analyticsStats.winRate}%
                                </div>
                            </div>

                            <div className="stat-card" style={{ padding: '16px' }}>
                                <div className="stat-label">Total Trades</div>
                                <div className="stat-value" style={{ fontSize: '24px' }}>
                                    {analyticsStats.totalTrades}
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity Table */}
                        <div className="section-title" style={{ marginBottom: '16px', fontWeight: '600' }}>Recent Activity</div>

                        <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <table style={{ width: '100%' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr>
                                        <th>Time</th>
                                        <th>Symbol</th>
                                        <th>Type</th>
                                        <th>Volume</th>
                                        <th>Profit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analyticsData.trades.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '32px' }}>No trades recorded yet</td>
                                        </tr>
                                    ) : (
                                        analyticsData.trades.map((trade, idx) => (
                                            <tr key={idx}>
                                                <td>{new Date(trade.entry_time).toLocaleString()}</td>
                                                <td>{trade.symbol}</td>
                                                <td>
                                                    <span className={`badge ${trade.type === 'BUY' ? 'badge-success' : 'badge-danger'}`} style={{ padding: '4px 8px', fontSize: '11px' }}>
                                                        {trade.type}
                                                    </span>
                                                </td>
                                                <td>{trade.volume}</td>
                                                <td>
                                                    <span style={{
                                                        fontWeight: '600',
                                                        color: parseFloat(trade.net_profit) >= 0 ? 'var(--success)' : 'var(--danger)'
                                                    }}>
                                                        {formatCurrency(trade.net_profit)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
