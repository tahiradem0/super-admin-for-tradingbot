import { useState, useEffect } from 'react';
import { useAuth } from '../App';

const Dashboard = () => {
    const { api } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            const data = await api('/analytics/overview');
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Loading dashboard...</p>
            </div>
        );
    }

    const formatCurrency = (value) => {
        const num = parseFloat(value) || 0;
        return num >= 0
            ? `+$${num.toFixed(2)}`
            : `-$${Math.abs(num).toFixed(2)}`;
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📊 Command Center</h1>
                <p className="page-subtitle">Real-time overview of your trading empire</p>
            </div>

            {/* Kill Switch Status Banner */}
            {stats?.systemSettings?.global_kill_switch && (
                <div className="card" style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    marginBottom: '24px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '32px' }}>🚨</span>
                        <div>
                            <h3 style={{ color: 'var(--danger)', fontSize: '18px', fontWeight: '600' }}>
                                GLOBAL KILL SWITCH ACTIVE
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                                All trading bots are currently stopped
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-value">{stats?.totalUsers || 0}</div>
                    <div className="stat-label">Total Users</div>
                    <div className="stat-change up">
                        <span>↑</span>
                        <span>{stats?.activeUsers || 0} active</span>
                    </div>
                </div>

                <div className="stat-card success">
                    <div className="stat-icon">💰</div>
                    <div className={`stat-value ${stats?.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(stats?.totalProfit)}
                    </div>
                    <div className="stat-label">Total Net Profit</div>
                    <div className={`stat-change ${stats?.todayProfit >= 0 ? 'up' : 'down'}`}>
                        <span>{stats?.todayProfit >= 0 ? '↑' : '↓'}</span>
                        <span>{formatCurrency(stats?.todayProfit)} today</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">📈</div>
                    <div className="stat-value">{stats?.totalTrades || 0}</div>
                    <div className="stat-label">Total Trades</div>
                    <div className="stat-change up">
                        <span>↑</span>
                        <span>{stats?.todayTrades || 0} today</span>
                    </div>
                </div>

                <div className="stat-card warning">
                    <div className="stat-icon">⚡</div>
                    <div className="stat-value">{stats?.openTrades || 0}</div>
                    <div className="stat-label">Open Positions</div>
                    <div className="stat-change up">
                        <span>🔄</span>
                        <span>Live</span>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">⚡ Quick Actions</h3>
                        <p className="card-subtitle">Frequently used controls</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <a href="/users" className="btn btn-outline" style={{ textDecoration: 'none' }}>
                        <span>👥</span>
                        <span>Manage Users</span>
                    </a>
                    <a href="/analytics" className="btn btn-outline" style={{ textDecoration: 'none' }}>
                        <span>📈</span>
                        <span>View Analytics</span>
                    </a>
                    <a href="/system" className="btn btn-danger" style={{ textDecoration: 'none' }}>
                        <span>🛑</span>
                        <span>System Control</span>
                    </a>
                </div>
            </div>

            {/* System Status */}
            <div className="card" style={{ marginTop: '24px' }}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">🖥️ System Status</h3>
                        <p className="card-subtitle">Current operating state</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className={`status-dot ${stats?.systemSettings?.global_kill_switch ? 'inactive' : 'active'}`}></div>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: '500' }}>Trading Engine</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                {stats?.systemSettings?.global_kill_switch ? 'Stopped' : 'Operational'}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="status-dot active"></div>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: '500' }}>Database</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Connected</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="status-dot active"></div>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: '500' }}>Admin Panel</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Online</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
