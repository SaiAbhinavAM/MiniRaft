import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, GripHorizontal } from 'lucide-react';

const STICKY_COLORS = [
  { name: 'yellow', bg: '#FFF9C4', border: '#F9E547', header: '#F9E547' },
  { name: 'pink',   bg: '#FCE4EC', border: '#F48FB1', header: '#F48FB1' },
  { name: 'blue',   bg: '#E3F2FD', border: '#64B5F6', header: '#64B5F6' },
  { name: 'green',  bg: '#E8F5E9', border: '#81C784', header: '#81C784' },
  { name: 'orange', bg: '#FFF3E0', border: '#FFB74D', header: '#FFB74D' },
  { name: 'purple', bg: '#F3E5F5', border: '#CE93D8', header: '#CE93D8' },
];

const StickyNote = ({ note, onUpdate, onDelete, isSelected, onSelect }) => {
  const noteRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, noteX: 0, noteY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const colorObj = STICKY_COLORS.find(c => c.name === note.color) || STICKY_COLORS[0];

  // ── Drag ──────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(note.id);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      noteX: note.x,
      noteY: note.y,
    };
  }, [note.id, note.x, note.y, onSelect]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      onUpdate(note.id, {
        x: dragStartRef.current.noteX + dx,
        y: dragStartRef.current.noteY + dy,
      });
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [isDragging, note.id, onUpdate]);

  // ── Resize ────────────────────────────────────────────────────────
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: note.width,
      h: note.height,
    };
  }, [note.width, note.height]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e) => {
      const dx = e.clientX - resizeStartRef.current.x;
      const dy = e.clientY - resizeStartRef.current.y;
      onUpdate(note.id, {
        width: Math.max(140, resizeStartRef.current.w + dx),
        height: Math.max(100, resizeStartRef.current.h + dy),
      });
    };
    const handleUp = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [isResizing, note.id, onUpdate]);

  // ── Color change ──────────────────────────────────────────────────
  const handleColorChange = useCallback((colorName) => {
    onUpdate(note.id, { color: colorName });
    setShowColorPicker(false);
  }, [note.id, onUpdate]);

  return (
    <motion.div
      ref={noteRef}
      className={`sticky-note ${isSelected ? 'sticky-note--selected' : ''}`}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        position: 'absolute',
        left: note.x,
        top: note.y,
        width: note.width,
        height: note.height,
        backgroundColor: colorObj.bg,
        border: `2px solid ${colorObj.border}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: isSelected ? 2000 : 500,
        boxShadow: isSelected
          ? '0 8px 30px rgba(0,0,0,0.18)'
          : '0 3px 12px rgba(0,0,0,0.10)',
        userSelect: isDragging || isResizing ? 'none' : 'auto',
        transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(note.id); }}
    >
      {/* Header / drag handle */}
      <div
        className="sticky-note__header"
        style={{
          background: colorObj.header,
          padding: '4px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'grab',
          minHeight: 28,
        }}
        onMouseDown={handleDragStart}
      >
        <GripHorizontal size={14} style={{ opacity: 0.6 }} />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Color picker toggle */}
          <button
            className="sticky-note__icon-btn"
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(p => !p); }}
            title="Change color"
          >
            <span style={{
              display: 'inline-block', width: 14, height: 14,
              borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)',
              background: `conic-gradient(#FFF9C4, #FCE4EC, #E3F2FD, #E8F5E9, #FFF3E0, #F3E5F5, #FFF9C4)`,
            }} />
          </button>
          {/* Delete */}
          <button
            className="sticky-note__icon-btn"
            onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
            title="Delete note"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Color picker dropdown */}
      {showColorPicker && (
        <div className="sticky-note__color-picker">
          {STICKY_COLORS.map(c => (
            <button
              key={c.name}
              className={`sticky-note__color-swatch ${note.color === c.name ? 'active' : ''}`}
              style={{ backgroundColor: c.bg, borderColor: c.border }}
              onClick={(e) => { e.stopPropagation(); handleColorChange(c.name); }}
              title={c.name}
            />
          ))}
        </div>
      )}

      {/* Body – editable text */}
      <div
        className="sticky-note__body"
        style={{ flex: 1, padding: '8px 10px', overflow: 'auto' }}
        onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      >
        {isEditing ? (
          <textarea
            className="sticky-note__textarea"
            value={note.text}
            onChange={(e) => onUpdate(note.id, { text: e.target.value })}
            onBlur={() => setIsEditing(false)}
            autoFocus
            style={{
              width: '100%', height: '100%',
              border: 'none', outline: 'none', resize: 'none',
              background: 'transparent',
              fontFamily: "'Segoe UI', sans-serif",
              fontSize: 14, lineHeight: 1.5,
              color: '#333',
            }}
          />
        ) : (
          <div style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontFamily: "'Segoe UI', sans-serif",
            fontSize: 14, lineHeight: 1.5,
            color: '#333', minHeight: '100%', cursor: 'text',
          }}>
            {note.text || 'Double-click to edit…'}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="sticky-note__resize-handle"
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute', right: 0, bottom: 0,
          width: 18, height: 18,
          cursor: 'nwse-resize',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.4 }}>
          <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </motion.div>
  );
};

export { STICKY_COLORS };
export default StickyNote;
