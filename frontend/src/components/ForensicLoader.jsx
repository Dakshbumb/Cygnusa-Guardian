import { motion } from 'framer-motion';

export const ForensicLoader = ({ size = 48, text = "ANALYZING_BIOMETRICS" }) => {
    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative">
                {/* Outer Ring */}
                <motion.div
                    className="border-2 border-primary-500/30 rounded-full"
                    style={{ width: size, height: size }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                />
                {/* Inner Scanner */}
                <motion.div
                    className="absolute inset-0 border-t-2 border-primary-400 rounded-full"
                    style={{ width: size, height: size }}
                    animate={{ rotate: -360 }}
                    transition={{ duration: 1.5, ease: "linear", repeat: Infinity }}
                />
                {/* Pulse Core */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                        className="bg-primary-500 rounded-full"
                        style={{ width: size / 4, height: size / 4 }}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity }}
                    />
                </div>
            </div>
            {text && (
                <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="text-xs font-mono text-primary-400 tracking-widest uppercase"
                >
                    {text}
                </motion.div>
            )}
        </div>
    );
};
