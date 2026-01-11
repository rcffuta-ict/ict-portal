export function Badge({ text, icon }: { text: string; icon: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 backdrop-blur-md transition-colors hover:bg-white/10 hover:border-rcf-gold/50">
            <span className="opacity-70">{icon}</span>
            {text}
        </span>
    );
}
