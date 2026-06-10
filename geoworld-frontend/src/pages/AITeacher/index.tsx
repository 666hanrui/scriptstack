import { useSearchParams, useNavigate } from 'react-router-dom';

export default function AITeacher() {
  const searchParams = useSearchParams()[0];
  const navigate = useNavigate();
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
