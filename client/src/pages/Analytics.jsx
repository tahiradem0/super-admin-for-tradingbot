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
    const [ipoData, setIpoData] = useState({
        score: 0,
        totalLotGapProduct: 0,
        totalLots: 0,
        validTrades: 0,
        skippedTrades: 0
    });
    const [failedTrades, setFailedTrades] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (tradePeriod !== 'custom') {
            fetchTrades();
        }
    }, [tradePeriod]);

    // Calculate IPO whenever trades or constant changes
    // NEW FORMULA: Total IPO = Σ(lot_size × points/gap) - (Total Lots × X)
    // Only include valid trade pairs (both HFM and Equiti executed successfully)
    useEffect(() => {
        if (!trades.length) {
            setIpoData({
                score: 0,
                totalLotGapProduct: 0,
                totalLots: 0,
                validTrades: 0,
                skippedTrades: 0
            });
            return;
        }

        let totalLotGapProduct = 0;  // Σ(lot_size × points)
        let totalLots = 0;
        let validTrades = 0;
        let skippedTrades = 0;
        let currentFailedTrades = [];

        trades.forEach(trade => {
            // VALIDATION: Check if trade is a valid pair (both HFM and Equiti executed)
            // A valid trade must have both broker entry prices
            const hasHfmEntry = trade.hfm_entry_price && parseFloat(trade.hfm_entry_price) > 0;
            const hasEquitiEntry = trade.equiti_entry_price && parseFloat(trade.equiti_entry_price) > 0;

            // Skip if this is an incomplete/failed pair (only 1 trade executed instead of 2)
            if (!hasHfmEntry || !hasEquitiEntry) {
                skippedTrades++;
                currentFailedTrades.push(trade);
                return; // Skip this trade - it's not a valid pair
            }

            const lotSize = parseFloat(trade.lot_size) || 0;
            if (lotSize === 0) {
                skippedTrades++;
                return; // Skip trades with no lot size
            }

            // Calculate points/gap for this trade
            let entryVal = parseFloat(trade.entry_gap) || 0;
            let exitVal = parseFloat(trade.exit_gap) || 0;

            // Fallback: If gap columns are empty, calculate from price difference
            let computedFromPrice = false;

            if (entryVal === 0 && hasHfmEntry && hasEquitiEntry) {
                entryVal = Math.abs(parseFloat(trade.hfm_entry_price) - parseFloat(trade.equiti_entry_price));
                computedFromPrice = true;
            }
            if (exitVal === 0 && trade.hfm_exit_price && trade.equiti_exit_price) {
                exitVal = Math.abs(parseFloat(trade.hfm_exit_price) - parseFloat(trade.equiti_exit_price));
                computedFromPrice = true;
            }

            // Convert to Points if value is in decimal format
            // Heuristic: If value is small (< 1), it's a decimal price difference
            const convertEntry = computedFromPrice || entryVal < 0.9;
            const convertExit = computedFromPrice || exitVal < 0.9;

            const finalEntryPoints = convertEntry ? (entryVal * 100000) : entryVal;
            const finalExitPoints = convertExit ? (exitVal * 100000) : exitVal;

            // Total points/gap for this trade = entry gap + exit gap
            const tradePoints = Math.abs(finalEntryPoints) + Math.abs(finalExitPoints);

            // Add to totals
            totalLotGapProduct += (lotSize * tradePoints);  // lot_size × points
            totalLots += lotSize;
            validTrades++;
        });

        // NEW FORMULA: Total IPO = Σ(lot_size × points) - (Total Lots × X)
        const score = totalLotGapProduct - (totalLots * parseFloat(ipoConstant || 0));

        setIpoData({
            score,
            totalLotGapProduct,
            totalLots,
            validTrades,
            skippedTrades
        });

        setFailedTrades(currentFailedTrades);

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
                        <p className="card-subtitle">Performance Benchmark: Σ(Lots × Points) - (Total Lots × X)</p>
                    </div>
                </div>

                <div style={{ padding: '20px 0' }}>
                    {/* Input and Formula Row */}
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '20px' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                Constant (X) - Points per Lot
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

                        <div style={{ flex: 2, minWidth: '300px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Equation Preview:</div>
                            <div style={{ fontSize: '14px', fontFamily: 'monospace', color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div style={{ marginBottom: '4px' }}>
                                    <span style={{ color: 'var(--primary-color)' }}>{ipoData.totalLotGapProduct.toFixed(2)}</span>
                                    <span> - </span>
                                    <span>({ipoData.totalLots.toFixed(2)} lots × {ipoConstant})</span>
                                </div>
                                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                                    = {ipoData.totalLotGapProduct.toFixed(2)} - {(ipoData.totalLots * parseFloat(ipoConstant || 0)).toFixed(2)} = <strong style={{ color: ipoData.score >= 0 ? 'var(--success)' : '#ef4444' }}>{ipoData.score.toFixed(2)}</strong>
                                </div>
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

                    {/* Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px', padding: '16px', background: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Valid Pairs</div>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--success)' }}>{ipoData.validTrades}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Skipped (Incomplete)</div>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: ipoData.skippedTrades > 0 ? '#ef4444' : 'var(--text-color)' }}>{ipoData.skippedTrades}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Lots</div>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--primary-color)' }}>{ipoData.totalLots.toFixed(2)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Σ(Lot × Points)</div>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--warning)' }}>{ipoData.totalLotGapProduct.toFixed(2)}</div>
                        </div>
                    </div>

                    {/* Info Note */}
                    {ipoData.skippedTrades > 0 && (
                        <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', fontSize: '12px', color: '#ef4444' }}>
                            ⚠️ {ipoData.skippedTrades} trade(s) excluded - incomplete pairs (only 1 of 2 trades executed)
                        </div>
                    )}
                </div>
            </div>

            {/* Failed Trades Report - ONLY ONE BROKER EXECUTED */}
            {failedTrades.length > 0 && (
                <div className="card" style={{ marginBottom: '24px', border: '1px solid #ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                    <div className="card-header">
                        <div>
                            <h3 className="card-title" style={{ color: '#ef4444' }}>⚠️ Failed / Incomplete Trades</h3>
                            <p className="card-subtitle" style={{ color: '#f87171' }}>Trades excluding from IPO (One broker failed to execute)</p>
                        </div>
                    </div>
                    <div className="table-container" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #ef4444', textAlign: 'left', fontSize: '12px', color: '#ef4444' }}>
                                    <th style={{ padding: '12px' }}>Time</th>
                                    <th style={{ padding: '12px' }}>User</th>
                                    <th style={{ padding: '12px' }}>Type</th>
                                    <th style={{ padding: '12px' }}>HFM Execution</th>
                                    <th style={{ padding: '12px' }}>Equiti Execution</th>
                                    <th style={{ padding: '12px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {failedTrades.map(trade => {
                                    const hasHfm = trade.hfm_entry_price && parseFloat(trade.hfm_entry_price) > 0;
                                    const hasEquiti = trade.equiti_entry_price && parseFloat(trade.equiti_entry_price) > 0;
                                    return (
                                        <tr key={trade.id} style={{ borderBottom: '1px solid #fecaca', fontSize: '13px', background: 'rgba(239, 68, 68, 0.05)' }}>
                                            <td style={{ padding: '12px', color: '#b91c1c' }}>{new Date(trade.entry_time).toLocaleString()}</td>
                                            <td style={{ padding: '12px', color: '#b91c1c', fontWeight: '500' }}>{trade.username}</td>
                                            <td style={{ padding: '12px', color: '#b91c1c' }}>{trade.opportunity_type}</td>
                                            <td style={{ padding: '12px' }}>
                                                {hasHfm ?
                                                    <span style={{ color: '#15803d', fontWeight: '600' }}>✅ {formatPrice(trade.hfm_entry_price)}</span> :
                                                    <span style={{ color: '#ef4444', fontWeight: '800' }}>❌ FAILED</span>
                                                }
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {hasEquiti ?
                                                    <span style={{ color: '#15803d', fontWeight: '600' }}>✅ {formatPrice(trade.equiti_entry_price)}</span> :
                                                    <span style={{ color: '#ef4444', fontWeight: '800' }}>❌ FAILED</span>
                                                }
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>
                                                    INVALID PAIR
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

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
