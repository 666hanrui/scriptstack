const fs = require('fs');
const path = require('path');

const write = (file, content) => {
  const fullPath = path.join('/Users/hanrui/rerust/geoworld-frontend/src', file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\n');
};

// Update Home Page for stunning visual and "Start Demo" button
write("pages/Home/index.tsx", `
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col items-center justify-center text-white">
      {/* 极简星空/地球背景示意 */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-black/80 z-0"></div>
      
      <div className="relative z-10 text-center space-y-8 max-w-4xl px-4 animate-fade-in-up">
        <h1 className="text-7xl md:text-9xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-400 drop-shadow-2xl">
          GeoWorld
        </h1>
        <p className="text-xl md:text-2xl font-light text-gray-300 tracking-widest">
          下一代沉浸式 3D 互动地理实验室
        </p>
        
        <div className="pt-12">
          <button 
            onClick={() => navigate('/console')}
            className="px-12 py-5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-full text-2xl shadow-xl shadow-blue-600/40 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-4 mx-auto border border-blue-400/30"
          >
            🌍 开启全景演示
          </button>
          <p className="mt-6 text-sm text-gray-500">第一阶段演示版 v1.0.0 · 推荐使用全屏体验</p>
        </div>
      </div>
    </div>
  );
}
`);
