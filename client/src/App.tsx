import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

export function App() {
  return (
    <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#5aa0ff" />
      </mesh>
      <OrbitControls />
    </Canvas>
  );
}
