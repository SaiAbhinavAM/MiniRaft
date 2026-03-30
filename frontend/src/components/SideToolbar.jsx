import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';

const SideToolbar = ({ tools, activeTool, onToolChange }) => {
  const [showShapesDropdown, setShowShapesDropdown] = useState(false);

  const getIcon = (iconName) => {
    const IconComponent = Icons[iconName];
    return IconComponent ? <IconComponent size={20} /> : null;
  };

  const handleToolClick = (tool) => {
    if (tool.id === 'shapes') {
      setShowShapesDropdown((prev) => !prev);
    } else {
      setShowShapesDropdown(false);
      onToolChange(tool.id);
    }
  };

  const shapes = [
    { id: 'rectangle', icon: 'Square',     label: 'Rectangle' },
    { id: 'circle',    icon: 'Circle',     label: 'Circle'    },
    { id: 'triangle',  icon: 'Triangle',   label: 'Triangle'  },
    { id: 'line',      icon: 'Minus',      label: 'Line'      },
    { id: 'arrow',     icon: 'ArrowRight', label: 'Arrow'     },
  ];

  return (
    <div className="side-toolbar">
      <motion.div
        className="toolbar-container"
        initial={{ x: -100 }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      >
        {tools.map((tool, index) => (
          <div key={tool.id} className="tool-wrapper">
            <motion.button
              className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
              onClick={() => handleToolClick(tool)}
              title={tool.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {getIcon(tool.icon)}
            </motion.button>

            <AnimatePresence>
              {tool.id === 'shapes' && showShapesDropdown && (
                <motion.div
                  className="shapes-dropdown"
                  initial={{ opacity: 0, scale: 0.8, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {shapes.map((shape) => (
                    <motion.button
                      key={shape.id}
                      className="shape-option"
                      onClick={() => {
                        onToolChange(shape.id);
                        setShowShapesDropdown(false);
                      }}
                      title={shape.label}
                      whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                    >
                      {getIcon(shape.icon)}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default SideToolbar;