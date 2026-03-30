import React, { useState } from 'react';
import TopToolbar from './components/TopToolbar';
import SideToolbar from './components/SideToolbar';
import CanvasBoard from './components/CanvasBoard';
import FrameCarousel from './components/FrameCarousel';
import RightPanel from './components/RightPanel';
import './styles/global.css';

const App = () => {
  const [activeTool, setActiveTool] = useState('pen');
  const [boardName, setBoardName] = useState('Untitled Board');
  const [frames, setFrames] = useState([
    { id: 1, name: 'Frame 1', thumbnail: null },
    { id: 2, name: 'Frame 2', thumbnail: null },
    { id: 3, name: 'Frame 3', thumbnail: null },
  ]);
  const [activeFrame, setActiveFrame] = useState(1);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [zoom, setZoom] = useState(100);

  const tools = [
    { id: 'select', icon: 'MousePointer', label: 'Select' },
    { id: 'pen', icon: 'Pen', label: 'Pen' },
    { id: 'eraser', icon: 'Eraser', label: 'Eraser' },
    { id: 'shapes', icon: 'Square', label: 'Shapes', hasDropdown: true },
    { id: 'text', icon: 'Type', label: 'Text' },
    { id: 'sticky', icon: 'StickyNote', label: 'Sticky Note' },
    { id: 'image', icon: 'Image', label: 'Image' },
  ];

  const handleToolChange = (toolId) => {
    setActiveTool(toolId);
    if (toolId === 'pen' || toolId === 'eraser' || toolId === 'shapes' || toolId === 'text' || toolId === 'sticky') {
      setShowRightPanel(true);
    } else {
      setShowRightPanel(false);
    }
  };

  const addNewFrame = () => {
    const newFrame = {
      id: frames.length + 1,
      name: `Frame ${frames.length + 1}`,
      thumbnail: null,
    };
    setFrames([...frames, newFrame]);
    setActiveFrame(newFrame.id);
  };

  return (
    <div className="jamboard-container">
      <TopToolbar
        boardName={boardName}
        setBoardName={setBoardName}
        zoom={zoom}
        setZoom={setZoom}
        onShare={() => console.log('Share clicked')}
      />
      
      <div className="main-content">
        <SideToolbar
          tools={tools}
          activeTool={activeTool}
          onToolChange={handleToolChange}
        />
        
        <div className="canvas-area">
          <CanvasBoard
            activeTool={activeTool}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            zoom={zoom}
          />
        </div>
        
        {showRightPanel && (
          <RightPanel
            activeTool={activeTool}
            strokeColor={strokeColor}
            setStrokeColor={setStrokeColor}
            strokeWidth={strokeWidth}
            setStrokeWidth={setStrokeWidth}
            onClose={() => setShowRightPanel(false)}
          />
        )}
      </div>
      
      <FrameCarousel
        frames={frames}
        activeFrame={activeFrame}
        setActiveFrame={setActiveFrame}
        onAddFrame={addNewFrame}
      />
    </div>
  );
};

export default App;
