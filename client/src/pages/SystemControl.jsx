import { useState, useEffect } from 'react';
import { useAuth } from '../App';

const SystemControl = () => {
    const { api } = useAuth();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [blockedTimes, setBlockedTimes] = useState([]);
    const [newBlockedTime, setNewBlockedTime] = useState({ start: '', end: '', reason: '' });
    const [killSwitchConfirm, setKillSwitchConfirm] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const data = await api('/system/settings');
            setSettings(data.settings);

            // Parse blocked times
            try {
                const times = JSON.parse(data.settings?.blocked_times || '[]');
                setBlockedTimes(Array.isArray(times) ? times : []);
            } catch {
                setBlockedTimes([]);
            }
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleKillSwitch = async () => {
        const newState = !settings.global_kill_switch;

        if (newState && !killSwitchConfirm) {
            // First click - ask for confirmation
            setKillSwitchConfirm(true);
            return;
        }

        try {
            await api('/system/kill-switch', {
                method: 'POST',
                body: JSON.stringify({ enabled: newState })
            });
            setSettings({ ...settings, global_kill_switch: newState });
            setKillSwitchConfirm(false);
        } catch (err) {
            console.error('Failed to toggle kill switch:', err);
        }
    };

    const addBlockedTime = async () => {
        if (!newBlockedTime.start || !newBlockedTime.end) {
            alert('Please enter start and end times');
            return;
        }

        const updatedTimes = [...blockedTimes, {
            id: Date.now(),
            start: newBlockedTime.start,
            end: newBlockedTime.end,
            reason: newBlockedTime.reason || 'News Event'
        }];

        try {
            await api('/system/blocked-times', {
                method: 'POST',
                body: JSON.stringify({ blockedTimes: updatedTimes })
            });
            setBlockedTimes(updatedTimes);
            setNewBlockedTime({ start: '', end: '', reason: '' });
        } catch (err) {
            console.error('Failed to add blocked time:', err);
        }
    };

    const removeBlockedTime = async (id) => {
        const updatedTimes = blockedTimes.filter(t => t.id !== id);

        try {
            await api('/system/blocked-times', {
                method: 'POST',
                body: JSON.stringify({ blockedTimes: updatedTimes })
            });
            setBlockedTimes(updatedTimes);
        } catch (err) {
            console.error('Failed to remove blocked time:', err);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Loading system controls...</p>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">⚡ System Control</h1>
                <p className="page-subtitle">Global controls affecting all users</p>
            </div>

            {/* Kill Switch Section */}
            <div className={`kill-switch-container ${settings?.global_kill_switch ? 'active' : ''}`} style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
                    🛑 Global Kill Switch
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
                    Emergency stop that immediately halts all trading operations across all users
                </p>

                <button
                    className={`kill-switch-btn ${settings?.global_kill_switch ? 'active' : ''}`}
                    onClick={toggleKillSwitch}
                >
                    <span className="kill-switch-icon">
                        {settings?.global_kill_switch ? '🔴' : '⚪'}
                    </span>
                    <span>
                        {killSwitchConfirm
                            ? 'CONFIRM'
                            : settings?.global_kill_switch
                                ? 'ACTIVE'
                                : 'ARMED'
                        }
                    </span>
                </button>

                <p className="kill-switch-label">
                    {killSwitchConfirm
                        ? '⚠️ Click again to confirm activation'
                        : settings?.global_kill_switch
                            ? '🔴 All bots are currently STOPPED'
                            : '🟢 Trading operations are NORMAL'
                    }
                </p>

                {killSwitchConfirm && (
                    <button
                        className="btn btn-outline"
                        style={{ marginTop: '16px' }}
                        onClick={() => setKillSwitchConfirm(false)}
                    >
                        Cancel
                    </button>
                )}
            </div>

            {/* Blocked Times Section */}
            <div className="card">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">⏰ Global Blocked Times</h3>
                        <p className="card-subtitle">Pause all trading during high-impact news events</p>
                    </div>
                </div>

                {/* Add New Blocked Time */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px',
                    padding: '20px',
                    background: 'var(--bg-glass)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)'
                }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Start Time</label>
                        <input
                            type="time"
                            className="form-input"
                            value={newBlockedTime.start}
                            onChange={(e) => setNewBlockedTime({ ...newBlockedTime, start: e.target.value })}
                        />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">End Time</label>
                        <input
                            type="time"
                            className="form-input"
                            value={newBlockedTime.end}
                            onChange={(e) => setNewBlockedTime({ ...newBlockedTime, end: e.target.value })}
                        />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Reason</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g., NFP Release"
                            value={newBlockedTime.reason}
                            onChange={(e) => setNewBlockedTime({ ...newBlockedTime, reason: e.target.value })}
                        />
                    </div>

                    <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={addBlockedTime} style={{ width: '100%' }}>
                            ➕ Add Time
                        </button>
                    </div>
                </div>

                {/* Blocked Times List */}
                {blockedTimes.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                        <div className="empty-icon">🕐</div>
                        <h3 className="empty-title">No blocked times</h3>
                        <p className="empty-text">All trading hours are currently active</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {blockedTimes.map((time) => (
                            <div
                                key={time.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '16px 20px',
                                    background: 'rgba(245, 158, 11, 0.1)',
                                    border: '1px solid rgba(245, 158, 11, 0.2)',
                                    borderRadius: 'var(--radius-md)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <span style={{ fontSize: '24px' }}>⏸️</span>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '15px' }}>
                                            {time.start} - {time.end}
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                            {time.reason}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-sm btn-outline"
                                    onClick={() => removeBlockedTime(time.id)}
                                    style={{ color: 'var(--danger)' }}
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* System Info */}
            <div className="card" style={{ marginTop: '24px' }}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">ℹ️ System Information</h3>
                        <p className="card-subtitle">Technical details</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Last Updated
                        </div>
                        <div style={{ fontWeight: '500' }}>
                            {settings?.updated_at
                                ? new Date(settings.updated_at).toLocaleString()
                                : 'Never'
                            }
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Kill Switch Status
                        </div>
                        <div style={{ fontWeight: '500', color: settings?.global_kill_switch ? 'var(--danger)' : 'var(--success)' }}>
                            {settings?.global_kill_switch ? 'ACTIVE (All Stopped)' : 'INACTIVE (Normal)'}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Blocked Periods
                        </div>
                        <div style={{ fontWeight: '500' }}>
                            {blockedTimes.length} configured
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemControl;
