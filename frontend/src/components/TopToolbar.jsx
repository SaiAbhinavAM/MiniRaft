import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ZoomIn, 
  ZoomOut, 
  Share2, 
  User,
  Maximize2
} from 'lucide-react';

const TopToolbar = ({ boardName, setBoardName, zoom, setZoom, onShare }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  return (
    <motion.div 
      className="top-toolbar"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      <div className="toolbar-left">
        <div className="app-logo">
          <div className="logo-icon">🎨</div>
          <span className="app-name">MiniRaft</span>
        </div>
        
        {isEditing ? (
          <input
            type="text"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
            className="board-name-input"
            autoFocus
          />
        ) : (
          <h2 
            className="board-name"
            onClick={() => setIsEditing(true)}
            title="Click to edit"
          >
            {boardName}
          </h2>
        )}
      </div>

      <div className="toolbar-center">
        <div className="zoom-controls">
          <button 
            onClick={handleZoomOut}
            className="zoom-btn"
            title="Zoom Out (Ctrl -)"
          >
            <ZoomOut size={18} />
          </button>
          
          <span className="zoom-level">{zoom}%</span>
          
          <button 
            onClick={handleZoomIn}
            className="zoom-btn"
            title="Zoom In (Ctrl +)"
          >
            <ZoomIn size={18} />
          </button>
          
          <button 
            onClick={handleResetZoom}
            className="zoom-btn"
            title="Reset Zoom"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div className="toolbar-right">
        <button 
          onClick={onShare}
          className="share-btn"
          title="Share board"
        >
          <Share2 size={18} />
          <span>Share</span>
        </button>
        
        <div className="user-avatar" title="User profile">
          <User size={20} />
        </div>
      </div>
    </motion.div>
  );
};

export default TopToolbar;