import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import Console from './pages/Console';
import Movement from './pages/Movement';
import WaterCycle from './pages/WaterCycle';
import Landscape from './pages/Landscape';
import AITeacher from './pages/AITeacher';
import Challenge from './pages/Challenge';

function App() {
  return (
    <Router>
      <div className="relative w-full h-screen overflow-hidden bg-black text-white text-base">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/console" element={<Console />} />
          <Route path="/movement" element={<Movement />} />
          <Route path="/water-cycle" element={<WaterCycle />} />
          <Route path="/landscape" element={<Landscape />} />
          <Route path="/ai-teacher" element={<AITeacher />} />
          <Route path="/challenge" element={<Challenge />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;