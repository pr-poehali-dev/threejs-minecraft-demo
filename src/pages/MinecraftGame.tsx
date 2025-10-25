import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const CHUNK_SIZE = 12;
const RENDER_DISTANCE = 3;
const BLOCK_SIZE = 1;

interface Block {
  x: number;
  y: number;
  z: number;
  type: 'grass' | 'dirt' | 'stone';
}

const MinecraftGame = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [health, setHealth] = useState(10);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [fps, setFps] = useState(0);
  
  const inventory = [
    { id: 0, name: 'Grass', icon: '🟩' },
    { id: 1, name: 'Dirt', icon: '🟫' },
    { id: 2, name: 'Stone', icon: '⬜' },
    { id: 3, name: 'Wood', icon: '🟤' },
    { id: 4, name: 'Pickaxe', icon: '⛏️' },
    { id: 5, name: 'Sword', icon: '🗡️' },
    { id: 6, name: 'Apple', icon: '🍎' },
    { id: 7, name: 'Bread', icon: '🍞' },
    { id: 8, name: 'Diamond', icon: '💎' },
  ];

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 10, CHUNK_SIZE * RENDER_DISTANCE);

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(8, 15, 8);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = false;
    canvasRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    const noise = (x: number, z: number): number => {
      const xx = x * 0.1;
      const zz = z * 0.1;
      return Math.sin(xx) * Math.cos(zz) * 3 + 
             Math.sin(xx * 2) * Math.cos(zz * 2) * 1.5 +
             Math.sin(xx * 4) * Math.cos(zz * 4) * 0.75;
    };

    const blockMaterials = {
      grass: new THREE.MeshLambertMaterial({ color: 0x7EC850 }),
      dirt: new THREE.MeshLambertMaterial({ color: 0x8B7355 }),
      stone: new THREE.MeshLambertMaterial({ color: 0x808080 }),
    };

    const blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

    const createMergedChunk = (cx: number, cz: number) => {
      const geometries: THREE.BufferGeometry[] = [];
      
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const worldX = cx * CHUNK_SIZE + x;
          const worldZ = cz * CHUNK_SIZE + z;
          const height = Math.floor(noise(worldX, worldZ) + 8);

          const geo = blockGeometry.clone();
          geo.translate(worldX, height, worldZ);
          geometries.push(geo);
        }
      }

      const mergedGeometry = new THREE.BufferGeometry();
      if (geometries.length > 0) {
        const merged = THREE.BufferGeometryUtils?.mergeGeometries ? 
          THREE.BufferGeometryUtils.mergeGeometries(geometries) : 
          geometries[0];
        return merged;
      }
      return mergedGeometry;
    };

    const chunks: THREE.Mesh[] = [];
    for (let cx = -RENDER_DISTANCE; cx < RENDER_DISTANCE; cx++) {
      for (let cz = -RENDER_DISTANCE; cz < RENDER_DISTANCE; cz++) {
        const chunkGeometry = createMergedChunk(cx, cz);
        const chunkMesh = new THREE.Mesh(chunkGeometry, blockMaterials.grass);
        scene.add(chunkMesh);
        chunks.push(chunkMesh);
      }
    }

    const armGroup = new THREE.Group();
    const armGeometry = new THREE.BoxGeometry(0.3, 0.8, 0.3);
    const armMaterial = new THREE.MeshLambertMaterial({ color: 0xF4A460 });
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.set(0.5, -0.5, -1);
    armGroup.add(arm);
    camera.add(armGroup);
    scene.add(camera);

    const keys: { [key: string]: boolean } = {};
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    let yaw = 0;
    let pitch = 0;
    let armSwing = 0;
    let armSwingSpeed = 0;

    const gamepadState = {
      leftStick: { x: 0, y: 0 },
      rightStick: { x: 0, y: 0 },
      buttons: new Array(16).fill(false),
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (e.code.startsWith('Digit')) {
        const slot = parseInt(e.code.replace('Digit', '')) - 1;
        if (slot >= 0 && slot < 9) setSelectedSlot(slot);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPointerLocked) return;
      yaw -= e.movementX * 0.002;
      pitch -= e.movementY * 0.002;
      pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    };

    const handleClick = () => {
      if (!isPointerLocked) {
        renderer.domElement.requestPointerLock();
      }
    };

    const handlePointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement === renderer.domElement);
    };

    const updateGamepad = () => {
      const gamepads = navigator.getGamepads();
      const gamepad = gamepads[0];
      
      if (gamepad) {
        gamepadState.leftStick.x = Math.abs(gamepad.axes[0]) > 0.1 ? gamepad.axes[0] : 0;
        gamepadState.leftStick.y = Math.abs(gamepad.axes[1]) > 0.1 ? gamepad.axes[1] : 0;
        gamepadState.rightStick.x = Math.abs(gamepad.axes[2]) > 0.1 ? gamepad.axes[2] : 0;
        gamepadState.rightStick.y = Math.abs(gamepad.axes[3]) > 0.1 ? gamepad.axes[3] : 0;

        yaw -= gamepadState.rightStick.x * 0.05;
        pitch -= gamepadState.rightStick.y * 0.05;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

        for (let i = 0; i < gamepad.buttons.length; i++) {
          gamepadState.buttons[i] = gamepad.buttons[i].pressed;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    let lastTime = performance.now();
    let frameCount = 0;
    let fpsUpdateTime = 0;

    const animate = () => {
      requestAnimationFrame(animate);
      
      const currentTime = performance.now();
      frameCount++;
      fpsUpdateTime += currentTime - lastTime;
      
      if (fpsUpdateTime >= 500) {
        setFps(Math.round((frameCount * 1000) / fpsUpdateTime));
        frameCount = 0;
        fpsUpdateTime = 0;
      }
      lastTime = currentTime;
      
      updateGamepad();

      direction.set(0, 0, 0);

      const moveSpeed = 0.15;
      const isMoving = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] || 
                      Math.abs(gamepadState.leftStick.x) > 0.1 || 
                      Math.abs(gamepadState.leftStick.y) > 0.1;

      if (keys['KeyW'] || gamepadState.leftStick.y < -0.1) direction.z = -1;
      if (keys['KeyS'] || gamepadState.leftStick.y > 0.1) direction.z = 1;
      if (keys['KeyA'] || gamepadState.leftStick.x < -0.1) direction.x = -1;
      if (keys['KeyD'] || gamepadState.leftStick.x > 0.1) direction.x = 1;

      direction.normalize();

      const forward = new THREE.Vector3(
        Math.sin(yaw),
        0,
        Math.cos(yaw)
      );
      const right = new THREE.Vector3(
        Math.sin(yaw + Math.PI / 2),
        0,
        Math.cos(yaw + Math.PI / 2)
      );

      velocity.set(0, 0, 0);
      velocity.addScaledVector(forward, -direction.z * moveSpeed);
      velocity.addScaledVector(right, direction.x * moveSpeed);

      camera.position.add(velocity);

      camera.rotation.set(pitch, yaw, 0, 'YXZ');

      if (isMoving) {
        armSwingSpeed = 0.15;
      } else {
        armSwingSpeed *= 0.9;
      }
      armSwing += armSwingSpeed;

      armGroup.rotation.x = Math.sin(armSwing) * 0.3;
      armGroup.rotation.z = Math.sin(armSwing * 0.5) * 0.1;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      canvasRef.current?.removeChild(renderer.domElement);
    };
  }, [isPointerLocked]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <div ref={canvasRef} className="w-full h-full" />
      
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20 font-mono">
        MINECRAFT DEMO v1.0
      </div>

      <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1.5 rounded backdrop-blur-sm border border-white/20 font-mono text-sm">
        <span className={fps >= 50 ? 'text-green-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400'}>
          {fps} FPS
        </span>
      </div>

      <div className="absolute top-4 left-4 flex gap-1">
        {Array.from({ length: health }).map((_, i) => (
          <div key={i} className="text-2xl">❤️</div>
        ))}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
        {inventory.map((item, index) => (
          <Card
            key={item.id}
            className={`w-14 h-14 flex items-center justify-center text-2xl cursor-pointer transition-all ${
              selectedSlot === index
                ? 'bg-white/30 border-2 border-white scale-110'
                : 'bg-black/50 border border-white/30 hover:bg-white/20'
            }`}
            onClick={() => setSelectedSlot(index)}
          >
            {item.icon}
          </Card>
        ))}
      </div>

      {!isPointerLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <Card className="p-8 bg-black/80 border-white/30 text-white text-center space-y-4">
            <h2 className="text-3xl font-bold font-mono">MINECRAFT DEMO</h2>
            <div className="space-y-2 text-left">
              <p className="flex items-center gap-2">
                <Icon name="Mouse" size={20} />
                <span>Клик — начать игру</span>
              </p>
              <p className="flex items-center gap-2">
                <Icon name="Keyboard" size={20} />
                <span>WASD — передвижение</span>
              </p>
              <p className="flex items-center gap-2">
                <Icon name="Mouse" size={20} />
                <span>Мышь — обзор</span>
              </p>
              <p className="flex items-center gap-2">
                <Icon name="Gamepad2" size={20} />
                <span>Геймпад — поддерживается</span>
              </p>
              <p className="flex items-center gap-2">
                <Icon name="Hash" size={20} />
                <span>1-9 — выбор предмета</span>
              </p>
            </div>
            <button className="mt-4 px-6 py-3 bg-white/20 hover:bg-white/30 border border-white/50 rounded text-xl font-bold transition-all">
              Нажми для старта
            </button>
          </Card>
        </div>
      )}

      {isPointerLocked && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-4 h-4">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white"></div>
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MinecraftGame;