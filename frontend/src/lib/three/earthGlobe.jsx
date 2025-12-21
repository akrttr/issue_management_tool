import * as THREE from 'three';

export function createEarth(scene) {
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Load Earth texture (using a simple approach with canvas)
    const canvas = createEarthTexture();
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    const material = new THREE.MeshPhongMaterial({
        map: texture,
        bumpScale: 0.005,
        specular: new THREE.Color('#333333'),
        shininess: 5,
    });

    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    return earth;
}

function createEarthTexture() {
    // Create a simple Earth-like texture using canvas
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Base ocean color
    ctx.fillStyle = '#1a4d7a';
    ctx.fillRect(0, 0, size, size);
    
    // Add continents (simplified - you can replace with actual texture)
    ctx.fillStyle = '#2d5a2d';
    
    // Simple continent approximations
    // North America
    drawContinent(ctx, size, 0.15, 0.3, 0.15, 0.25);
    // South America
    drawContinent(ctx, size, 0.22, 0.55, 0.08, 0.2);
    // Europe/Asia
    drawContinent(ctx, size, 0.5, 0.3, 0.35, 0.25);
    // Africa
    drawContinent(ctx, size, 0.52, 0.5, 0.12, 0.2);
    // Australia
    drawContinent(ctx, size, 0.75, 0.65, 0.08, 0.08);
    
    return canvas;
}

function drawContinent(ctx, size, x, y, w, h) {
    ctx.beginPath();
    const centerX = x * size;
    const centerY = y * size;
    const width = w * size;
    const height = h * size;
    
    // Draw irregular shape
    ctx.ellipse(centerX, centerY, width, height, 0, 0, Math.PI * 2);
    ctx.fill();
}

export function createOrbitLine(scene, points, color = 0x00ff00, dashed = false) {
    if (!points || points.length < 2) return null;

    const positions = new Float32Array(points.length * 3);
    
    points.forEach((point, i) => {
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    let material;
    if (dashed) {
        material = new THREE.LineDashedMaterial({
            color: color,
            linewidth: 2,
            dashSize: 0.05,
            gapSize: 0.03,
        });
    } else {
        material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
    }

    const line = new THREE.Line(geometry, material);
    
    if (dashed) {
        line.computeLineDistances();
    }

    scene.add(line);
    return line;
}

export function createSatelliteMarker(scene, position, label = 'GKT1') {
    const geometry = new THREE.SphereGeometry(0.02, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(geometry, material);
    
    marker.position.set(position.x, position.y, position.z);
    scene.add(marker);

    return marker;
}

export function createDayNightShading(scene, sunDirection) {
    // Create a hemisphere light for day/night effect
    const skyColor = 0xffffff;
    const groundColor = 0x000000;
    const intensity = 1;
    
    const hemiLight = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    scene.add(hemiLight);
    
    return hemiLight;
}

export function latLonToCartesian(lat, lon, radius = 1) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    return {
        x: -(radius * Math.sin(phi) * Math.cos(theta)),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta),
    };
}

export function setupLights(scene) {
    // Ambient light (low intensity for night side)
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);

    // Directional light (sun) - position represents sun direction
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    
    // Calculate sun position based on current UTC time
    const now = new Date();
    const dayOfYear = getDayOfYear(now);
    const hourOfDay = now.getUTCHours() + now.getUTCMinutes() / 60;
    
    // Sun longitude (rotates 360° in 24 hours)
    const sunLon = (hourOfDay / 24) * 360 - 180;
    
    // Sun latitude (simplified - varies with season, ~23.5° tilt)
    const sunLat = 23.5 * Math.sin((dayOfYear - 81) * (Math.PI / 182.5));
    
    const sunPos = latLonToCartesian(sunLat, sunLon, 5);
    sunLight.position.set(sunPos.x, sunPos.y, sunPos.z);
    scene.add(sunLight);

    return { ambientLight, sunLight };
}

function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

export function updateSunPosition(sunLight) {
    // Update sun position based on current time
    const now = new Date();
    const dayOfYear = getDayOfYear(now);
    const hourOfDay = now.getUTCHours() + now.getUTCMinutes() / 60;
    
    const sunLon = (hourOfDay / 24) * 360 - 180;
    const sunLat = 23.5 * Math.sin((dayOfYear - 81) * (Math.PI / 182.5));
    
    const sunPos = latLonToCartesian(sunLat, sunLon, 5);
    sunLight.position.set(sunPos.x, sunPos.y, sunPos.z);
}