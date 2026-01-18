import { useState, useEffect } from 'react';
import { useAuth } from '../App';

const Analytics = () => {
    const { api } = useAuth();
    const [stats, setStats] = useState(null);
    const [profitHistory, setProfitHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [statsData, historyData] = await Promise.all([
                api('/analytics/overview'),
                api('/analytics/profit-history')
            ]);
            setStats(statsData);
            setProfitHistory(historyData.history || []);
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        const num = parseFloat(value) || 0;
        return num >= 0 ? `+$${num.toFixed(2)}` : `-$${Math.abs(num).toFixed(2)}`;
    };

    // Calculate max profit for chart scaling
    const maxProfit = Math.max(...profitHistory.map(d => Math.abs(parseFloat(d.profit) || 0)), 1);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Loading analytics...</p>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📈 Global Analytics</h1>
                <p className="page-subtitle">Aggregate performance across all users</p>
            </div>

            {/* Summary Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-value">{stats?.totalUsers || 0}</div>
                    <div className="stat-label">Total Users</div>
                </div>

                <div className="stat-card success">
                    <div className="stat-icon">💰</div>
                    <div className={`stat-value ${(stats?.totalProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(stats?.totalProfit)}
                    </div>
                    <div className="stat-label">Total Net Profit</div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-value">{stats?.totalTrades || 0}</div>
                    <div className="stat-label">Total Trades</div>
                </div>

                <div className="stat-card warning">
                    <div className="stat-icon">🔥</div>
                    <div className="stat-value">{stats?.todayTrades || 0}</div>
                    <div className="stat-label">Today's Trades</div>
                </div>
            </div>

            {/* Profit Chart */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">💹 30-Day Profit History</h3>
                        <p className="card-subtitle">Daily net profit across all users</p>
                    </div>
                </div>

                {profitHistory.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📉</div>
                        <h3 className="empty-title">No data yet</h3>
                        <p className="empty-text">Trade history will appear once trades are executed</p>
                    </div>
                ) : (
                    <div style={{ padding: '20px 0' }}>
                        {/* Simple Bar Chart */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: '4px',
                            height: '200px',
                            padding: '0 10px',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            {profitHistory.map((day, index) => {
                                const profit = parseFloat(day.profit) || 0;
                                const height = Math.abs(profit) / maxProfit * 150;
                                const isPositive = profit >= 0;

                                return (
                                    <div
                                        key={index}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end'
                                        }}
                                        title={`${day.date}: ${formatCurrency(profit)} (${day.trades} trades)`}
                                    >
                                        <div
                                            style={{
                                                width: '100%',
                                                maxWidth: '30px',
                                                height: `${Math.max(height, 4)}px`,
                                                background: isPositive
                                                    ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)'
                                                    : 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
                                                borderRadius: '4px 4px 0 0',
                                                transition: 'all 0.3s ease',
                                                cursor: 'pointer'
                                            }}
                                            onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                                            onMouseLeave={(e) => e.target.style.opacity = '1'}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* X-axis labels */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 10px 0',
                            fontSize: '11px',
                            color: 'var(--text-muted)'
                        }}>
                            <span>{profitHistory[0]?.date}</span>
                            <span>{profitHistory[profitHistory.length - 1]?.date}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Performance Metrics */}
            <div className="card">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">📊 Performance Metrics</h3>
                        <p className="card-subtitle">Key indicators</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Avg Profit/Trade
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '700' }}>
                            {stats?.totalTrades > 0
                                ? formatCurrency((stats?.totalProfit || 0) / stats.totalTrades)
                                : '$0.00'
                            }
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Active Users Rate
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '700' }}>
                            {stats?.totalUsers > 0
                                ? `${Math.round((stats?.activeUsers / stats.totalUsers) * 100)}%`
                                : '0%'
                            }
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Today's Performance
                        </div>
                        <div style={{
                            fontSize: '24px',
                            fontWeight: '700',
                            color: (stats?.todayProfit || 0) >= 0 ? 'var(--success)' : 'var(--danger)'
                        }}>
                            {formatCurrency(stats?.todayProfit)}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Open Positions
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--warning)' }}>
                            {stats?.openTrades || 0}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
