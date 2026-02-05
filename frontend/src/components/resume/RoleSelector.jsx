import React from 'react';
import { Briefcase, Target, ChevronRight } from 'lucide-react';

export function RoleSelector({ roles, selectedRole, onSelect }) {
    return (
        <div className="space-y-6">
            <h3 className="text-sm font-mono font-bold text-neutral-500 uppercase tracking-widest text-center">
                Step 1: Select Target Position
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roles.map((role) => (
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
            </div>

            {!selectedRole && (
                <div className="text-center py-4 bg-surface-base/30 rounded-lg border border-surface-overlay border-dashed">
                    <p className="text-sm text-neutral-500 italic">
                        Please select a role to unlock evidence analysis protocols
                    </p>
                </div>
            )}
        </div>
    );
}
