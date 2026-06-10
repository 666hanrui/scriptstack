const fs = require('fs');
const path = require('path');

const files = {
  "components/Navigation.tsx": `import { Link, useLocation } from 'react-router-dom';

export default function Navigation() {
  const location = useLocation();
  const getLinkClass = (path: string) => {
    return location.pathname === path
      ? "text-blue-400 font-bold border-b-2 border-blue-400"
      : "hover:text-blue-400 text-gray-300";
  };

  return (
    <nav className="absolute top-0 left-0 w-full px-6 py-4 bg-black/60 text-white flex items-center gap-6 z-10 backdrop-blur-md shadow-lg border-b border-white/10">
      <div className="font-extrabold text-xl mr-4 tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">GeoWorld</div>
      <Link to="/" className={getLinkClass('/')}>首页</Link>
      <Link to="/console" className={getLinkClass('/console')}>数字地球</Link>
      <Link to="/movement" className={getLinkClass('/movement')}>地球运动</Link>
      <Link to="/water-cycle" className={getLinkClass('/water-cycle')}>水循环</Link>
      <Link to="/landscape" className={getLinkClass('/landscape')}>世界景观</Link>
      <Link to="/ai-teacher" className={getLinkClass('/ai-teacher')}>AI老师</Link>
      <Link to="/challenge" className={getLinkClass('/challenge')}>任务挑战</Link>
    </nav>
  );
}`,
  "pages/Home/index.tsx": `export default function Home() { return <div className="flex items-center justify-center w-full h-screen bg-gray-900 text-white text-3xl font-bold">GeoWorld 首页 - 欢迎探索地球</div>; }`,
  "pages/Movement/index.tsx": `export default function Movement() { return <div className="flex items-center justify-center w-full h-screen bg-gray-900 text-white text-3xl font-bold">地球运动模块 (占位)</div>; }`,
  "pages/WaterCycle/index.tsx": `export default function WaterCycle() { return <div className="flex items-center justify-center w-full h-screen bg-gray-900 text-white text-3xl font-bold">水循环模块 (占位)</div>; }`,
  "pages/Landscape/index.tsx": `export default function Landscape() { return <div className="flex items-center justify-center w-full h-screen bg-gray-900 text-white text-3xl font-bold">世界景观模块 (占位)</div>; }`,
  "pages/AITeacher/index.tsx": `export default function AITeacher() { return <div className="flex items-center justify-center w-full h-screen bg-gray-900 text-white text-3xl font-bold">AI老师辅导模块 (占位)</div>; }`,
  "pages/Challenge/index.tsx": `export default function Challenge() { return <div className="flex items-center justify-center w-full h-screen bg-gray-900 text-white text-3xl font-bold">任务挑战模块 (占位)</div>; }`,
  "components3d/EarthGlobe.tsx": `import { Sphere } from '@react-three/drei';

export default function EarthGlobe() {
  return (
    <group>
      <Sphere args={[1, 64, 64]}>
        <meshStandardMaterial color="#2A4B7C" wireframe={false} roughness={0.6} metalness={0.1} />
      </Sphere>
    </group>
  );
}`,
  "components3d/EarthViewer.tsx": `import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import EarthGlobe from './EarthGlobe';

export default function EarthViewer() {
  return (
    <div className="w-full h-full bg-black">
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 3, 5]} intensity={1.2} />
        <directionalLight position={[-5, -3, -5]} intensity={0.2} />
        <EarthGlobe />
        <OrbitControls enableZoom={true} enablePan={false} minDistance={1.2} maxDistance={6} enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
}`,
  "pages/Console/index.tsx": `import EarthViewer from '../../components3d/EarthViewer';

export default function Console() {
  return (
    <div className="w-full h-screen bg-black">
      <EarthViewer />
    </div>
  );
}`,
  "App.tsx": `import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import Console from './pages/Console';
import Movement from './pages/Movement';
import WaterCycle from './pages/WaterCycle';
import Landscape from './pages/Landscape';
import AITeacher from './pages/AITeacher';
import Challenge from './pages/Challenge';

function App() {
  return (
    <Router>
      <div className="relative w-full h-screen overflow-hidden bg-black text-white text-base">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/console" element={<Console />} />
          <Route path="/movement" element={<Movement />} />
          <Route path="/water-cycle" element={<WaterCycle />} />
          <Route path="/landscape" element={<Landscape />} />
          <Route path="/ai-teacher" element={<AITeacher />} />
          <Route path="/challenge" element={<Challenge />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;`
};

Object.entries(files).forEach(([file, content]) => {
  const fullPath = path.join('/Users/hanrui/rerust/geoworld-frontend/src', file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
});
