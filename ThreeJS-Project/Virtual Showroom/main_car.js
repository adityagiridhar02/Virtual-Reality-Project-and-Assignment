import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// 1. Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333333); // Dark grey background for better contrast

// 2. Camera Setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Camera position will be set dynamically after model load

// 3. Renderer Setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true; // Enable shadow maps for realistic lighting
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

// 4. Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

// Directional light for overall illumination and shadows
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5); // Position it higher and offset
directionalLight.castShadow = true; // Enable shadow casting
directionalLight.shadow.mapSize.width = 1024; // Resolution of shadow map
directionalLight.shadow.mapSize.height = 1024; // Higher resolution for sharper shadows
directionalLight.shadow.camera.near = 0.5; // Near plane of shadow camera
directionalLight.shadow.camera.far = 50;  // Far plane
directionalLight.shadow.camera.left = -10; // Adjust shadow camera bounds to cover the scene
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
scene.add(directionalLight);

// Optional: Add another light to illuminate from another angle (no shadows for performance)
const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight.position.set(-5, 3, -2).normalize();
scene.add(fillLight);

// Add a spotlight, common for showrooms to highlight cars
const spotLight = new THREE.SpotLight(0xffffff, 1.5);
spotLight.position.set(0, 10, 0); // Directly above the car
spotLight.angle = Math.PI / 8; // Narrow beam
spotLight.penumbra = 0.5; // Soft edges
spotLight.decay = 2; // Light intensity falls off with distance
spotLight.distance = 20;
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 1024;
spotLight.shadow.mapSize.height = 1024;
scene.add(spotLight);
// scene.add(new THREE.SpotLightHelper(spotLight)); // Uncomment to see the spotlight helper

// 5. OrbitControls (will be initialized after model load to set target)
let controls;

// 6. GLTF Loader
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);

loader.setPath('/car/source/'); // Base path for car model assets
const carModelPath = 'car.glb';

// Load an HDRI (Environment Map) for reflections
new RGBELoader()
    .setPath('https://static.threejs.org/examples/textures/equirectangular/')
    .load('venice_sunset_1k.hdr', function (texture) { // Example HDRI
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture; // Set as environment map for reflections
        // scene.background = texture; // Optional: use the HDRI as background
    });

loader.load(
    carModelPath,
    function (gltf) {
        const car = gltf.scene;
        scene.add(car);

        // Calculate bounding box to center and scale the car, and position the camera
        const box = new THREE.Box3().setFromObject(car);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Adjust car position so its base is at Y=0 (or slightly above for a floor)
        car.position.y -= (center.y - size.y / 2); // Shifts the car up so its bottom is at Y=0

        // Scale the car to a reasonable size (e.g., make the longest dimension fit within 3-4 units)
        const maxDim = Math.max(size.x, size.y, size.z);
        const desiredSize = 3; // e.g., car is about 3 units long/tall/wide
        const scaleFactor = desiredSize / maxDim;
        car.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // Recalculate box after scaling for accurate camera placement
        box.setFromObject(car);
        box.getCenter(center);
        box.getSize(size);

        // Camera positioning based on model size
        const fov = camera.fov * (Math.PI / 180); // convert fov to radians
        const cameraZ = Math.abs(size.z / 2 / Math.tan(fov / 2)); // Distance to view the whole car
        camera.position.set(center.x, center.y + size.y / 4, center.z + cameraZ * 1.5); // Slightly above and further back

        // Set OrbitControls target to the car's center
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.target.copy(center); // Set orbit target to the car's center
        controls.update(); // Update controls to apply the new target

        // Traverse and refine materials for better car look
        car.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                // This model typically uses MeshStandardMaterial.
                // We can enhance its appearance for car paint.
                if (child.material && child.material.isMeshStandardMaterial) {
                    // Example: Adjust the main body material for a more metallic/glossy look
                    // You might need to inspect child.name to target specific parts
                    // console.log(child.name, child.material.name); // Use this to find names
                    if (child.material.name.includes('MaterialColor') || child.name.includes('Body')) {
                        child.material.metalness = 0.9; // High metalness for car paint
                        child.material.roughness = 0.2; // Low roughness for shine
                        // Optional: If you want a clear coat effect
                        // child.material = new THREE.MeshPhysicalMaterial().copy(child.material);
                        // child.material.clearcoat = 1.0;
                        // child.material.clearcoatRoughness = 0.05;
                        child.material.needsUpdate = true;
                    }
                }
            }
        });

        console.log('Car model loaded successfully:', car);
    },
    function (xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded of car model');
    },
    function (error) {
        console.error('An error happened during car model loading:', error);
    }
);

// 7. Animation Loop
function animate() {
    requestAnimationFrame(animate);
    if (controls) { // Only update controls once they are initialized
        controls.update();
    }
    renderer.render(scene, camera);
}

// 8. Handle Window Resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the animation
animate();