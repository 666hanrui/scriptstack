const fs = require('fs');
const path = require('path');

const files = {
  "utils/geo.ts": `export function latLongToVector3(lat: number, lon: number, radius: number = 1): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = (radius * Math.sin(phi) * Math.sin(theta));
  const y = (radius * Math.cos(phi));
  return [x, y, z];
}`,
  "components3d/EarthGlobe.tsx": `import { Sphere, useTexture, Html } from '@react-three/drei';
import { latLongToVector3 } from '../utils/geo';
import * as THREE from 'three';

export interface PoiData {
  id: string;
  title: string;
  lat: number;
  lon: number;
  desc: string;
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
  // Using public CDN for earth texture
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
}`,
  "components3d/EarthViewer.tsx": `import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, useProgress } from '@react-three/drei';
import EarthGlobe, { PoiData } from './EarthGlobe';

const mockPois: PoiData[] = [
  { id: '1', title: '珠穆朗玛峰', lat: 27.9881, lon: 86.9250, desc: '世界最高峰，海拔8848.86米。位于喜马拉雅山脉中段。' },
  { id: '2', title: '马里亚纳海沟', lat: 11.3493, lon: 142.1996, desc: '已知海洋最深处，最深处达11034米，水压极高，环境恶劣。' },
  { id: '3', title: '撒哈拉沙漠', lat: 23.4162, lon: 25.6628, desc: '世界最大的沙质荒漠，气候条件极其恶劣，横跨非洲北部。' },
  { id: '4', title: '亚马逊雨林', lat: -3.4653, lon: -62.2159, desc: '地球之肺，世界最大的热带雨林，生物多样性极其丰富。' },
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

      {/* Knowledge Card UI (Overlay) */}
      {activePoi && (
        <div className="absolute top-24 right-8 w-80 bg-white/95 p-6 rounded-xl shadow-2xl backdrop-blur-md border border-white/20 transition-all z-20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-extrabold text-gray-800">{activePoi.title}</h3>
            <button 
              className="text-gray-400 hover:text-gray-800 transition-colors bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center font-bold"
              onClick={() => setActivePoi(null)}
              title="关闭"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            <div className="text-xs text-gray-500 flex justify-between bg-gray-50 p-2 rounded">
              <span>纬度: {activePoi.lat > 0 ? 'N' : 'S'} {Math.abs(activePoi.lat).toFixed(4)}°</span>
              <span>经度: {activePoi.lon > 0 ? 'E' : 'W'} {Math.abs(activePoi.lon).toFixed(4)}°</span>
            </div>
            <div className="w-full h-px bg-gray-200"></div>
            <p className="text-sm text-gray-700 leading-relaxed min-h-[60px]">
              {activePoi.desc}
            </p>
            <div className="pt-2">
              <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-md shadow-blue-500/30">
                查看详情与任务
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`
};

Object.entries(files).forEach(([file, content]) => {
  const fullPath = path.join('/Users/hanrui/rerust/geoworld-frontend/src', file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
});
