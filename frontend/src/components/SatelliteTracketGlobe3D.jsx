import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export default function SatelliteTracketGlobe3D({ satelliteData, viewType = 'north', containerRef }) {
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const globeRef = useRef(null);
    const animationIdRef = useRef(null);

    // Initialize Three.js scene
    useEffect(() => {
        if (!containerRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0e27);
        sceneRef.current = scene;

        // Camera setup
        const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        camera.position.z = viewType === 'north' ? 3 : -3;
        camera.position.y = viewType === 'north' ? 2 : -2;
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 1.5;
        controls.maxDistance = 10;
        controlsRef.current = controls;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1, 0);
        pointLight.position.set(5, 3, 5);
        scene.add(pointLight);

        // Create Earth globe
        const globeGeometry = new THREE.SphereGeometry(1, 64, 64);
        const textureLoader = new THREE.TextureLoader();
        
        textureLoader.load(
            'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
            (texture) => {
                const globeMaterial = new THREE.MeshPhongMaterial({
                    map: texture,
                    bumpScale: 0.05,
                    specular: new THREE.Color(0x333333),
                    shininess: 15,
                });
                const globe = new THREE.Mesh(globeGeometry, globeMaterial);
                globe.name = 'earth';
                scene.add(globe);
                globeRef.current = globe;
            },
            undefined,
            (error) => {
                console.error('Error loading Earth texture:', error);
                // Fallback to solid color
                const globeMaterial = new THREE.MeshPhongMaterial({
                    color: 0x2233ff,
                    specular: new THREE.Color(0x333333),
                    shininess: 15,
                });
                const globe = new THREE.Mesh(globeGeometry, globeMaterial);
                globe.name = 'earth';
                scene.add(globe);
                globeRef.current = globe;
            }
        );

        // Animation loop
        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);
            
            // Rotate globe slowly
            const earth = scene.getObjectByName('earth');
            if (earth) {
                earth.rotation.y += 0.001;
            }
            
            controls.update();
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

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
            
            if (controlsRef.current) {
                controlsRef.current.dispose();
            }
            
            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
            
            if (containerRef.current && rendererRef.current && rendererRef.current.domElement) {
                try {
                    containerRef.current.removeChild(rendererRef.current.domElement);
                } catch (e) {
                    // Element might already be removed
                }
            }
        };
    }, [containerRef, viewType]);

    // Update trajectory when data changes
    useEffect(() => {
        if (!satelliteData || !sceneRef.current) return;

        renderTrajectoryOnGlobe();
    }, [satelliteData]);

    const renderTrajectoryOnGlobe = () => {
        const scene = sceneRef.current;
        if (!scene) return;

        // Remove existing trajectory objects
        const objectsToRemove = [];
        scene.traverse((object) => {
            if (object.userData.isTrajectory) {
                objectsToRemove.push(object);
            }
        });
        objectsToRemove.forEach(obj => {
            scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(mat => mat.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });

        const features = satelliteData?.geojson?.features;
        if (!features || features.length === 0) return;

        let currentPosition = null;

        features.forEach((feature) => {
            if (feature.geometry.type !== 'LineString') return;

            const coords = feature.geometry.coordinates;
            const segment = feature.properties?.segment;

            // Determine color
            let color;
            switch(segment) {
                case 'past':
                    color = 0x666666;
                    break;
                case 'current_visible':
                    color = 0x00ff00;
                    break;
                case 'future':
                    color = 0x0088ff;
                    break;
                default:
                    color = 0xffffff;
            }

            // Convert coordinates to 3D points
            const points = coords.map(coord => {
                const [lng, lat] = coord;
                return latLngToVector3(lat, lng, 1.01); // Slightly above surface
            });

            if (points.length < 2) return;

            // Create line geometry
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
            const line = new THREE.Line(geometry, material);
            line.userData.isTrajectory = true;
            scene.add(line);

            // Mark current position
            if (segment === 'current_visible' && points.length > 0) {
                currentPosition = points[0];
            }
        });

        // Add satellite marker and communication cone
        if (currentPosition) {
            // Satellite marker
            const markerGeometry = new THREE.SphereGeometry(0.03, 16, 16);
            const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.copy(currentPosition);
            marker.userData.isTrajectory = true;
            scene.add(marker);

            // Communication cone
            addCommunicationCone(currentPosition);
        }
    };

    const latLngToVector3 = (lat, lng, radius) => {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng + 180) * (Math.PI / 180);

        const x = -(radius * Math.sin(phi) * Math.cos(theta));
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        return new THREE.Vector3(x, y, z);
    };

    const addCommunicationCone = (position) => {
        const scene = sceneRef.current;
        if (!scene) return;

        // Create cone mesh
        const coneGeometry = new THREE.ConeGeometry(0.5, 0.8, 32);
        const coneMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        
        // Position and orient cone toward Earth center
        cone.position.copy(position);
        cone.lookAt(0, 0, 0);
        cone.rotateX(Math.PI / 2);
        cone.userData.isTrajectory = true;
        scene.add(cone);

        // Add wireframe for better visibility
        const wireframeGeometry = new THREE.ConeGeometry(0.5, 0.8, 32);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.6
        });
        const wireframeCone = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        wireframeCone.position.copy(position);
        wireframeCone.lookAt(0, 0, 0);
        wireframeCone.rotateX(Math.PI / 2);
        wireframeCone.userData.isTrajectory = true;
        scene.add(wireframeCone);
    };

    return null; // Rendering is handled via refs
}