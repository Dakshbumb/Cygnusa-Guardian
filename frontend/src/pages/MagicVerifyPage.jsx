import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export function MagicVerifyPage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying'); // verifying | success | error
    const [error, setError] = useState('');
    const [name, setName] = useState('');

    useEffect(() => {
        if (!token) { setStatus('error'); setError('No token provided.'); return; }

        const verify = async () => {
            try {
                const res = await api.verifyMagicLink(token);
                const { token: jwt, candidate_id, name: candidateName, email, role } = res.data;

                // Store candidate session
                localStorage.setItem('token', jwt);
                localStorage.setItem('user_id', candidate_id);
                localStorage.setItem('role', role);
                localStorage.setItem('name', candidateName);

                setName(candidateName);
                setStatus('success');

                // Redirect to assessment after short delay
                setTimeout(() => navigate(`/candidate/${candidate_id}`), 2000);
            } catch (err) {
                setStatus('error');
                setError(err?.response?.data?.detail || 'Invalid or expired link. Please contact your recruiter.');
            }
        };

        verify();
    }, [token, navigate]);

    return (
        <div className="min-h-screen bg-[#0d0e12] flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
                {/* Logo */}
                <div className="w-16 h-16 bg-[#ba9eff]/10 border border-[#ba9eff]/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
                    <span className="material-symbols-outlined text-3xl text-[#ba9eff]">shield</span>
                </div>

                {status === 'verifying' && (
                    <div>
                        <div className="w-12 h-12 border-2 border-[#ba9eff] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                        <h1 className="text-2xl font-bold text-white mb-2">Verifying Your Invitation</h1>
                        <p className="text-[#abaab0] text-sm">Authenticating your secure assessment link...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="animate-fade-in-up">
                        <div className="w-20 h-20 bg-[#4ade80]/10 border-2 border-[#4ade80]/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-4xl text-[#4ade80]">verified</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Welcome, {name}!</h1>
                        <p className="text-[#abaab0] text-sm mb-6">Identity verified. Starting your assessment session...</p>
                        <div className="flex items-center justify-center gap-2 text-[#4ade80] text-xs font-label">
                            <div className="w-3 h-3 border border-[#4ade80] border-t-transparent rounded-full animate-spin" />
                            Redirecting to assessment
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="animate-fade-in-up">
                        <div className="w-20 h-20 bg-[#ff6e84]/10 border-2 border-[#ff6e84]/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-4xl text-[#ff6e84]">link_off</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Link Invalid or Expired</h1>
                        <p className="text-[#abaab0] text-sm mb-6">{error}</p>
                        <div className="bg-[#121318] border border-[#ff6e84]/20 rounded-xl p-5 text-left">
                            <p className="text-xs font-label text-[#abaab0] uppercase tracking-widest mb-3">What to do next</p>
                            <ul className="space-y-2 text-sm text-[#abaab0]">
                                <li className="flex items-start gap-2"><span className="material-symbols-outlined text-sm text-[#ba9eff] mt-0.5">arrow_right</span>Contact the recruiter who invited you</li>
                                <li className="flex items-start gap-2"><span className="material-symbols-outlined text-sm text-[#ba9eff] mt-0.5">arrow_right</span>Ask them to send a new invitation link</li>
                                <li className="flex items-start gap-2"><span className="material-symbols-outlined text-sm text-[#ba9eff] mt-0.5">arrow_right</span>Links expire after 72 hours and are single-use only</li>
                            </ul>
                        </div>
                    </div>
                )}

                <p className="mt-10 text-[10px] font-label text-[#47474c] uppercase tracking-widest">
                    Cygnusa Guardian · Secure Assessment Platform
                </p>
            </div>
        </div>
    );
}

export default MagicVerifyPage;
