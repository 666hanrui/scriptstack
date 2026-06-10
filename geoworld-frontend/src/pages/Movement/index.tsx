import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, useTexture, Html } from '@react-three/drei';

function DaylightEarth({ hour, month }: { hour: number, month: number }) {
  const colorMap = useTexture('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  
  // 地球自转
  const rotationY = ((hour - 12) / 24) * Math.PI * 2;
  
  // 地轴倾角 23.5度
  const MAX_TILT = 23.5 * (Math.PI / 180);
  
  // 根据月份计算倾向太阳的角度。6月(夏至)北极倾向太阳(倾角为负，北极向X正方向)
  const tiltZ = -MAX_TILT * Math.cos(((month - 6) / 12) * Math.PI * 2);

  return (
    <group>
      <directionalLight position={[10, 0, 0]} intensity={3.5} castShadow />
      <ambientLight intensity={0.02} />
      
      {/* 倾角组包裹地球 */}
      <group rotation={[0, 0, tiltZ]}>
        <Sphere args={[1, 64, 64]} rotation={[0, rotationY, 0]}>
          <meshStandardMaterial map={colorMap} roughness={0.8} metalness={0.1} />
        </Sphere>
        {/* 地轴指示线: 北极(红), 南极(蓝) */}
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.4]} />
          <meshBasicMaterial color="#ff3b30" />
        </mesh>
        <mesh position={[0, -1.2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.4]} />
          <meshBasicMaterial color="#007aff" />
        </mesh>
      </group>

      {/* 太阳指示 */}
      <mesh position={[4, 0, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#FFD700" />
        <Html distanceFactor={5} center position={[0, -0.4, 0]}>
          <div className="text-yellow-400 font-bold text-sm bg-black/50 px-2 py-1 rounded whitespace-nowrap">直射光</div>
        </Html>
      </mesh>
    </group>
  );
}

export default function Movement() {
  const [hour, setHour] = useState(12);
  const [month, setMonth] = useState(6); // 默认6月夏至

  return (
    <div className="w-full h-screen bg-black relative flex flex-col pt-16">
      <div className="flex-1 relative">
        <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }}>
          <React.Suspense fallback={null}>
            <DaylightEarth hour={hour} month={month} />
          </React.Suspense>
          <OrbitControls enableZoom={true} enablePan={false} minDistance={1.2} maxDistance={6} enableDamping dampingFactor={0.05} />
        </Canvas>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[700px] bg-gray-900/90 p-6 rounded-2xl backdrop-blur-md border border-gray-700 shadow-2xl z-10 text-white flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-orange-500">🌞 昼夜与四季交替实验室</h2>
            <p className="text-sm text-gray-400 mt-1">观察地轴倾角变化带来的极昼极夜现象，及晨昏线的移动。</p>
          </div>
          <div className="text-right">
            <div className="text-3xl text-white font-mono tracking-wider">{String(Math.floor(hour)).padStart(2, '0')}:{(hour % 1 === 0.5) ? '30' : '00'}</div>
            <div className="text-sm text-blue-400 font-bold bg-blue-900/50 px-2 py-1 rounded mt-1 inline-block">{month} 月</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-gray-400 w-12 text-right">时间</span>
          <input type="range" min="0" max="24" step="0.5" value={hour} onChange={(e) => setHour(parseFloat(e.target.value))} className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400 transition-all" />
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-gray-400 w-12 text-right">月份</span>
          <input type="range" min="1" max="12" step="1" value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all" />
        </div>
      </div>
    </div>
  );
}
