import { X, Info, Database, Sparkles } from 'lucide-react';

export default function InfoModal({ isOpen, onClose, title, source, description, stats = [], onExplain = null, children }) {
  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay ia-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--overlay-backdrop)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100000,
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--modal-bg)',
          border: `1px solid var(--modal-border)`,
          borderRadius: '16px',
          width: '90%',
          maxWidth: children ? '900px' : '500px',
          padding: '2rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.15)',
          position: 'relative',
          animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          color: 'var(--modal-text)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'var(--modal-close-bg)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            color: 'var(--modal-close-text)',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--modal-close-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--modal-close-bg)'}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingRight: '2rem' }}>
          <div style={{ 
            background: 'rgba(59, 130, 246, 0.15)', 
            color: '#3b82f6', 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            flexShrink: 0
          }}>
            <Info size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, lineHeight: 1.3, color: 'var(--modal-text)' }}>{title}</h3>
            {source && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.25rem', 
                fontSize: '0.72rem', 
                color: 'var(--modal-text-muted)', 
                marginTop: '0.25rem' 
              }}>
                <Database size={12} />
                <span>Fuente: {source}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ fontSize: '0.88rem', color: 'var(--modal-text-p)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          {description && <p style={{ marginBottom: (stats.length > 0 || children) ? '1.25rem' : 0 }}>{description}</p>}

          {/* Custom structured content */}
          {children}

          {/* Key Indicators / Stats Grid (fallback) */}
          {!children && stats.length > 0 && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.75rem',
              background: 'var(--modal-card-bg)',
              padding: '1rem',
              borderRadius: '12px',
              border: `1px solid var(--modal-card-border)`
            }}>
              {stats.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx < stats.length - 1 ? `1px solid var(--modal-card-border)` : 'none', paddingBottom: idx < stats.length - 1 ? '0.5rem' : 0 }}>
                   <span style={{ color: 'var(--modal-text-muted)', fontWeight: 500 }}>{s.label}</span>
                  <span style={{ fontWeight: 700, color: s.color || 'var(--modal-text)' }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer / Action */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          {onExplain && (
            <button 
              onClick={() => {
                onClose();
                onExplain();
              }}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                padding: '0.5rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'transform 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Sparkles size={14} /> Explicación detallada
            </button>
          )}
          <button 
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              padding: '0.5rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)'
            }}
          >
            Entendido
          </button>
        </div>
      </div>
      
      {/* Styles for Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
