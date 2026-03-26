import React from 'react';
import { motion } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';

const FrameCarousel = ({ frames, activeFrame, setActiveFrame, onAddFrame }) => {
  const scrollContainerRef = React.useRef(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="frame-carousel">
      <div className="carousel-container">
        <button 
          className="carousel-nav-btn left"
          onClick={scrollLeft}
          title="Scroll left"
        >
          <ChevronLeft size={16} />
        </button>

        <div 
          className="frames-scroll-container"
          ref={scrollContainerRef}
        >
          <div className="frames-list">
            {frames.map((frame, index) => (
              <motion.div
                key={frame.id}
                className={`frame-item ${activeFrame === frame.id ? 'active' : ''}`}
                onClick={() => setActiveFrame(frame.id)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="frame-thumbnail">
                  {frame.thumbnail ? (
                    <img src={frame.thumbnail} alt={frame.name} />
                  ) : (
                    <div className="thumbnail-placeholder">
                      <div className="placeholder-icon">📄</div>
                      <span className="frame-number">{frame.id}</span>
                    </div>
                  )}
                </div>
                <div className="frame-info">
                  <span className="frame-name">{frame.name}</span>
                </div>
                {activeFrame === frame.id && (
                  <motion.div 
                    className="active-indicator"
                    layoutId="activeFrame"
                  />
                )}
              </motion.div>
            ))}

            <motion.button
              className="add-frame-btn"
              onClick={onAddFrame}
              title="Add new frame"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: frames.length * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus size={20} />
            </motion.button>
          </div>
        </div>

        <button 
          className="carousel-nav-btn right"
          onClick={scrollRight}
          title="Scroll right"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default FrameCarousel;
