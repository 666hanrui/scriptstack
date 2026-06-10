import { Sphere, useTexture, Html } from '@react-three/drei';
import { latLongToVector3 } from '../utils/geo';


export interface PoiData {
  id: string;
  title: string;
  lat: number;
  lon: number;
  desc: string;
  naturalBg?: string;
  humanGeo?: string;
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
}
