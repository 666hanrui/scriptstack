const fs = require('fs');
const path = require('path');

const write = (file, content) => {
  const fullPath = path.join('/Users/hanrui/rerust/geoworld-frontend/src', file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\n');
};

// 1. Task Challenge Page (Day 5)
write("pages/Challenge/index.tsx", `
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const mockChallenges = [
  {
    id: 1,
    question: "夏至日（6月22日前后），地球北半球将出现什么自然地理现象？",
    options: ["极夜现象范围扩大", "白昼时间达到全年最长", "阳光直射赤道，昼夜平分", "南半球进入盛夏季节"],
    correctIndex: 1,
    explanation: "夏至日时，太阳直射北回归线，北半球白昼最长，北极圈及其以北出现极昼。"
  },
  {
    id: 2,
    question: "在水循环过程中，引发“降水”的关键环境条件是什么？",
    options: ["地表温度极高导致强烈蒸发", "空气相对湿度极低", "上升气流大幅减弱无法托举云层", "完全无风的环境状态"],
    correctIndex: 2,
    explanation: "当积雨云中水汽充分凝结水滴增大，而上升气流无法再托举这些重水滴时，就会在重力作用下形成降水。"
  },
  {
    id: 3,
    question: "地球的黄赤交角大约是多少度，它决定了什么？",
    options: ["23.5°，决定了四季交替和五带划分", "66.5°，决定了昼夜更替", "90°，决定了地球的磁场", "0°，决定了海洋潮汐"],
    correctIndex: 0,
    explanation: "黄赤交角约为23.5°，它是地球产生四季交替、极昼极夜现象和五带划分的根本原因。"
  }
];

export default function Challenge() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poiId = searchParams.get('poiId');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const currentQ = mockChallenges[currentIndex];

  const handleSelect = (index: number) => {
    if (showResult) return; // 防连点
    setSelectedOption(index);
    setShowResult(true);

    if (index === currentQ.correctIndex) {
      setScore(s => s + 10);
    }

    // 2.5秒后自动跳入下一题
    setTimeout(() => {
      if (currentIndex < mockChallenges.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setSelectedOption(null);
        setShowResult(false);
      } else {
        setIsFinished(true);
      }
    }, 2500);
  };

  // 结算页
  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-screen bg-gray-950 text-white p-8 pt-16">
        <div className="max-w-lg w-full bg-gray-900 rounded-3xl p-10 border border-gray-700 shadow-2xl text-center">
          <div className="text-8xl mb-6 animate-bounce" style={{animationDuration: '2s'}}>🏆</div>
          <h2 className="text-3xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">挑战完成！</h2>
          <p className="text-gray-400 mb-8">
            本次地理探索得分：<span className="text-white text-5xl font-black ml-2">{score}</span> 分
          </p>
          
          <button 
            onClick={() => navigate('/console')}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/30 text-lg flex justify-center items-center gap-2"
          >
            <span>返回数字地球主控台</span> 🌍
          </button>
        </div>
      </div>
    );
  }

  // 答题页
  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-gray-950 text-white p-8 pt-16">
      <div className="max-w-3xl w-full bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-2xl relative overflow-hidden flex flex-col min-h-[500px]">
        {/* 顶部高亮进度条 */}
        <div className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500 ease-out" style={{ width: \`\${((currentIndex + 1) / mockChallenges.length) * 100}%\` }}></div>
        
        {/* 题号与积分信息栏 */}
        <div className="flex justify-between items-center mb-10">
          <span className="text-xs font-black tracking-widest text-gray-500 bg-gray-800 px-4 py-1.5 rounded-full border border-gray-700 uppercase">
            任务进度 {currentIndex + 1} / {mockChallenges.length}
          </span>
          <span className="text-sm font-black text-yellow-500 flex items-center gap-1 bg-yellow-900/20 px-4 py-1.5 rounded-full">
            ⭐ 积分: {score}
          </span>
        </div>

        {/* 题干内容区 */}
        <h3 className="text-2xl font-bold leading-relaxed mb-8 text-gray-100 min-h-[64px] flex items-center">
          {currentQ.question}
        </h3>

        {/* 选项区 */}
        <div className="space-y-4 flex-1">
          {currentQ.options.map((opt, idx) => {
            let btnStyle = "bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300";
            let indicator = "";
            
            if (showResult) {
              if (idx === currentQ.correctIndex) {
                btnStyle = "bg-green-900/40 border-green-500 text-green-300 shadow-lg shadow-green-900/20 scale-[1.02] z-10 relative";
                indicator = "✅ ";
              } else if (idx === selectedOption) {
                btnStyle = "bg-red-900/30 border-red-600 text-red-300 opacity-80";
                indicator = "❌ ";
              } else {
                btnStyle = "bg-gray-900 border-gray-800 text-gray-600 opacity-40 grayscale";
              }
            }

            return (
              <button 
                key={idx}
                onClick={() => handleSelect(idx)}
                className={\`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 font-medium text-lg flex items-center \${btnStyle}\`}
                disabled={showResult}
              >
                <span className="inline-block w-8 font-black opacity-50">{String.fromCharCode(65 + idx)}.</span>
                <span className="flex-1">{opt}</span>
                <span className="text-xl">{indicator}</span>
              </button>
            )
          })}
        </div>

        {/* 解析反馈区 (仅展示结果时呈现) */}
        <div className={\`mt-8 p-5 rounded-xl border transition-all duration-500 ease-in-out \${showResult ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute bottom-8 left-8 right-8'} \${selectedOption === currentQ.correctIndex ? 'bg-green-950/50 border-green-900/50' : 'bg-red-950/50 border-red-900/50'}\`}>
          <div className="font-bold mb-2 flex items-center gap-2">
            {selectedOption === currentQ.correctIndex ? <span className="text-green-500">回答正确！</span> : <span className="text-red-500">回答错误！</span>}
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">{currentQ.explanation}</p>
        </div>
      </div>
    </div>
  );
}
`);
