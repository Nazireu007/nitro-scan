import { motion } from 'framer-motion';
import { signatureCards } from '../data/mockDiagnostics';

const accentClass = {
  cyan: 'signature-cyan',
  violet: 'signature-violet',
  blue: 'signature-blue',
  green: 'signature-green',
  amber: 'signature-amber',
};

// SignatureCards module: reusable universal fault signatures for the MVP library.
export function SignatureCards() {
  return (
    <motion.section
      className="panel-glass p-4"
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: 'easeOut', delay: 0.2 }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Pattern Library</p>
          <h2 className="panel-title">Universal Signatures</h2>
        </div>
        <span className="text-sm font-semibold text-ion">06 active</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {signatureCards.map((card, index) => {
          const Icon = card.icon;

          return (
            <motion.article
              className={`signature-card ${accentClass[card.accent]}`}
              key={card.name}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.28 + index * 0.05 }}
            >
              <div className="signature-icon">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3>{card.name}</h3>
                <p>{card.description}</p>
              </div>
            </motion.article>
          );
        })}
      </div>
    </motion.section>
  );
}
