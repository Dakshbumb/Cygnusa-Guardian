import { useNavigate } from 'react-router-dom';
import { LogOut, Shield } from 'lucide-react';

/**
 * Header - Navigation bar with user info and logout
 * Shows role badge with color coding
 */
export function Header() {
    const navigate = useNavigate();
    const name = localStorage.getItem('name') || 'User';
    const role = localStorage.getItem('role') || 'guest';

    const roleColors = {
        candidate: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
        recruiter: 'bg-purple-900/30 text-purple-400 border-purple-500/30',
        admin: 'bg-red-900/30 text-red-400 border-red-500/30'
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('role');
        localStorage.removeItem('name');
        navigate('/login');
    };

    return (
        <header className="bg-surface-elevated border-b border-surface-overlay px-6 py-4 flex justify-between items-center">
            {/* Logo & Brand */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg flex items-center justify-center border border-primary-500/50 shadow-lg shadow-primary-900/50">
                        <Shield size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-display font-bold text-white">
                            Cygnusa Guardian
                        </h1>
                        <p className="text-xs text-neutral-500">Glass-Box Hiring</p>
                    </div>
                </div>

                {/* Role Badge */}
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${roleColors[role] || 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}>
                    {role?.toUpperCase()}
                </span>

                {/* Dashboard Nav (Recruiters/Admins) */}
                {(role === 'recruiter' || role === 'admin') && (
                    <button
                        onClick={() => navigate('/recruiter/dashboard')}
                        className="ml-4 px-3 py-1 text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-2 font-mono uppercase tracking-widest text-[11px]"
                    >
                        [ COMMAND_CENTER ]
                    </button>
                )}
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center gap-4">
                <span className="text-sm text-neutral-400">
                    👤 {name}
                </span>
                <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-surface-base hover:bg-surface-overlay border border-surface-overlay rounded-lg text-sm font-medium text-neutral-300 hover:text-white transition-colors flex items-center gap-2"
                >
                    <LogOut size={16} />
                    Logout
                </button>
            </div>
        </header>
    );
}

export default Header;
