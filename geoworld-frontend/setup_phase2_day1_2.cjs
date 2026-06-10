const fs = require('fs');
const path = require('path');

const write = (file, content) => {
  const fullPath = path.join('/Users/hanrui/rerust/geoworld-frontend/src', file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\n');
};

// 1. Update EarthGlobe to include new PoiData fields
write("components3d/EarthGlobe.tsx", `
import { Sphere, useTexture, Html } from '@react-three/drei';
import { latLongToVector3 } from '../utils/geo';
import * as THREE from 'three';

export interface PoiData {
  id: string;
  title: string;
  lat: number;
  lon: number;
  desc: string;
  naturalBg?: string;
  humanGeo?: string;
}

interface EarthGlobeProps {
  pois: PoiData[];
  onMarkerClick: (poi: PoiData) => void;
}

function PoiMarker({ poi, onClick }: { poi: PoiData; onClick: () => void }) {
  const pos = latLongToVector3(poi.lat, poi.lon, 1.01);
  return (
    <mesh position={pos} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <sphereGeometry args={[0.02, 16, 16]} />
      <meshBasicMaterial color="#FF3B30" />
      <Html distanceFactor={3}>
        <div className="text-white text-xs font-medium whitespace-nowrap bg-black/60 px-2 py-0.5 rounded shadow-lg pointer-events-none -translate-x-1/2 mt-1 border border-white/20">
          {poi.title}
        </div>
      </Html>
    </mesh>
  );
}

export default function EarthGlobe({ pois, onMarkerClick }: EarthGlobeProps) {
  const colorMap = useTexture('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  return (
    <group>
      <Sphere args={[1, 64, 64]}>
        <meshStandardMaterial map={colorMap} roughness={0.6} metalness={0.1} />
      </Sphere>
      {pois.map(poi => (
        <PoiMarker key={poi.id} poi={poi} onClick={() => onMarkerClick(poi)} />
      ))}
    </group>
  );
}
`);

// 2. Create KnowledgeCard UI
write("components/KnowledgeCard.tsx", `
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PoiData } from '../components3d/EarthGlobe';

export default function KnowledgeCard({ poi, onClose }: { poi: PoiData; onClose: () => void }) {
  const navigate = useNavigate();

  const handleAskAI = () => {
    navigate(\`/ai-teacher?poiId=\${poi.id}&poiTitle=\${encodeURIComponent(poi.title)}\`);
  };

  return (
    <div className="absolute top-24 right-8 w-96 bg-white/95 p-6 rounded-2xl shadow-2xl backdrop-blur-md border border-white/20 transition-all z-20 flex flex-col max-h-[80vh]">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
        <h3 className="text-2xl font-extrabold text-gray-800 tracking-wide">{poi.title}</h3>
        <button 
          className="text-gray-400 hover:text-red-500 transition-colors bg-gray-100 hover:bg-red-50 rounded-full w-8 h-8 flex items-center justify-center font-bold"
          onClick={onClose}
          title="关闭"
        >✕</button>
      </div>
      <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-4">
        <div className="text-xs text-gray-500 flex justify-between bg-blue-50 p-2 rounded-lg">
          <span className="font-medium text-blue-700">纬度: {poi.lat > 0 ? 'N' : 'S'} {Math.abs(poi.lat).toFixed(4)}°</span>
          <span className="font-medium text-blue-700">经度: {poi.lon > 0 ? 'E' : 'W'} {Math.abs(poi.lon).toFixed(4)}°</span>
        </div>
        
        <div>
          <h4 className="text-sm font-bold text-gray-800 mb-1 flex items-center"><span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>自然背景</h4>
          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">{poi.naturalBg || poi.desc}</p>
        </div>

        {poi.humanGeo && (
          <div>
            <h4 className="text-sm font-bold text-gray-800 mb-1 flex items-center"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2"></span>人文地理</h4>
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">{poi.humanGeo}</p>
          </div>
        )}
      </div>
      
      <div className="pt-4 mt-2 border-t border-gray-100 flex gap-3">
        <button 
          onClick={handleAskAI}
          className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-lg transition-all shadow-md shadow-indigo-500/30 flex items-center justify-center gap-2"
        >
          <span className="text-lg">🤖</span> 问 AI 老师
        </button>
        <button 
          onClick={() => navigate(\`/challenge?poiId=\${poi.id}\`)}
          className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-lg transition-colors border border-blue-200"
        >
          去挑战
        </button>
      </div>
    </div>
  );
}
`);

// 3. Update EarthViewer to use KnowledgeCard and rich mock data
write("components3d/EarthViewer.tsx", `
import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, useProgress } from '@react-three/drei';
import EarthGlobe, { PoiData } from './EarthGlobe';
import KnowledgeCard from '../components/KnowledgeCard';

const mockPois: PoiData[] = [
  { 
    id: '1', title: '珠穆朗玛峰', lat: 27.9881, lon: 86.9250, desc: '世界最高峰',
    naturalBg: '位于喜马拉雅山脉中段，是世界海拔最高的山峰（8848.86米）。受欧亚板块与印度洋板块挤压而形成，气候极端寒冷，常年冰雪覆盖。',
    humanGeo: '珠峰不仅是地理坐标，更是人类探索精神的象征。周边聚居着以高山向导闻名的夏尔巴人，是全球登山爱好者的朝圣地。'
  },
  { 
    id: '2', title: '马里亚纳海沟', lat: 11.3493, lon: 142.1996, desc: '海洋最深处',
    naturalBg: '位于太平洋西部，最深处达11034米（挑战者深渊）。这里水压极高、完全黑暗、温度极低，是地球表面环境最恶劣的区域之一。',
    humanGeo: '尽管环境极端，人类仍在不断通过深潜器探索此处，这里的研究对理解地球板块运动及极端条件下的生命形态具有重要意义。'
  },
  { 
    id: '3', title: '撒哈拉沙漠', lat: 23.4162, lon: 25.6628, desc: '世界最大的沙质荒漠',
    naturalBg: '横跨非洲大陆北部，面积超900万平方公里。受副热带高气压带控制，常年干旱少雨，昼夜温差大，地表多为沙丘和砾漠。',
    humanGeo: '虽然干旱，但边缘地带和绿洲孕育了游牧文化（如图阿雷格人），这里也曾是古代跨撒哈拉贸易路线的关键通道。'
  }
];

function Loader() {
  const { progress } = useProgress();
  return <Html center><div className="text-white whitespace-nowrap bg-black/80 px-4 py-2 rounded shadow-lg">载入数字地球中... {progress.toFixed(0)}%</div></Html>;
}

export default function EarthViewer() {
  const [activePoi, setActivePoi] = useState<PoiData | null>(null);

  return (
    <div className="w-full h-full bg-black relative">
      <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 3, 5]} intensity={1.5} />
        <directionalLight position={[-5, -3, -5]} intensity={0.3} />
        
        <Suspense fallback={<Loader />}>
          <EarthGlobe pois={mockPois} onMarkerClick={setActivePoi} />
        </Suspense>
        
        <OrbitControls enableZoom={true} enablePan={false} minDistance={1.2} maxDistance={6} enableDamping dampingFactor={0.05} />
      </Canvas>

      {activePoi && <KnowledgeCard poi={activePoi} onClose={() => setActivePoi(null)} />}
    </div>
  );
}
`);

// 4. Movement Page (Day/Night Lab)
write("pages/Movement/index.tsx", `
import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, useTexture, Html } from '@react-three/drei';

function DaylightEarth({ hour }: { hour: number }) {
  const colorMap = useTexture('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  
  // 地球自转：一天24小时旋转360度(2PI)
  // 为了让太阳直射本初子午线(经度0)发生在中午12点，我们需要计算偏移
  const rotationY = ((hour - 12) / 24) * Math.PI * 2;

  return (
    <group>
      {/* 太阳光始终从 X 轴正方向照射过来 */}
      <directionalLight position={[10, 0, 0]} intensity={3.5} castShadow />
      
      {/* 非常暗的环境光，让背阴面呈现黑夜状态 */}
      <ambientLight intensity={0.02} />
      
      <Sphere args={[1, 64, 64]} rotation={[0, rotationY, 0]}>
        <meshStandardMaterial map={colorMap} roughness={0.8} metalness={0.1} />
      </Sphere>

      {/* 一个固定的太阳指示器，仅作为视觉辅助 */}
      <mesh position={[4, 0, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#FFD700" />
        <Html distanceFactor={5} center position={[0, -0.4, 0]}>
          <div className="text-yellow-400 font-bold text-sm bg-black/50 px-2 py-1 rounded">太阳 (光源方向)</div>
        </Html>
      </mesh>
    </group>
  );
}

export default function Movement() {
  const [hour, setHour] = useState(12);

  return (
    <div className="w-full h-screen bg-black relative flex flex-col pt-16">
      {/* 3D Viewport */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }}>
          <React.Suspense fallback={null}>
            <DaylightEarth hour={hour} />
          </React.Suspense>
          <OrbitControls enableZoom={true} enablePan={false} minDistance={1.2} maxDistance={6} enableDamping dampingFactor={0.05} />
        </Canvas>
      </div>

      {/* Control Panel UI */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[600px] bg-gray-900/90 p-6 rounded-2xl backdrop-blur-md border border-gray-700 shadow-2xl z-10 text-white">
        <div className="mb-6">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-orange-500 flex items-center justify-between">
            <span>🌞 昼夜交替实验室</span>
            <span className="text-3xl text-white font-mono tracking-wider">{String(Math.floor(hour)).padStart(2, '0')}:{(hour % 1 === 0.5) ? '30' : '00'}</span>
          </h2>
          <p className="text-sm text-gray-400 mt-2">左右拖动时间轴，观察地球表面“晨昏线”的推移与昼夜更替。</p>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-400 w-12 text-right">00:00</span>
          <input 
            type="range" 
            min="0" 
            max="24" 
            step="0.5" 
            value={hour}
            onChange={(e) => setHour(parseFloat(e.target.value))}
            className="flex-1 h-2.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400 transition-all"
          />
          <span className="text-sm font-medium text-gray-400 w-12">24:00</span>
        </div>
      </div>
    </div>
  );
}
`);

// 5. AITeacher placeholder to receive nav
write("pages/AITeacher/index.tsx", `
import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function AITeacher() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const poiId = searchParams.get('poiId');
  const poiTitle = searchParams.get('poiTitle');

  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-gray-900 text-white p-8 pt-16">
      <div className="max-w-2xl w-full bg-gray-800 rounded-2xl p-10 border border-gray-700 shadow-2xl text-center">
        <div className="text-7xl mb-6">🤖</div>
        <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">AI 地理老师</h2>
        {poiTitle ? (
          <div className="mb-8">
            <p className="text-lg text-gray-300">
              你正在询问关于 <span className="text-blue-400 font-bold text-xl mx-2">{poiTitle}</span> 的问题。
            </p>
            <p className="text-gray-400 mt-2 text-sm">此功能将调用 /api/ai/chat 接口，与本地知识库结合进行流式对话答疑。</p>
          </div>
        ) : (
          <p className="text-lg text-gray-300 mb-8">
            你好！我是 GeoWorld 的 AI 地理老师。<br/>请在主控台的数字地球中选择一个景观点，或者直接在这里向我提问吧！
          </p>
        )}
        
        <div className="flex gap-4 justify-center">
          <button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors shadow-lg shadow-blue-500/30">
            开始对话 (待接入后端)
          </button>
          <button 
            onClick={() => navigate(-1)}
            className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors"
          >
            返回
          </button>
        </div>
      </div>
    </div>
  );
}
`);
