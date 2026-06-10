import { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, useProgress } from '@react-three/drei';
import EarthGlobe, { type PoiData } from './EarthGlobe';
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
