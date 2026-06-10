import { Link, useLocation } from 'react-router-dom';

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
}