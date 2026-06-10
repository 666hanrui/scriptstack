import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, useTexture } from '@react-three/drei';

function WaterEarth() {
  const colorMap = useTexture('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  return (
    <group>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} />
      <Sphere args={[1, 64, 64]}>
        <meshStandardMaterial map={colorMap} roughness={0.4} metalness={0.2} />
      </Sphere>
    </group>
  );
}

export default function WaterCycle() {
  const [temp, setTemp] = useState(25);
  const [humidity, setHumidity] = useState(60);
  const [updraft, setUpdraft] = useState(50);
  const [stage, setStage] = useState('stable');

  useEffect(() => {
    if (humidity >= 85 && updraft <= 40) {
      setStage('precipitation'); // 降水
    } else if (humidity >= 70 && updraft > 50) {
      setStage('condensation'); // 凝结成云
    } else if (temp > 30 && humidity < 70) {
      setStage('evaporation'); // 蒸发
    } else {
      setStage('stable'); // 平静
    }
  }, [temp, humidity, updraft]);

  return (
    <div className="w-full h-screen bg-gray-950 relative flex overflow-hidden pt-[68px]">
      
      {/* 视觉反馈特效层 (CSS动画/UI叠加) */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden pt-[68px]">
        {stage === 'precipitation' && (
          <div className="w-full h-full bg-blue-900/40 flex flex-col items-center justify-center backdrop-blur-[2px] transition-all duration-1000">
            <div className="text-blue-300 text-9xl animate-bounce drop-shadow-2xl">🌧️</div>
            <div className="text-blue-100 text-4xl font-extrabold mt-6 tracking-widest drop-shadow-lg">大范围降水流转</div>
            <p className="text-blue-200 mt-4 text-lg font-bold bg-black/40 px-6 py-2 rounded-full">上升气流减弱，积雨云不堪重负</p>
          </div>
        )}
        {stage === 'condensation' && (
          <div className="w-full h-full bg-gray-600/40 flex flex-col items-center justify-start pt-32 transition-all duration-1000">
            <div className="text-gray-200 text-9xl animate-pulse drop-shadow-2xl scale-125">☁️</div>
            <div className="text-white text-4xl font-extrabold mt-8 tracking-widest drop-shadow-lg">积雨云大量凝结</div>
            <p className="text-gray-200 mt-4 text-lg font-bold bg-black/40 px-6 py-2 rounded-full">强上升气流正在托举丰沛的水汽</p>
          </div>
        )}
        {stage === 'evaporation' && (
          <div className="w-full h-full bg-orange-900/20 flex flex-col items-center justify-end pb-32 transition-all duration-1000">
            <div className="text-orange-300/80 text-8xl flex gap-8 mb-4">
              <span className="animate-bounce" style={{animationDuration: '2s'}}>〰️</span>
              <span className="animate-bounce" style={{animationDuration: '2.5s'}}>〰️</span>
              <span className="animate-bounce" style={{animationDuration: '3s'}}>〰️</span>
            </div>
            <div className="text-orange-100 text-4xl font-extrabold mt-4 tracking-widest drop-shadow-lg">地表水分强烈蒸发</div>
            <p className="text-orange-200 mt-4 text-lg font-bold bg-black/40 px-6 py-2 rounded-full">高温驱动水汽向大气层输送</p>
          </div>
        )}
      </div>

      {/* 3D 背景层 */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
          <React.Suspense fallback={null}>
            <WaterEarth />
          </React.Suspense>
          <OrbitControls enableZoom={true} enablePan={false} autoRotate={true} autoRotateSpeed={1} enableDamping dampingFactor={0.05} />
        </Canvas>
      </div>

      {/* 控制面板 */}
      <div className="w-[420px] bg-gray-900/95 border-l border-gray-700 p-8 shadow-2xl z-20 flex flex-col backdrop-blur-xl">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 flex items-center gap-2">
          💧 水循环实验室
        </h2>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">调节下方环境参数组合，突破地理阈值，触发“蒸发”、“凝结”与“降水”状态转移。</p>
        
        <div className="flex-1 space-y-8">
          {/* 当前状态指示 */}
          <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-inner relative overflow-hidden">
            <div className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">当前大气状态</div>
            <div className="text-3xl font-extrabold text-white relative z-10 transition-colors">
              {stage === 'stable' && <span className="text-green-400">稳定 / 循环孕育中</span>}
              {stage === 'evaporation' && <span className="text-orange-400">♨️ 强烈蒸发阶段</span>}
              {stage === 'condensation' && <span className="text-gray-300">☁️ 凝结成云阶段</span>}
              {stage === 'precipitation' && <span className="text-blue-400">🌧️ 降水回流阶段</span>}
            </div>
            {/* 进度条装饰 */}
            <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full"></div>
          </div>

          {/* 滑块组 */}
          <div className="space-y-6">
            <div className="group">
              <div className="flex justify-between text-sm mb-2"><span className="text-gray-300 font-bold group-hover:text-orange-400 transition-colors">地表温度 (Temp)</span><span className="text-orange-400 font-mono text-lg">{temp} °C</span></div>
              <input type="range" min="0" max="50" value={temp} onChange={(e) => setTemp(Number(e.target.value))} className="w-full h-2.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400" />
              <p className="text-xs text-gray-500 mt-2">（&gt;30°C 促进地表水汽强烈蒸发）</p>
            </div>

            <div className="group">
              <div className="flex justify-between text-sm mb-2"><span className="text-gray-300 font-bold group-hover:text-blue-400 transition-colors">空气相对湿度 (Humidity)</span><span className="text-blue-400 font-mono text-lg">{humidity} %</span></div>
              <input type="range" min="0" max="100" value={humidity} onChange={(e) => setHumidity(Number(e.target.value))} className="w-full h-2.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400" />
              <p className="text-xs text-gray-500 mt-2">（&gt;70% 有利于凝结，&gt;85% 极易降水）</p>
            </div>

            <div className="group">
              <div className="flex justify-between text-sm mb-2"><span className="text-gray-300 font-bold group-hover:text-gray-100 transition-colors">上升气流强度 (Updraft)</span><span className="text-gray-300 font-mono text-lg">{updraft} %</span></div>
              <input type="range" min="0" max="100" value={updraft} onChange={(e) => setUpdraft(Number(e.target.value))} className="w-full h-2.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-400 hover:accent-gray-300" />
              <p className="text-xs text-gray-500 mt-2">（强气流托举云层，&lt;40% 则云滴因重力下落降水）</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
