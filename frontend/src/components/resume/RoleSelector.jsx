import React, { useState } from 'react';
import { Briefcase, Target, Search, XCircle } from 'lucide-react';

export function RoleSelector({ roles, selectedRole, onSelect }) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRoles = roles.filter(role =>
        role.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.required_skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="text-center space-y-4">
                <h3 className="text-sm font-mono font-bold text-neutral-500 uppercase tracking-widest">
                    Step 1: Select Target Position
                </h3>

                {/* Search Bar */}
                <div className="relative max-w-md mx-auto group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-primary-500 transition-colors">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search roles or skills (e.g. 'Finance', 'Python')..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-surface-base border border-surface-overlay text-white py-2.5 pl-10 pr-4 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition-all font-sans text-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredRoles.map((role) => (
                    <button
                        key={role.id}
                        onClick={() => onSelect(role)}
                        className={`group relative p-6 rounded-xl border-2 transition-all text-left flex items-center justify-between overflow-hidden ${selectedRole?.id === role.id
                            ? 'border-primary-500 bg-primary-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                            : 'border-surface-overlay bg-surface-elevated/50 hover:border-primary-500/50 hover:bg-surface-elevated'
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-lg transition-colors ${selectedRole?.id === role.id ? 'bg-primary-500 text-white' : 'bg-surface-base text-neutral-500 group-hover:text-primary-400'
                                }`}>
                                <Briefcase size={20} />
                            </div>
                            <div>
                                <h4 className="font-display font-bold text-white tracking-tight">{role.title}</h4>
                                <p className="text-xs text-neutral-500 font-mono">
                                    {role.required_skills.length} Required Skills
                                </p>
                            </div>
                        </div>

                        <div className={`transition-all duration-300 ${selectedRole?.id === role.id ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                            }`}>
                            <Target className="text-primary-500" size={20} />
                        </div>

                        {/* Decoration line */}
                        {selectedRole?.id === role.id && (
                            <div className="absolute bottom-0 left-0 h-1 bg-primary-500 w-full" />
                        )}
                    </button>
                ))}

                {filteredRoles.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-surface-base/20 border border-surface-overlay border-dashed rounded-xl">
                        <XCircle className="mx-auto text-neutral-600 mb-2" size={32} />
                        <p className="text-neutral-400">No positions found matching "{searchQuery}"</p>
                    </div>
                )}
            </div>

            {!selectedRole && filteredRoles.length > 0 && (
                <div className="text-center py-4 bg-surface-base/30 rounded-lg border border-surface-overlay border-dashed">
                    <p className="text-sm text-neutral-500 italic">
                        Please select a role to unlock evidence analysis protocols
                    </p>
                </div>
            )}
        </div>
    );
}
