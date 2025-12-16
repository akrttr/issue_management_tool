import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export default function Globe3D({ satelliteData, viewType = 'north', containerRef }) {
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const globeRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0e27);
        sceneRef.current = scene;

        // Camera setup
        const camera = new THREE.PerspectiveCamera(
            45,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.1,
            1000
        );
        camera.position.z = viewType === 'north' ? 3 : -3;
        camera.position.y = viewType === 'north' ? 2 : -2;
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
        controls.enableZoom = true;
        controlsRef.current = controls;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 0.8);
        pointLight.position.set(5, 5, 5);
        scene.add(pointLight);

        // Create Earth globe
        const globeGeometry = new THREE.SphereGeometry(1, 64, 64);
        
        // Load Earth texture
        const textureLoader = new THREE.TextureLoader();
        const earthTexture = textureLoader.load(
            'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
        );
        
        const globeMaterial = new THREE.MeshPhongMaterial({
            map: earthTexture,
            bumpScale: 0.05,
            specular: new THREE.Color('grey'),
            shininess: 5
        });

        const globe = new THREE.Mesh(globeGeometry, globeMaterial);
        scene.add(globe);
        globeRef.current = globe;

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            
            // Rotate globe slowly
            if (globeRef.current) {
                globeRef.current.rotation.y += 0.001;
            }
            
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Handle resize
        const handleResize = () => {
            if (!containerRef.current) return;
            
            camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (containerRef.current && rendererRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement);
            }
            renderer.dispose();
        };
    }, [containerRef, viewType]);

    // Update trajectory when data changes
    useEffect(() => {
        if (!satelliteData || !sceneRef.current) return;

        renderTrajectoryOnGlobe(satelliteData);
    }, [satelliteData]);

    const renderTrajectoryOnGlobe = (data) => {
        // Remove existing trajectory lines
        sceneRef.current.children
            .filter(child => child.userData.isTrajectory)
            .forEach(child => sceneRef.current.remove(child));

        const features = data.geojson.features;

        features.forEach((feature) => {
            const coords = feature.geometry.coordinates;
            const segment = feature.properties.segment;

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
            }

            // Convert lat/lng to 3D coordinates
            const points = coords.map(coord => {
                const [lng, lat] = coord;
                return latLngToVector3(lat, lng, 1.01); // Slightly above surface
            });

            // Create line
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
            const line = new THREE.Line(geometry, material);
            line.userData.isTrajectory = true;
            sceneRef.current.add(line);

            // Add satellite marker for current position
            if (segment === 'current_visible' && points.length > 0) {
                const satelliteGeometry = new THREE.SphereGeometry(0.02, 16, 16);
                const satelliteMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                const satellite = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
                satellite.position.copy(points[0]);
                satellite.userData.isTrajectory = true;
                sceneRef.current.add(satellite);

                // Add communication cone
                addCommunicationCone(points[0]);
            }
        });
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
        // Create a cone mesh to represent the communication footprint
        const coneGeometry = new THREE.ConeGeometry(0.5, 0.8, 32);
        const coneMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        
        // Position and orient cone
        cone.position.copy(position);
        cone.lookAt(0, 0, 0);
        cone.rotateX(Math.PI);
        cone.userData.isTrajectory = true;
        
        sceneRef.current.add(cone);

        // Add cone wireframe
        const wireframe = new THREE.WireframeGeometry(coneGeometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 1 });
        const line = new THREE.LineSegments(wireframe, lineMaterial);
        line.position.copy(position);
        line.lookAt(0, 0, 0);
        line.rotateX(Math.PI);
        line.userData.isTrajectory = true;
        sceneRef.current.add(line);
    };

    return null; // Rendering is handled via refs
}