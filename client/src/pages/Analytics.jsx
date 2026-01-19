import { useState, useEffect } from 'react';
import { useAuth } from '../App';

const Analytics = () => {
    const { api } = useAuth();
    const [stats, setStats] = useState(null);
    const [profitHistory, setProfitHistory] = useState([]); // Initialize as empty array
    const [loading, setLoading] = useState(true); // Added loading state
    const [trades, setTrades] = useState([]);
    const [tradePeriod, setTradePeriod] = useState('day'); // 'day', 'week', 'month', 'all', 'custom'
    const [customDates, setCustomDates] = useState({ start: '', end: '' });
    const [loadingTrades, setLoadingTrades] = useState(false);

    // IPO Calculator State
    const [ipoConstant, setIpoConstant] = useState(1);
    const [ipoData, setIpoData] = useState({ score: 0, pointDiff: 0 });

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (tradePeriod !== 'custom') {
            fetchTrades();
        }
    }, [tradePeriod]);

    // Calculate IPO whenever trades or constant changes
    useEffect(() => {
        if (!trades.length) {
            setIpoData({ score: 0, pointDiff: 0 });
            return;
        }

        // Calculate Total Point Difference
        // User definition: Sum of 'points' where points = Entry deviation + Exit deviation
        // Example: "entered in 5 points and exit by 4 points so that means it has 9 points"
        // This maps perfectly to summing the absolute values of entry/exit gaps.

        let totalPointDiff = 0;

        trades.forEach(trade => {
            // Use recorded gaps if available, otherwise estimate from raw prices

            let entryVal = parseFloat(trade.entry_gap) || 0;
            let exitVal = parseFloat(trade.exit_gap) || 0;

            // Fallback: If gap columns are empty, calculate from price difference
            // If we calculate from RAW PRICES, the result will surely be a decimal (e.g. 1.2505 - 1.2500 = 0.0005)
            // So we MUST flag this as a decimal to be converted later.
            let computedFromPrice = false;

            if (entryVal === 0 && trade.hfm_entry_price && trade.equiti_entry_price) {
                entryVal = Math.abs(trade.hfm_entry_price - trade.equiti_entry_price);
                computedFromPrice = true;
            }
            if (exitVal === 0 && trade.hfm_exit_price && trade.equiti_exit_price) {
                exitVal = Math.abs(trade.hfm_exit_price - trade.equiti_exit_price);
                computedFromPrice = true;
            }

            // Determine if we need to convert from Decimals to Points
            // Case A: Calculated from price (0.00005) -> Needs * 100,000 to become 5.0
            // Case B: Stored in DB as Points (5.0) -> No multiplier needed.
            // Case C: Stored in DB as Decimals (0.00005) -> Needs * 100,000.

            // Heuristic: If value is small (< 1), assume it's a decimal price difference.
            // If value is >= 1, assume it's already in Points.
            // If we computedFromPrice, we KNOW it's a decimal.

            const convertEntry = computedFromPrice || entryVal < 0.9;
            const convertExit = computedFromPrice || exitVal < 0.9;

            const finalEntryPoints = convertEntry ? (entryVal * 100000) : entryVal;
            const finalExitPoints = convertExit ? (exitVal * 100000) : exitVal;

            const tradePoints = Math.abs(finalEntryPoints) + Math.abs(finalExitPoints);

            totalPointDiff += tradePoints;
        });

        // Formula: (Number of trades * constant) - (total point sum)
        const score = (trades.length * parseFloat(ipoConstant || 0)) - totalPointDiff;

        setIpoData({
            score,
            pointDiff: totalPointDiff
        });

    }, [trades, ipoConstant]);

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

    const fetchTrades = async () => {
        setLoadingTrades(true);
        try {
            let query = `/analytics/trades?period=${tradePeriod}`;
            if (tradePeriod === 'custom' && customDates.start && customDates.end) {
                query += `&startDate=${customDates.start}&endDate=${customDates.end}`;
            }

            const data = await api(query);
            setTrades(data.trades || []);
        } catch (err) {
            console.error('Failed to fetch trades:', err);
        } finally {
            setLoadingTrades(false);
        }
    };

    const formatCurrency = (value) => {
        const num = parseFloat(value) || 0;
        return num >= 0 ? `+$${num.toFixed(2)}` : `-$${Math.abs(num).toFixed(2)}`;
    };

    const formatPrice = (val) => {
        return val ? parseFloat(val).toFixed(5) : '-';
    };

    const calculateDifference = (exit, entry) => {
        if (!exit || !entry) return '-';
        const diff = parseFloat(exit) - parseFloat(entry);
        return diff.toFixed(5);
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

            {/* IPO Calculator Card */}
            <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(145deg, var(--bg-secondary), var(--bg-primary))', border: '1px solid var(--border-color)' }}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">🚀 IPO Calculator</h3>
                        <p className="card-subtitle">Performance Benchmark: (Trades × X) - Point Diff</p>
                    </div>
                </div>

                <div style={{ padding: '20px 0', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                            Assessment Constant (X)
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={ipoConstant}
                            onChange={(e) => setIpoConstant(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-color)',
                                fontSize: '16px'
                            }}
                        />
                    </div>

                    <div style={{ flex: 1, minWidth: '250px' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Equation Preview:</div>
                        <div style={{ fontSize: '14px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            ({trades.length} trades × {ipoConstant}) - {ipoData.pointDiff.toFixed(2)} pts
                        </div>
                    </div>

                    <div style={{
                        flex: '0 0 auto',
                        background: 'var(--bg-primary)',
                        padding: '15px 25px',
                        borderRadius: '12px',
                        textAlign: 'center',
                        minWidth: '150px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                            IPO Score
                        </div>
                        <div style={{
                            fontSize: '32px',
                            fontWeight: '800',
                            color: ipoData.score >= 0 ? 'var(--primary-color)' : '#ef4444',
                            marginTop: '4px'
                        }}>
                            {ipoData.score.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Trade Analysis */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                        <h3 className="card-title">📋 Trade Analysis</h3>
                        <p className="card-subtitle">Detailed breakdown of trades</p>
                    </div>

                    <div className="filter-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="filter-buttons" style={{ display: 'flex', gap: '8px' }}>
                            {['day', 'week', 'month', 'all'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => { setTradePeriod(p); setCustomDates({ start: '', end: '' }); }}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: tradePeriod === p ? 'var(--primary-color)' : 'transparent',
                                        color: tradePeriod === p ? '#fff' : 'var(--text-color)',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {p}
                                </button>
                            ))}
                            <button
                                onClick={() => setTradePeriod('custom')}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: tradePeriod === 'custom' ? 'var(--primary-color)' : 'transparent',
                                    color: tradePeriod === 'custom' ? '#fff' : 'var(--text-color)',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                Custom
                            </button>
                        </div>

                        {tradePeriod === 'custom' && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    type="date"
                                    value={customDates.start}
                                    onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))}
                                    style={{ padding: '5px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-color)' }}
                                />
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                                <input
                                    type="date"
                                    value={customDates.end}
                                    onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))}
                                    style={{ padding: '5px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-color)' }}
                                />
                                <button
                                    onClick={fetchTrades}
                                    style={{ padding: '5px 10px', borderRadius: '4px', background: 'var(--success)', border: 'none', color: '#fff', cursor: 'pointer' }}
                                >
                                    Go
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '12px' }}>Time</th>
                                <th style={{ padding: '12px' }}>User</th>
                                <th style={{ padding: '12px' }}>Pair</th>
                                <th style={{ padding: '12px' }}>Type</th>
                                <th style={{ padding: '12px' }}>HFM (In/Out)</th>
                                <th style={{ padding: '12px' }}>Equiti (In/Out)</th>
                                <th style={{ padding: '12px' }}>Gaps (Entry/Exit)</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingTrades ? (
                                <tr>
                                    <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Loading trades...
                                    </td>
                                </tr>
                            ) : trades.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No trades found for this period
                                    </td>
                                </tr>
                            ) : (
                                trades.map(trade => {
                                    // Calculate gaps for display if DB fields are empty
                                    let entryGap = trade.entry_gap;
                                    if (!entryGap && trade.hfm_entry_price && trade.equiti_entry_price) {
                                        entryGap = Math.abs(parseFloat(trade.hfm_entry_price) - parseFloat(trade.equiti_entry_price)).toFixed(5);
                                    }

                                    let exitGap = trade.exit_gap;
                                    if (!exitGap && trade.hfm_exit_price && trade.equiti_exit_price) {
                                        exitGap = Math.abs(parseFloat(trade.hfm_exit_price) - parseFloat(trade.equiti_exit_price)).toFixed(5);
                                    }

                                    return (
                                        <tr key={trade.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}>
                                            <td style={{ padding: '12px' }}>
                                                {new Date(trade.entry_time).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '12px', fontWeight: '500' }}>{trade.username}</td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{
                                                    display: 'block',
                                                    fontSize: '11px',
                                                    color: 'var(--text-muted)'
                                                }}>
                                                    {trade.hfm_symbol || 'N/A'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: trade.opportunity_type?.includes('BUY') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                    color: trade.opportunity_type?.includes('BUY') ? '#10b981' : '#ef4444',
                                                    fontSize: '11px',
                                                    fontWeight: '600'
                                                }}>
                                                    {trade.opportunity_type || 'N/A'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                                                    <span>In: {formatPrice(trade.hfm_entry_price)}</span>
                                                    <span>Out: {formatPrice(trade.hfm_exit_price)}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                                                    <span>In: {formatPrice(trade.equiti_entry_price)}</span>
                                                    <span>Out: {formatPrice(trade.equiti_exit_price)}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                                                    <span title="Entry Gap: |HFM In - Equiti In|">Entry: {entryGap ? parseFloat(entryGap).toFixed(5) : '-'}</span>
                                                    <span title="Exit Gap: |HFM Out - Equiti Out|">Exit: {exitGap ? parseFloat(exitGap).toFixed(5) : '-'}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: trade.net_profit >= 0 ? '#10b981' : '#ef4444' }}>
                                                {formatCurrency(trade.net_profit)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
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
