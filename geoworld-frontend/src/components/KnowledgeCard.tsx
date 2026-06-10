import { useNavigate } from 'react-router-dom';
import type { PoiData } from '../components3d/EarthGlobe';

export default function KnowledgeCard({ poi, onClose }: { poi: PoiData; onClose: () => void }) {
  const navigate = useNavigate();

  const handleAskAI = () => {
    navigate(`/ai-teacher?poiId=${poi.id}&poiTitle=${encodeURIComponent(poi.title)}`);
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
          onClick={() => navigate(`/challenge?poiId=${poi.id}`)}
          className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-lg transition-colors border border-blue-200"
        >
          去挑战
        </button>
      </div>
    </div>
  );
}
