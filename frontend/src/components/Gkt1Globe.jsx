import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export default function Gkt1Globe({ track, currentPosition, passes }) {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const animationIdRef = useRef(null);
    const earthRef = useRef(null);
    const nightLightsRef = useRef(null);
    const [texturesLoaded, setTexturesLoaded] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000011);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(
            45,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.1,
            1000
        );
        camera.position.set(0, 0, 2.5);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 1.5;
        controls.maxDistance = 5;
        controls.enablePan = false;
        controlsRef.current = controls;

        // Stars background
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 });
        
        const starsVertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            starsVertices.push(x, y, z);
        }
        
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(stars);

        // Lights
        const ambientLight = new THREE.AmbientLight(0x333333, 2);
        scene.add(ambientLight);

        // Sun light (directional)
        const sunLight = new THREE.DirectionalLight(0xffffff, 2);
        sunLight.position.set(5, 0, 0);
        scene.add(sunLight);

        // Load textures
        const textureLoader = new THREE.TextureLoader();

        // Earth with realistic texture
        const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
        
        // Load day texture (NASA Blue Marble)
        textureLoader.load(
            'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
            (dayTexture) => {
                const earthMaterial = new THREE.MeshPhongMaterial({
                    map: dayTexture,
                    specular: new THREE.Color(0x333333),
                    shininess: 5,
                });

                const earth = new THREE.Mesh(earthGeometry, earthMaterial);
                scene.add(earth);
                earthRef.current = earth;

                // Load night lights texture
                textureLoader.load(
                    'https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg',
                    (nightTexture) => {
                        const nightMaterial = new THREE.MeshBasicMaterial({
                            map: nightTexture,
                            blending: THREE.AdditiveBlending,
                            transparent: true,
                            opacity: 0.8,
                        });

                        const nightLights = new THREE.Mesh(earthGeometry.clone(), nightMaterial);
                        nightLights.scale.set(1.001, 1.001, 1.001); // Slightly larger to prevent z-fighting
                        scene.add(nightLights);
                        nightLightsRef.current = nightLights;

                        setTexturesLoaded(true);
                    },
                    undefined,
                    (error) => {
                        console.error('Error loading night texture:', error);
                        setTexturesLoaded(true); // Continue without night lights
                    }
                );
            },
            undefined,
            (error) => {
                console.error('Error loading Earth texture:', error);
                // Fallback to simple blue sphere
                const earthMaterial = new THREE.MeshPhongMaterial({
                    color: 0x2233ff,
                    specular: new THREE.Color(0x333333),
                    shininess: 5,
                });
                const earth = new THREE.Mesh(earthGeometry, earthMaterial);
                scene.add(earth);
                earthRef.current = earth;
                setTexturesLoaded(true);
            }
        );

        // Animation loop
        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);
            controls.update();
            
            // Rotate night lights with earth
            if (earthRef.current && nightLightsRef.current) {
                nightLightsRef.current.rotation.copy(earthRef.current.rotation);
            }
            
            renderer.render(scene, camera);
        };
        animate();

        // Handle resize
        const handleResize = () => {
            if (!containerRef.current) return;
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;

            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
            if (rendererRef.current && containerRef.current) {
                try {
                    containerRef.current.removeChild(rendererRef.current.domElement);
                } catch (e) {
                    // Already removed
                }
            }
            controls.dispose();
            renderer.dispose();
        };
    }, []);

    // Update visualization when data changes
    useEffect(() => {
        if (!sceneRef.current || !track || track.length === 0 || !texturesLoaded) return;

        const scene = sceneRef.current;

        // Clear previous orbit lines and markers
        const objectsToRemove = scene.children.filter(
            (obj) => obj.userData.type === 'orbit' || obj.userData.type === 'satellite'
        );
        objectsToRemove.forEach((obj) => scene.remove(obj));

        // Helper function to convert lat/lon to 3D position
        const latLonToVector3 = (lat, lon, radius = 1.02) => {
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lon + 180) * (Math.PI / 180);

            return new THREE.Vector3(
                -(radius * Math.sin(phi) * Math.cos(theta)),
                radius * Math.cos(phi),
                radius * Math.sin(phi) * Math.sin(theta)
            );
        };

        // Find current time index
        const now = new Date();
        let currentIndex = track.findIndex((point) => new Date(point.time) > now);
        if (currentIndex === -1) currentIndex = track.length;

        // Past track (solid green line)
        if (currentIndex > 1) {
            const pastPoints = track.slice(Math.max(0, currentIndex - 200), currentIndex).map((point) =>
                latLonToVector3(point.latitude, point.longitude)
            );
            
            const pastGeometry = new THREE.BufferGeometry().setFromPoints(pastPoints);
            const pastMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
            const pastLine = new THREE.Line(pastGeometry, pastMaterial);
            pastLine.userData.type = 'orbit';
            scene.add(pastLine);
        }

        // Future track (dashed orange line)
        if (currentIndex < track.length) {
            const futurePoints = track.slice(currentIndex, Math.min(track.length, currentIndex + 200)).map((point) =>
                latLonToVector3(point.latitude, point.longitude)
            );
            
            const futureGeometry = new THREE.BufferGeometry().setFromPoints(futurePoints);
            const futureMaterial = new THREE.LineDashedMaterial({
                color: 0xff9900,
                linewidth: 2,
                dashSize: 0.05,
                gapSize: 0.03,
            });
            const futureLine = new THREE.Line(futureGeometry, futureMaterial);
            futureLine.computeLineDistances();
            futureLine.userData.type = 'orbit';
            scene.add(futureLine);
        }

        // Satellite marker (stays at center by rotating Earth)
        if (currentPosition) {
            const satPos = latLonToVector3(currentPosition.latitude, currentPosition.longitude, 1.05);
            
            // Red sphere marker
            const markerGeometry = new THREE.SphereGeometry(0.025, 16, 16);
            const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.copy(satPos);
            marker.userData.type = 'satellite';
            scene.add(marker);

            // Rotate Earth so satellite appears at center
            // Calculate rotation needed to bring satellite to front center
            if (earthRef.current) {
                const targetRotation = new THREE.Euler(
                    (currentPosition.latitude * Math.PI) / 180,
                    -(currentPosition.longitude * Math.PI) / 180,
                    0
                );
                earthRef.current.rotation.copy(targetRotation);
            }

            // Label
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 64;
            context.fillStyle = 'rgba(0, 0, 0, 0.7)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.font = 'Bold 32px Arial';
            context.fillStyle = 'white';
            context.textAlign = 'center';
            context.fillText('GKT1', 128, 42);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.copy(satPos);
            sprite.position.multiplyScalar(1.15);
            sprite.scale.set(0.3, 0.075, 1);
            sprite.userData.type = 'satellite';
            scene.add(sprite);
        }

    }, [track, currentPosition, texturesLoaded]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '600px',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#000',
                position: 'relative',
            }}
        >
            {!texturesLoaded && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'white',
                    fontSize: '1.1rem',
                    zIndex: 10,
                }}>
                    Dünya haritası yükleniyor...
                </div>
            )}
        </div>
    );
}