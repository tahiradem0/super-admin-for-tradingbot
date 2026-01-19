import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';

const Dashboard = () => {
    const { api } = useAuth();
    const [stats, setStats] = useState(null);
    const [activeBots, setActiveBots] = useState([]);
    const [livePnL, setLivePnL] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 5000); // Refresh every 5s
        return () => clearInterval(interval);
    }, []);

    const fetchAll = async () => {
        try {
            const [statsData, botsData, pnlData] = await Promise.all([
                api('/analytics/overview'),
                api('/analytics/active-bots'),
                api('/analytics/live-pnl')
            ]);
            setStats(statsData);
            setActiveBots(botsData.activeBots || []);
            setLivePnL(pnlData.trades || []);
        } catch (err) {
            console.error('Failed to fetch data:', err);
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
                    <Link to="/users" className="btn btn-outline" style={{ textDecoration: 'none' }}>
                        <span>👥</span>
                        <span>Manage Users</span>
                    </Link>
                    <Link to="/analytics" className="btn btn-outline" style={{ textDecoration: 'none' }}>
                        <span>📈</span>
                        <span>View Analytics</span>
                    </Link>
                    <Link to="/system" className="btn btn-danger" style={{ textDecoration: 'none' }}>
                        <span>🛑</span>
                        <span>System Control</span>
                    </Link>
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

            {/* Active Bots Grid */}
            <div className="card" style={{ marginTop: '24px' }}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">🤖 Active Bots ({activeBots.length})</h3>
                        <p className="card-subtitle">Live view of currently open trades</p>
                    </div>
                    <div className="status-dot active" style={{ animation: 'pulse 2s infinite' }}></div>
                </div>

                {activeBots.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <span style={{ fontSize: '48px' }}>😴</span>
                        <p style={{ marginTop: '12px' }}>No active trades right now</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {activeBots.map((bot, idx) => (
                            <div key={idx} style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                borderRadius: '12px',
                                padding: '16px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <span style={{ fontWeight: '600' }}>{bot.username || bot.email}</span>
                                    <span className={`status-badge ${bot.opportunity_type?.toLowerCase()}`}>
                                        {bot.opportunity_type}
                                    </span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    <div>Lot: <strong>{bot.lot_size}</strong></div>
                                    <div>Entry Gap: <strong>{bot.entry_gap} pts</strong></div>
                                    <div>Started: {new Date(bot.entry_time).toLocaleTimeString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Live PnL Ticker */}
            <div className="card" style={{ marginTop: '24px' }}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">💰 Live Profit Feed</h3>
                        <p className="card-subtitle">Recent completed trades across all users</p>
                    </div>
                </div>

                {livePnL.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <span style={{ fontSize: '48px' }}>📊</span>
                        <p style={{ marginTop: '12px' }}>No completed trades yet</p>
                    </div>
                ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {livePnL.map((trade, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--border-color)',
                                animation: idx === 0 ? 'fadeIn 0.5s' : 'none'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '20px' }}>
                                        {parseFloat(trade.net_profit) >= 0 ? '🟢' : '🔴'}
                                    </span>
                                    <div>
                                        <div style={{ fontWeight: '500' }}>{trade.username || trade.email}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {trade.opportunity_type} • {trade.lot_size} lots • {Math.round(trade.hold_duration)}s
                                        </div>
                                    </div>
                                </div>
                                <div style={{
                                    fontWeight: '700',
                                    fontSize: '18px',
                                    color: parseFloat(trade.net_profit) >= 0 ? 'var(--success)' : 'var(--danger)'
                                }}>
                                    {parseFloat(trade.net_profit) >= 0 ? '+' : ''}${parseFloat(trade.net_profit).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
