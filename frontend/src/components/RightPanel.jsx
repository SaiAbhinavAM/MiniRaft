import React from 'react';
import { motion } from 'framer-motion';
import { X, Palette, Type, Square, Circle } from 'lucide-react';

const RightPanel = ({ activeTool, strokeColor, setStrokeColor, strokeWidth, setStrokeWidth, onClose }) => {
  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500',
    '#800080', '#FFC0CB', '#A52A2A', '#808080'
  ];

  const strokeWidths = [1, 2, 4, 6, 8, 10, 12, 16];

  const renderToolSettings = () => {
    switch (activeTool) {
      case 'pen':
      case 'eraser':
        return (
          <div className="tool-settings">
            <div className="setting-group">
              <label className="setting-label">
                <Palette size={16} />
                Color
              </label>
              <div className="color-palette">
                {colors.map((color) => (
                  <button
                    key={color}
                    className={`color-btn ${strokeColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setStrokeColor(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">Stroke Width</label>
              <div className="stroke-widths">
                {strokeWidths.map((width) => (
                  <button
                    key={width}
                    className={`stroke-btn ${strokeWidth === width ? 'active' : ''}`}
                    onClick={() => setStrokeWidth(width)}
                    title={`${width}px`}
                  >
                    <div 
                      className="stroke-preview"
                      style={{ height: `${width * 2}px` }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="tool-settings">
            <div className="setting-group">
              <label className="setting-label">
                <Type size={16} />
                Text Settings
              </label>
              <div className="text-options">
                <select className="font-select">
                  <option>Arial</option>
                  <option>Times New Roman</option>
                  <option>Helvetica</option>
                  <option>Georgia</option>
                </select>
                <select className="font-size-select">
                  <option>12px</option>
                  <option>16px</option>
                  <option>20px</option>
                  <option>24px</option>
                  <option>32px</option>
                  <option>48px</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'rectangle':
      case 'circle':
      case 'triangle':
        return (
          <div className="tool-settings">
            <div className="setting-group">
              <label className="setting-label">
                <Square size={16} />
                Shape Settings
              </label>
              <div className="shape-options">
                <div className="shape-style">
                  <label>
                    <input type="radio" name="fill" defaultChecked />
                    Fill
                  </label>
                  <label>
                    <input type="radio" name="fill" />
                    Outline
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="tool-settings">
            <p className="no-settings">No settings available for this tool</p>
          </div>
        );
    }
  };

  return (
    <motion.div 
      className="right-panel"
      initial={{ x: 300 }}
      animate={{ x: 0 }}
      exit={{ x: 300 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      <div className="panel-header">
        <h3 className="panel-title">Tool Settings</h3>
        <button 
          className="close-btn"
          onClick={onClose}
          title="Close panel"
        >
          <X size={18} />
        </button>
      </div>

      <div className="panel-content">
        {renderToolSettings()}
      </div>
    </motion.div>
  );
};

export default RightPanel;
