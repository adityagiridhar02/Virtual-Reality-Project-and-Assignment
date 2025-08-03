import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

//const rgbeLoader = new THREE.RGBELoader(); 
let currentCarForPurchase = null;
// --- Core Three.js Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

// --- ADD THESE LINES FOR CAR AUDIO SETUP (Updated Variable Names) ---
const carAudioListener = new THREE.AudioListener(); // Dedicated listener for car audio
camera.add(carAudioListener); // Make the camera hear car sounds

const carAudioLoader = new THREE.AudioLoader(); // Dedicated loader for car audio
const controls = new PointerLockControls(camera, document.body);

const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
// --- END CAR AUDIO SETUP ---
const showroomWidth = 30;
const showroomDepth = 40;
const showroomHeight = 8;
const doorClosedPositionX = showroomWidth / 2; // X position of the doorway
const doorOpenPositionOffset = 2.5; // How far each door slides open
const doorSpeed = 1.0; // Speed of door animation
// NEW: New Room Dimensions
const newRoomWidth = 30; // Extend further in X
const newRoomDepth = 20; // Similar depth to main room
const newRoomOffsetX = showroomWidth / 2 + newRoomWidth / 2; // Position next to current room (slight overlap for seamless connection)
// NEW: Doorway Dimensions
const doorwayWidth = 6; // Width of the door opening
const doorwayHeight = 4; // Height of the door opening
const doorwayYOffset = showroomHeight / 2 - doorwayHeight / 2;

// --- Showroom Boundaries for Collision Detection ---
const minX = -showroomWidth / 2 + 0.5;
const maxX = showroomWidth / 2 + newRoomWidth - 0.5;
const minZ = -showroomDepth / 2 + 0.5;
const maxZ = showroomDepth / 2 - 0.5;
const eyeLevel = 1.8;
// --- Showroom Materials ---
const floorTextureCanvas = document.createElement('canvas');
const context = floorTextureCanvas.getContext('2d');

const tileSize = 64;
const redTile = '#a00505ff';   // Muted red
const blackTile = '#030303ff'; // Black
const floorTexture = new THREE.CanvasTexture(floorTextureCanvas);
const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorTexture,
    color: 0x000000,
    roughness: 0,
    metalness: 1.0
});

const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666, // Steel Blue
    roughness: 0.7,
    metalness: 0.1,
    side: THREE.DoubleSide
});

const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: 0xF0F0F0, // Lighter grey (almost white)
    roughness: 0.6,
    metalness: 0.1
});

// --- Showroom Construction ---
const floorGeometry = new THREE.PlaneGeometry(showroomWidth, showroomDepth);
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
const backWallGeometry = new THREE.PlaneGeometry(showroomWidth, showroomHeight);
const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);


const frontWallLeftGeometry = new THREE.PlaneGeometry(showroomWidth / 3, showroomHeight);
const frontWallLeft = new THREE.Mesh(frontWallLeftGeometry, wallMaterial);
const frontWallRightGeometry = new THREE.PlaneGeometry(showroomWidth / 3, showroomHeight);
const frontWallRight = new THREE.Mesh(frontWallRightGeometry, wallMaterial);
const leftWallGeometry = new THREE.PlaneGeometry(showroomDepth, showroomHeight);
const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.useLegacyLights = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.8;

// --- PointerLockControls Setup ---


instructions.addEventListener('click', function () {
    controls.lock();
});

controls.addEventListener('lock', function () {
    instructions.style.display = 'none';
    blocker.style.display = 'none';
    // Hide all UI when locked
    hideAllUI();
});

controls.addEventListener('unlock', function () {
    blocker.style.display = 'flex';
    instructions.style.display = 'block';
    // Hide all UI when unlocked (e.g., if re-locking)
    hideAllUI();
    resetPurchaseState(); // Also reset purchase state if unlocked
});

// ... existing global variables ...

let isCarStarted = false; // Flag to track if the car engine is started
let carStartupSound; // To hold the car startup audio object (no change needed here, already specific)
// ...

// ... existing global variables (e.g., isInsideCar, previousCameraPosition, etc.) ...

let previousPlayerRotationY = 0; 
let isCollisionDisabled = false; // NEW: Flag to control collision detection
let isInsideCar = false;
let previousCameraPosition = new THREE.Vector3();
// --- Movement Variables ---
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isRunning = false;
// NEW: Declare velocity and direction vectors, and movement speeds
const velocity = new THREE.Vector3(); // For player movement
const direction = new THREE.Vector3(); // For player movement direction
const baseSpeed = 30.0; // Base movement speed
const runMultiplier = 3.0; // Multiplier for running speed

let prevTime = performance.now();


// --- Showroom Dimensions ---

// NEW: Door Variables
let slidingDoorLeft;
let slidingDoorRight;

let foundDoorZone = false; // Flag to track if player is in door zone
let isDoorOpen = false; // Flag to track current door state


// Set initial camera position inside the showroom, away from car spawn
camera.position.set(0, eyeLevel, showroomDepth / 2 - 5);


floorTextureCanvas.width = 512;
floorTextureCanvas.height = 512;


for (let y = 0; y < floorTextureCanvas.height / tileSize; y++) {
    for (let x = 0; x < floorTextureCanvas.width / tileSize; x++) {
        context.fillStyle = ((x + y) % 2 === 0) ? redTile : blackTile;
        context.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
}


floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(showroomWidth / (tileSize / 8), showroomDepth / (tileSize / 8));
floorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();


floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);


backWall.position.set(0, showroomHeight / 2, -showroomDepth / 2);
backWall.receiveShadow = true;
scene.add(backWall);

frontWallLeft.position.set(-showroomWidth / 3, showroomHeight / 2, showroomDepth / 2);
frontWallLeft.rotation.y = Math.PI;
frontWallLeft.receiveShadow = true;
scene.add(frontWallLeft);


frontWallRight.position.set(showroomWidth / 3, showroomHeight / 2, showroomDepth / 2);
frontWallRight.rotation.y = Math.PI;
frontWallRight.receiveShadow = true;
scene.add(frontWallRight);


leftWall.position.set(-showroomWidth / 2, showroomHeight / 2, 0);
leftWall.rotation.y = Math.PI / 2;
leftWall.receiveShadow = true;
scene.add(leftWall);

const rightWallGeometry = new THREE.PlaneGeometry(showroomDepth, showroomHeight);
// **MODIFIED:** Right Wall to include a doorway
// Right Wall - Left Section of Doorway
const rightWallLeftGeometry = new THREE.PlaneGeometry((showroomDepth - doorwayWidth) / 2, showroomHeight);
const rightWallLeft = new THREE.Mesh(rightWallLeftGeometry, wallMaterial);
rightWallLeft.position.set(
    showroomWidth / 2,
    showroomHeight / 2,
    -doorwayWidth / 2 - (showroomDepth - doorwayWidth) / 4 // Position to the left of the doorway
);
rightWallLeft.rotation.y = -Math.PI / 2;
rightWallLeft.receiveShadow = true;
scene.add(rightWallLeft);

// Right Wall - Right Section of Doorway
const rightWallRightGeometry = new THREE.PlaneGeometry((showroomDepth - doorwayWidth) / 2, showroomHeight);
const rightWallRight = new THREE.Mesh(rightWallRightGeometry, wallMaterial);
rightWallRight.position.set(
    showroomWidth / 2,
    showroomHeight / 2,
    doorwayWidth / 2 + (showroomDepth - doorwayWidth) / 4 // Position to the right of the doorway
);
rightWallRight.rotation.y = -Math.PI / 2;
rightWallRight.receiveShadow = true;
scene.add(rightWallRight);

// Right Wall - Lintel (above the doorway)
const rightWallLintelGeometry = new THREE.PlaneGeometry(doorwayWidth, showroomHeight - doorwayHeight);
const rightWallLintel = new THREE.Mesh(rightWallLintelGeometry, wallMaterial);
rightWallLintel.position.set(
    showroomWidth / 2,
    showroomHeight - (showroomHeight - doorwayHeight) / 2, // Position above the doorway
    0
);
rightWallLintel.rotation.y = -Math.PI / 2;
rightWallLintel.receiveShadow = true;
scene.add(rightWallLintel);


const ceilingGeometry = new THREE.PlaneGeometry(showroomWidth, showroomDepth);
const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
ceiling.position.y = showroomHeight;
ceiling.rotation.x = Math.PI / 2;
ceiling.receiveShadow = true;
scene.add(ceiling);




// --- Lighting Setup ---

RectAreaLightUniformsLib.init();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const mainDirectionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
mainDirectionalLight.position.set(10, 15, 10);
mainDirectionalLight.castShadow = true;
mainDirectionalLight.shadow.mapSize.width = 2048;
mainDirectionalLight.shadow.mapSize.height = 2048;
mainDirectionalLight.shadow.camera.near = 0.1;
mainDirectionalLight.shadow.camera.far = 50;
mainDirectionalLight.shadow.camera.left = -showroomWidth / 2 - 5;
mainDirectionalLight.shadow.camera.right = showroomWidth / 2 + 5;
mainDirectionalLight.shadow.camera.top = showroomDepth / 2 + 5;
mainDirectionalLight.shadow.camera.bottom = -showroomDepth / 2 - 5;
mainDirectionalLight.shadow.bias = -0.0001;
scene.add(mainDirectionalLight);

const rectLightColor = 0xffffff;
const rectLightIntensity = 8;

const rectLight1 = new THREE.RectAreaLight(rectLightColor, rectLightIntensity, 5, 2);
rectLight1.position.set(-showroomWidth / 4, showroomHeight - 0.1, -showroomDepth / 4);
rectLight1.lookAt(rectLight1.position.x, 0, rectLight1.position.z);
scene.add(rectLight1);

const rectLight2 = new THREE.RectAreaLight(rectLightColor, rectLightIntensity, 5, 2);
rectLight2.position.set(showroomWidth / 4, showroomHeight - 0.1, -showroomDepth / 4);
rectLight2.lookAt(rectLight2.position.x, 0, rectLight2.position.z);
scene.add(rectLight2);

const rectLight3 = new THREE.RectAreaLight(rectLightColor, rectLightIntensity, 5, 2);
rectLight3.position.set(-showroomWidth / 4, showroomHeight - 0.1, showroomDepth / 4);
rectLight3.lookAt(rectLight3.position.x, 0, rectLight3.position.z);
scene.add(rectLight3);

const rectLight4 = new THREE.RectAreaLight(rectLightColor, rectLightIntensity, 5, 2);
rectLight4.position.set(showroomWidth / 4, showroomHeight - 0.1, showroomDepth / 4);
rectLight4.lookAt(rectLight4.position.x, 0, rectLight4.position.z);
scene.add(rectLight4);

const spotLight1 = new THREE.SpotLight(0xffffff, 4);
spotLight1.position.set(0, showroomHeight * 0.8, 0);
spotLight1.target.position.set(0, 0, 0);
spotLight1.angle = Math.PI / 8;
spotLight1.penumbra = 0.7;
spotLight1.decay = 1.5;
spotLight1.distance = 25;
spotLight1.castShadow = true;
spotLight1.shadow.mapSize.width = 1024;
spotLight1.shadow.mapSize.height = 1024;
spotLight1.shadow.bias = -0.0001;
scene.add(spotLight1);
scene.add(spotLight1.target);

const spotLight2 = new THREE.SpotLight(0xffffff, 3.5);
spotLight2.position.set(-showroomWidth / 3, showroomHeight * 0.7, -showroomDepth / 6);
spotLight2.target.position.set(-showroomWidth / 3, 0, -showroomDepth / 6);
spotLight2.angle = Math.PI / 7;
spotLight2.penumbra = 0.6;
spotLight2.decay = 1.8;
spotLight2.distance = 20;
spotLight2.castShadow = true;
spotLight2.shadow.mapSize.width = 1024;
spotLight2.shadow.mapSize.height = 1024;
spotLight2.shadow.bias = -0.0001;
scene.add(spotLight2);
scene.add(spotLight2.target);

const spotLight3 = new THREE.SpotLight(0xffffff, 3.5);
spotLight3.position.set(showroomWidth / 3, showroomHeight * 0.7, -showroomDepth / 6);
spotLight3.target.position.set(showroomWidth / 3, 0, -showroomDepth / 6);
spotLight3.angle = Math.PI / 7;
spotLight3.penumbra = 0.6;
spotLight3.decay = 1.8;
spotLight3.distance = 20;
spotLight3.castShadow = true;
spotLight3.shadow.mapSize.width = 1024;
spotLight3.shadow.mapSize.height = 1024;
spotLight3.shadow.bias = -0.0001;
scene.add(spotLight3);
scene.add(spotLight3.target);


// --- Global array to hold all rotating platforms ---
const rotatingPlatforms = [];
const platformRadius = 4.5;
const platformHeight = 0.2;
const defaultPlatformSpeed = 0.05; // Renamed for clarity and reusability

// Variables for proximity-based speed
const raycaster = new THREE.Raycaster(); // Still used for debug or specific interactions, but not for general proximity
const cameraDirection = new THREE.Vector3(); // Re-use this vector
const interactSpeedMultiplier = 3.0; // How much faster it gets (e.g., 3x normal speed)

// GLTF and Draco Loaders (instantiated once)
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
gltfLoader.setDRACOLoader(dracoLoader);
const rgbeLoader = new RGBELoader(); 

// --- Car Audio Loading ---
carAudioLoader.load(
    'joined.mp3', // <--- IMPORTANT: Replace with the actual path to your startup sound file
    function(buffer) {
        carStartupSound = new THREE.Audio(carAudioListener);
        carStartupSound.setBuffer(buffer);
        carStartupSound.setVolume(0.8);
        console.log('Car startup sound loaded!');
    },
    function(xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded (car startup sound)');
    },
    function(error) {
        console.error('An error occurred loading the car startup sound:', error);
    }
);


// Animation Mixer for the scene (for custom animation actions)
const mixers = []; // Keep a list of mixers, one per carGroup for better isolation
const clock = new THREE.Clock(); // For delta time

// --- UI Elements References (NEW) ---
const UI_elements = {
    purchasePrompt: document.getElementById('purchasePrompt'),
    carNameForPurchase: document.getElementById('carNameForPurchase'),
    carPriceForPurchase: document.getElementById('carPriceForPurchase'),
    billingPrompt: document.getElementById('billingPrompt'),
    billingTotalText: document.getElementById('billingTotalText'),
    purchaseConfirmation: document.getElementById('purchaseConfirmation'),
    purchaseDeclined: document.getElementById('purchaseDeclined')
};


let carIdleSound; // To hold the looping idle audio object

// --- HDRI Environment Loading ---
rgbeLoader.load(
    'park.hdr',
    function (texture) {
        // This line tells Three.js how to interpret the HDRI image data for reflections.
        texture.mapping = THREE.EquirectangularReflectionMapping;

        // This is the magic line: it tells your scene to use this HDRI for ambient lighting and reflections.
        scene.environment = texture;

        // Optional: Set the HDRI as the background of your scene as well.
        // If you already have a custom background or skybox, you might omit this line.
        scene.background = texture;

        console.log('HDRI environment loaded successfully!');
    },
    // --- Progress Callback (optional, but good for debugging) ---
    function (xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded (HDRI)');
    },
    // --- Error Callback (essential for debugging!) ---
    function (error) {
        console.error('An error occurred loading the HDri environment:', error);
        // This is where you'll see messages if the file path is wrong or the file is corrupted.
    }
);
// --- END HDRI Environment Loading ---

// --- Purchase State Variables (NEW) ---
 // Stores the platform object of the car being considered
let currentCarPrice = 0;
let currentCarName = '';
let isNearBillingCounter = false;
let isCarSelectedForPurchase = false; // True if 'I' has been pressed for a car
let hasConfirmedPurchase = false; // To show confirmation message for a duration

// --- Trigger Zones (NEW) ---
// We'll create invisible meshes that act as trigger zones
const triggerZones = [];
const carTriggerZoneSize = new THREE.Vector3(10, 5, 10); // A generous area around the car platform
const billingZoneSize = new THREE.Vector3(5, 4, 5); // Size for billing counter interaction zone

/**
 * Creates an invisible trigger zone.
 * @param {THREE.Vector3} position - Center position of the trigger zone.
 * @param {THREE.Vector3} size - Dimensions of the trigger zone.
 * @param {string} type - Type of zone (e.g., 'carPurchase', 'billingCounter').
 * @param {Object} [data={}] - Additional data to store (e.g., car details, reference to platform).
 * @returns {THREE.Mesh} The created trigger zone mesh.
 */
function createTriggerZone(position, size, type, data = {}) {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshBasicMaterial({ visible: false }); // Invisible
    const zone = new THREE.Mesh(geometry, material);
    zone.position.copy(position);
    zone.userData = { type: type, ...data };
    scene.add(zone);
    triggerZones.push(zone);
    return zone;
}

// --- UI Management Helper (NEW) ---
function hideAllUI() {
    UI_elements.purchasePrompt.style.display = 'none';
    UI_elements.billingPrompt.style.display = 'none';
    UI_elements.purchaseConfirmation.style.display = 'none';
    UI_elements.purchaseDeclined.style.display = 'none';
}

/**
 * Creates and adds a car display (platform + car + description board) to the scene.
 * @param {string} modelPath The path to the GLB model (e.g., 'car/source/car.glb').
 * @param {number} platformX X position of the platform.
 * @param {number} platformZ Z position of the platform.
 * @param {string[]} descriptionLines Array of strings for the description board.
 * @param {number} carPrice Price of the car (NEW).
 * @param {string} carName Name of the car (NEW).
 * @param {number} [scale=1.0] Optional scale for the car model.
 * @param {number} [initialRotationY=Math.PI] Optional initial Y-rotation for the car on its platform.
 * @param {string} [wallPlacement='back'] Specifies which wall to place the banner on ('back', 'left', 'right', 'front').
 */
function createCarDisplay(modelPath, platformX, platformZ, descriptionLines, carPrice, carName, scale = 1.0, initialRotationY = Math.PI, wallPlacement = 'back', inNewRoom = false,cameraInteriorOffset,cameraInteriorRotationY ) {
    // 1. Create the rotating platform
    const platformGeometry = new THREE.CylinderGeometry(platformRadius, platformRadius, platformHeight, 32);
    const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff, // Dark grey for contrast
        roughness: 0.05,
        metalness: 1.0,
        envMap: scene.environment, // Make it reflective
        envMapIntensity: 1.0
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.set(platformX, platformHeight / 2, platformZ); // Position its center correctly
    platform.castShadow = true;
    platform.receiveShadow = true;
    
    // Add custom userData to identify this as a car platform and store its individual speed
    platform.userData = {
        isCarPlatform: true,
        currentRotationSpeed: defaultPlatformSpeed, // Each platform has its own speed state
        carPrice: carPrice, // Store car price
        carName: carName, // Store car name
        cameraInteriorOffset: cameraInteriorOffset,       // Store the passed offset
        cameraInteriorRotationY: cameraInteriorRotationY
    };
    
    scene.add(platform);
    rotatingPlatforms.push(platform); // Add to our array for animation
    platform.userData.collisionRadius = platformRadius + 0.01;
    createTriggerZone(
        new THREE.Vector3(platformX, eyeLevel, platformZ), // Centered on the platform horizontally, at eye level vertically
        carTriggerZoneSize, // Use defined size
        'carPurchase',
        { carPlatform: platform } // Reference to the actual platform object
    );

    // NEW: Create a trigger zone for this car
    createTriggerZone(
        new THREE.Vector3(platformX, eyeLevel, platformZ), // Centered on the platform horizontally, at eye level vertically
        carTriggerZoneSize, // Use defined size
        'carPurchase',
        { carPlatform: platform } // Reference to the actual platform object
    );

    // 2. Load the car model
    gltfLoader.load(
        modelPath,
        function (gltf) {
            const car = gltf.scene;
            car.scale.set(scale, scale, scale); // Apply provided scale

            // Create an outer group to control the car's position and rotation
            // This is the group we will animate to force position/rotation.
            const carGroup = new THREE.Group();

            // Calculate bounding box of the car AFTER scaling
            const box = new THREE.Box3().setFromObject(car);
            const center = new THREE.Vector3();
            box.getCenter(center);
            const size = new THREE.Vector3();
            box.getSize(size);

            // Calculate the exact offset needed for centering and floor placement
            // This offset is applied to the 'car' object *within* the 'carGroup'
            const offsetX = -center.x;
            const offsetY = (platformHeight / 2) - box.min.y; // Position the car's base on the platform
            const offsetZ = -center.z;

            // Apply these offsets directly to the car's position
            car.position.set(offsetX, offsetY, offsetZ);
            car.rotation.y = initialRotationY; // Apply initial rotation

            // Add the car to the carGroup
            carGroup.add(car);
            
            // Add the carGroup to the platform (carGroup's position relative to platform is 0,0,0)
            platform.add(carGroup);

            // ---- Attempt to cancel internal GLTF animations if they exist ----
            if (gltf.animations && gltf.animations.length) {
                console.warn(`GLTF for ${modelPath} has embedded animations. Attempting to stop them.`);
                const tempMixer = new THREE.AnimationMixer(car); // Mixer attached directly to the car
                gltf.animations.forEach( ( clip ) => {
                    tempMixer.clipAction( clip ).stop(); // Stop all actions
                    // We don't need to update this mixer, as its purpose is just to stop the initial state.
                });
            }

            // Enable shadows and apply environment map to car's materials
            car.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
                            child.material.envMap = scene.environment;
                            child.material.envMapIntensity = 1.0;
                        } else {
                            child.material.envMap = scene.environment;
                            child.material.envMapIntensity = 1.0;
                        }
                        child.material.needsUpdate = true;
                    }
                }
            });
            
            console.log(`Loaded ${modelPath} at (${platformX}, ${platformZ}) with carGroup setup.`);
        },
        function (xhr) {
            // console.log((xhr.loaded / xhr.total * 100) + '% loaded: ' + modelPath);
        },
        function (error) {
            console.error(`An error occurred while loading ${modelPath}:`, error);
        }
    );

    // 3. Create the description banner (now on the wall)
    const bannerWidth = 3.0; // Slightly wider for banner feel
    const bannerHeight = 2.0; // Taller
    const bannerYPosition = showroomHeight * 0.7; // Higher up on the wall

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 341; // Adjust canvas aspect ratio for banner look (e.g., 512x341 is 3:2)
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 40px Arial'; // Larger font for banners
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let yPos = 30; // Starting Y position for text
    const lineHeight = 50; // Spacing between lines
    descriptionLines.forEach(line => {
        ctx.fillText(line, canvas.width / 2, yPos);
        yPos += lineHeight;
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide // Can be seen from both sides if wanted
    });

    const geometry = new THREE.PlaneGeometry(bannerWidth, bannerHeight);
    const descriptionBanner = new THREE.Mesh(geometry, material);

    // Position and rotate based on wallPlacement
    let bannerX, bannerZ, bannerRotationY;

    // Determine the position relative to the car's platformX and platformZ
    // And which wall it should be on.
    const wallOffset = 0.1; // Small offset from the wall surface

    if (inNewRoom) {
        // Logic for cars in the NEW room
        switch (wallPlacement) {
            case 'back': // Back wall of the NEW room
                bannerX = platformX;
                bannerZ = -newRoomDepth / 2 + wallOffset;
                bannerRotationY = 0; // Faces towards positive Z
                break;
            case 'front': // Front wall of the NEW room
                bannerX = platformX;
                bannerZ = newRoomDepth / 2 - wallOffset;
                bannerRotationY = Math.PI; // Faces towards negative Z
                break;
            case 'left': // Left wall of the NEW room
                bannerX = newRoomOffsetX - newRoomWidth / 2 + wallOffset;
                bannerZ = platformZ;
                bannerRotationY = Math.PI / 2; // Faces towards positive X
                break;
            case 'right': // Right wall of the NEW room
                bannerX = newRoomOffsetX + newRoomWidth / 2 - wallOffset;
                bannerZ = platformZ;
                bannerRotationY = -Math.PI / 2; // Faces towards negative X
                break;
            default: // Default to new room's back wall if unrecognized
                bannerX = platformX;
                bannerZ = -newRoomDepth / 2 + wallOffset;
                bannerRotationY = 0;
                break;
        }
    } else {
        // Original logic for cars in the FIRST room
        switch (wallPlacement) {
            case 'back':
                bannerX = platformX;
                bannerZ = -showroomDepth / 2 + wallOffset;
                bannerRotationY = 0;
                break;
            case 'front':
                bannerX = platformX;
                bannerZ = showroomDepth / 2 - wallOffset;
                bannerRotationY = Math.PI;
                break;
            case 'left':
                bannerX = -showroomWidth / 2 + wallOffset;
                bannerZ = platformZ;
                bannerRotationY = Math.PI / 2;
                break;
            case 'right':
                bannerX = showroomWidth / 2 - wallOffset;
                bannerZ = platformZ;
                bannerRotationY = -Math.PI / 2;
                break;
            default: // Default to first room's back wall if unrecognized
                bannerX = platformX;
                bannerZ = -showroomDepth / 2 + wallOffset;
                bannerRotationY = 0;
                break;
        }
    }

    descriptionBanner.position.set(bannerX, bannerYPosition, bannerZ);
    descriptionBanner.rotation.y = bannerRotationY;
    descriptionBanner.castShadow = true;
    descriptionBanner.receiveShadow = true;

    scene.add(descriptionBanner); // Add to the scene directly, not the platform
}


// --- Populate the Showroom with Cars ---

// 1. Mustang GT
createCarDisplay(
    'mustang/source/mustang.glb',
    -8, -15, // Platform X, Z position adjusted to avoid welcome board
    [
        'A car for Men',
        'Model: Mustang GTR',
        'True V8 Glory', 
        'NOT Eco-Friendly',
        'Price: $75,000'
    ],
    75000, // Price (NEW)
    'Mustang GTR', // Car Name (NEW)
    1.6, // Scale
    Math.PI, // Initial Rotation
    'left' // Wall placement for banner (back wall)
);

// 2. Lambo
createCarDisplay(
    'lambo/source/lambo.glb',
    -8, -3, // Mid-left position
    [
        'Lamborghini Countach',
        '6.5L v12',
        'redlines at 9000',
        '0-60 : 2.5s',
        'Price: $2,500,000'
    ],
    2500000, // Price (NEW)
    'Lamborghini Countach', // Car Name (NEW)
    145.5, // Your adjusted scale
    Math.PI / 2, // Rotate sedan to face center slightly
    'left' // Wall placement for banner (left wall)
);

// 2. Bugatti
createCarDisplay(
    '2026_bugatti_tourbillon.glb',
    -8, 9, // Mid-left position
    [
        'Bugatti',
        '8.5L V16',
        '1800 HP',
        '0-60 : 2.1s',
        'Price: $9,500,000'
    ],
    9500000, // Price (NEW)
    'The Tourbillon', // Car Name (NEW)
    140.5, // Your adjusted scale
    Math.PI / 2, // Rotate sedan to face center slightly
    'left' // Wall placement for banner (left wall)
);

// 3. Ford GT 
createCarDisplay(
    'sportscar/source/sportscar.glb', // Your new model
    8, -15, // Mid-right position
    [
        'Track Day Toy',
        'Model: Ford GT',
        'High Performance',
        'Sleek Design',
        'Price: $380,000'
    ],
    380000, // Price (NEW)
    'Ford GT', // Car Name (NEW)
    0.12, // Adjust this scale for your new sportscar! (start with 1.0)
    -Math.PI / 2, // Rotate sportscar to face center slightly
    'right' // Wall placement for banner (right wall)
);

//4. 911 Turbo
createCarDisplay(
    'free_1975_porsche_911_930_turbo.glb', // Your new model
    8, 9, // Mid-right position
    [
        'The original 911',
        'Model: 911 930 turbo',
        'Sporty Performance',
        'Timeless Design',
        'Price: $230,000'
    ],
    230000, // Price (NEW)
    '911 Turbo', // Car Name (NEW)
    1.215, // Adjust this scale for your new sportscar! (start with 1.0)
    -Math.PI / 2, // Rotate sportscar to face center slightly
    'right' // Wall placement for banner (right wall)
);

//5. 911
createCarDisplay(
    'porsche_911_with_interior.glb', // Your new model
    8, -3, // Mid-right position
    [
       'Elegant and Fast',
        'Model: 911 (2023)',
        'Unrelenting Performance',
        'Traditional meets modern',
        'Price: $350,000'
    ],
    350000, // Price (NEW)
    '911', // Car Name (NEW)
    1.655, // Adjust this scale for your new sportscar! (start with 1.0)
    -Math.PI / 10, // Rotate sportscar to face center slightly
    'right', // Wall placement for banner (right wall)
    false,
    new THREE.Vector3(-0.3, 0.7, -1.3), // cameraInteriorOffset for Porsche
    -Math.PI / 10 // cameraInteriorRotationY for Porsche
);


// 1. Ferrari SF90
createCarDisplay(
    'ferrari_sf90_stradale.glb',
    newRoomOffsetX -9, -5.5, // Adjusted X for new room, Z is relative to room's center
    [
        'Ferrari SF90',
        'Stradale',
        'Beauty that is',
        'mind bendingly fast',
        'Price: $750,000'
    ],
    750000, // Price
    'Ferrari SF90', // Added label for clarity
    1.6, // Scale
    Math.PI / 25, // Initial Rotation
    'back',
    true // Wall placement for banner
);

// 3. McLaren F1
createCarDisplay(
    'gulf_mclaren_f1_2022_car.glb',
    newRoomOffsetX + 9, -5.5, // Adjusted X for new room, Z is relative to room's center
    [
        'McLaren F1',
        '2022 Track Car',
        'Cost: Way too much'
    ],
    58000000, // Price
    'Mclaren F1 Track Car', // Added label for clarity
    0.9, // Scale
    -Math.PI / 6, // Rotate sportscar to face center slightly
    'right',
    true// Wall placement for banner
);

// 4. Carrera GT
createCarDisplay(
    '2004_porsche_carrera_gt.glb',
    newRoomOffsetX +0, newRoomDepth / 4 +0.5, // Adjusted X for new room, Z for front position
    [
        'Porsche Carrera GT',
        'The wildest Porsche ever',
        'The best sounding',
        'Naturally aspirated',
        '5.0L V10',
        'Ceramic Clutch'
    ],
    5000000, // Price
    'Carrera GT', // Added label for clarity
    160.3, // Scale
    -Math.PI / 6, // Rotate sportscar to face center slightly
    'front',
    true // Wall placement for banner
);

// --- Main Showroom Welcome Board ---
function createWelcomeBoard() {
    const boardWidth = 8;
    const boardHeight = 2.0;
    const boardDepthOffset = 0.05; // Offset from the wall

    // Define padding from the corner
    const horizontalPadding = 1.0; // Distance from the left wall edge
    const verticalPadding = 1.0;   // Distance from the ceiling edge

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 90px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Velocity Motors', canvas.width / 2, canvas.height * 0.35);

    ctx.font = '40px Arial';
    ctx.fillText('Welcome to Our Showroom!', canvas.width / 2, canvas.height * 0.75);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
    });

    const geometry = new THREE.PlaneGeometry(boardWidth, boardHeight);
    const board = new THREE.Mesh(geometry, material);

    // Calculate position for top-left corner of the back wall
    const boardX = (-showroomWidth / 2) + (boardWidth / 2) + horizontalPadding;
    const boardY = showroomHeight - (boardHeight / 2) - verticalPadding;
    const boardZ = -showroomDepth / 2 + boardDepthOffset; // Stays on the back wall

    board.position.set(boardX, boardY, boardZ);
    board.receiveShadow = true;
    board.castShadow = true;

    scene.add(board);
}
createWelcomeBoard();

// --- Function to Create New Room (NEW) ---
function createNewRoom() {
    // Floor
    const newRoomFloorGeometry = new THREE.PlaneGeometry(newRoomWidth, newRoomDepth);
    const newRoomFloor = new THREE.Mesh(newRoomFloorGeometry, floorMaterial);
    newRoomFloor.rotation.x = -Math.PI / 2;
    newRoomFloor.position.set(newRoomOffsetX, 0, 0);
    newRoomFloor.receiveShadow = true;
    scene.add(newRoomFloor);

    // Back Wall (relative to new room)
    const newRoomBackWall = new THREE.Mesh(new THREE.PlaneGeometry(newRoomWidth, showroomHeight), wallMaterial);
    newRoomBackWall.position.set(newRoomOffsetX, showroomHeight / 2, -newRoomDepth / 2);
    newRoomBackWall.receiveShadow = true;
    scene.add(newRoomBackWall);

    // Front Wall (relative to new room)
    const newRoomFrontWall = new THREE.Mesh(new THREE.PlaneGeometry(newRoomWidth, showroomHeight), wallMaterial);
    newRoomFrontWall.position.set(newRoomOffsetX, showroomHeight / 2, newRoomDepth / 2);
    newRoomFrontWall.rotation.y = Math.PI;
    newRoomFrontWall.receiveShadow = true;
    scene.add(newRoomFrontWall);

    // Right Wall (outermost wall of the new room)
    const newRoomRightWall = new THREE.Mesh(new THREE.PlaneGeometry(newRoomDepth, showroomHeight), wallMaterial);
    newRoomRightWall.position.set(newRoomOffsetX + newRoomWidth / 2, showroomHeight / 2, 0);
    newRoomRightWall.rotation.y = -Math.PI / 2;
    newRoomRightWall.receiveShadow = true;
    scene.add(newRoomRightWall);
    const newRoomLeftWallTop = new THREE.Mesh(new THREE.PlaneGeometry(newRoomDepth, showroomHeight - doorwayHeight), wallMaterial);
    newRoomLeftWallTop.position.set(newRoomOffsetX - newRoomWidth / 2, showroomHeight - (showroomHeight - doorwayHeight) / 2, 0);
    newRoomLeftWallTop.rotation.y = Math.PI / 2;
    newRoomLeftWallTop.receiveShadow = true;

    const newRoomLeftWallBottom = new THREE.Mesh(new THREE.PlaneGeometry(newRoomDepth, showroomHeight - doorwayHeight), wallMaterial);
    newRoomLeftWallBottom.position.set(newRoomOffsetX - newRoomWidth / 2, (showroomHeight - doorwayHeight) / 2, 0);
    newRoomLeftWallBottom.rotation.y = Math.PI / 2;
    newRoomLeftWallBottom.receiveShadow = true;

    // Ceiling
    const newRoomCeilingGeometry = new THREE.PlaneGeometry(newRoomWidth, newRoomDepth);
    const newRoomCeiling = new THREE.Mesh(newRoomCeilingGeometry, ceilingMaterial);
    newRoomCeiling.position.set(newRoomOffsetX, showroomHeight, 0);
    newRoomCeiling.rotation.x = Math.PI / 2;
    newRoomCeiling.receiveShadow = true;
    scene.add(newRoomCeiling);

    // Extend lighting into the new room (adjust positions relative to newRoomOffsetX)
    const newRoomRectLight1 = new THREE.RectAreaLight(rectLightColor, rectLightIntensity, 5, 2);
    newRoomRectLight1.position.set(newRoomOffsetX - newRoomWidth / 4, showroomHeight - 0.1, -newRoomDepth / 4);
    newRoomRectLight1.lookAt(newRoomRectLight1.position.x, 0, newRoomRectLight1.position.z);
    scene.add(newRoomRectLight1);

    const newRoomRectLight2 = new THREE.RectAreaLight(rectLightColor, rectLightIntensity, 5, 2);
    newRoomRectLight2.position.set(newRoomOffsetX + newRoomWidth / 4, showroomHeight - 0.1, -newRoomDepth / 4);
    newRoomRectLight2.lookAt(newRoomRectLight2.position.x, 0, newRoomRectLight2.position.z);
    scene.add(newRoomRectLight2);

    const newRoomRectLight3 = new THREE.RectAreaLight(rectLightColor, rectLightIntensity, 5, 2);
    newRoomRectLight3.position.set(newRoomOffsetX - newRoomWidth / 4, showroomHeight - 0.1, newRoomDepth / 4);
    newRoomRectLight3.lookAt(newRoomRectLight3.position.x, 0, newRoomRectLight3.position.z);
    scene.add(newRoomRectLight3);

    const newRoomRectLight4 = new THREE.RectAreaLight(rectLightColor, rectLightIntensity, 5, 2);
    newRoomRectLight4.position.set(newRoomOffsetX + newRoomWidth / 4, showroomHeight - 0.1, newRoomDepth / 4);
    newRoomRectLight4.lookAt(newRoomRectLight4.position.x, 0, newRoomRectLight4.position.z);
    scene.add(newRoomRectLight4);
}

// --- Function to Create Sliding Glass Door (NEW) ---
function createSlidingGlassDoor() {
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xADD8E6, // Light blue/cyan tint
        metalness: 0,
        roughness: 0.1,
        ior: 1.5, // Index of refraction for glass
        thickness: 0.1, // Simulate thin glass
        transmission: 1.0, // Fully transparent for transmission
        transparent: true,
        opacity: 0.5, // Make it semi-transparent
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide, // Important for seeing through from both sides
        depthWrite: false
    });

    const doorPanelGeometry = new THREE.PlaneGeometry(doorwayWidth / 2, doorwayHeight);

    // Left Door Panel
    slidingDoorLeft = new THREE.Mesh(doorPanelGeometry, glassMaterial);
    // Positioned at the center of the doorway, then offset slightly to the left
    //slidingDoorLeft.position.set(doorClosedPositionX, doorwayYOffset, -doorwayWidth / 4); 
    slidingDoorLeft.position.set(doorClosedPositionX - 0.01, doorwayYOffset, -doorwayWidth / 4);
    slidingDoorLeft.rotation.y = -Math.PI / 2; // Rotate to face along X-axis
    slidingDoorLeft.receiveShadow = true;
    slidingDoorLeft.castShadow = true;
    scene.add(slidingDoorLeft);

    // Right Door Panel
    slidingDoorRight = new THREE.Mesh(doorPanelGeometry, glassMaterial);
    // Positioned at the center of the doorway, then offset slightly to the right
    //slidingDoorRight.position.set(doorClosedPositionX, doorwayYOffset, doorwayWidth / 4);
    slidingDoorRight.position.set(doorClosedPositionX - 0.01, doorwayYOffset, doorwayWidth / 4);
    slidingDoorRight.rotation.y = -Math.PI / 2; // Rotate to face along X-axis
    slidingDoorRight.receiveShadow = true;
    slidingDoorRight.castShadow = true;
    scene.add(slidingDoorRight);

    // Add a trigger zone for the door
    // This invisible box defines the area where the player needs to be for the door to open
    const doorTriggerZoneGeometry = new THREE.BoxGeometry(1, doorwayHeight, doorwayWidth + 2); // Make it slightly deeper than the door
    const doorTriggerZoneMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0 }); // Invisible material
    const doorTriggerZone = new THREE.Mesh(doorTriggerZoneGeometry, doorTriggerZoneMaterial);
    doorTriggerZone.position.set(doorClosedPositionX, doorwayYOffset, 0); // Centered at the doorway
    doorTriggerZone.userData.type = 'doorTrigger';
    doorTriggerZone.userData.name = 'showroomDoor'; // Give it a name for identification
    scene.add(doorTriggerZone);
    triggerZones.push(doorTriggerZone); // Add to the array of zones to check against
}
createNewRoom();
createSlidingGlassDoor(); // NEW: Call to create the door

// --- Payment and Billing Section (NEW) ---
function createPaymentSection() {
    // Choose an unused corner, e.g., front-right (positive X, positive Z)
    const deskX = showroomWidth / 2 - 4; // Offset from right wall
    const deskZ = showroomDepth / 2 - 4; // Offset from front wall

    // 1. Desk/Counter
    const deskWidth = 3.0;
    const deskHeight = 1.0;
    const deskDepth = 1.5;

    const deskGeometry = new THREE.BoxGeometry(deskWidth, deskHeight, deskDepth);
    const deskMaterial = new THREE.MeshStandardMaterial({
        color: 0x503010, // Wood-like brown
        roughness: 0.7,
        metalness: 0.1
    });
    const desk = new THREE.Mesh(deskGeometry, deskMaterial);
    desk.position.set(deskX, deskHeight / 2, deskZ);
    desk.castShadow = true;
    desk.receiveShadow = true;
    scene.add(desk);

    // 2. Billing Screen on the wall
    const screenWidth = 2.5;
    const screenHeight = 1.5;
    const screenWallOffset = 0.05; // Small offset from the wall

    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 1024;
    screenCanvas.height = 768; // 4:3 aspect ratio
    const ctx = screenCanvas.getContext('2d');

    // Screen background
    ctx.fillStyle = '#0a0a0aff'; // Dark green for terminal look
    ctx.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
    ctx.strokeStyle = '#0009aaff'; // Blue border
    ctx.lineWidth = 20;
    ctx.strokeRect(0, 0, screenCanvas.width, screenCanvas.height);

    ctx.fillStyle = '#9c8005ff'; 
    ctx.font = 'bold 80px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Payment Terminal', screenCanvas.width / 2, screenCanvas.height * 0.2);

    ctx.font = '50px monospace';
    ctx.fillText('Card,Crypto,Kidney - all accepted', screenCanvas.width / 2, screenCanvas.height * 0.5); // This will be updated by JS
    ctx.fillText('Happy Motoring', screenCanvas.width / 2, screenCanvas.height * 0.7);
    ctx.font = '30px monospace';
    ctx.fillText('Press "E" to Confirm', screenCanvas.width / 2, screenCanvas.height * 0.9);

    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTexture.minFilter = THREE.LinearFilter;

    const screenMaterial = new THREE.MeshBasicMaterial({
        map: screenTexture,
        side: THREE.DoubleSide // Can be seen from both sides if wanted
    });

    const screenGeometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
    const billingScreen = new THREE.Mesh(screenGeometry, screenMaterial);

    // Position on the right wall (positive X)
    billingScreen.position.set(showroomWidth / 2 - screenWallOffset, showroomHeight * 0.6, deskZ);
    billingScreen.rotation.y = -Math.PI / 2; // Face towards negative X (into the room)
    billingScreen.castShadow = true;
    billingScreen.receiveShadow = true;
    scene.add(billingScreen);

    // 3. Add a simple Chair
    const chairBackHeight = 0.8;
    const chairSeatHeight = 0.4;
    const chairWidth = 0.5;
    const chairDepth = 0.5;

    const chairSeatGeo = new THREE.BoxGeometry(chairWidth, 0.1, chairDepth);
    const chairBackGeo = new THREE.BoxGeometry(chairWidth, chairBackHeight, 0.1);
    const chairLegGeo = new THREE.BoxGeometry(0.05, chairSeatHeight, 0.05);

    const chairMaterial = new THREE.MeshStandardMaterial({
        color: 0x303030, // Dark grey
        roughness: 0.8
    });

    const chairSeat = new THREE.Mesh(chairSeatGeo, chairMaterial);
    chairSeat.position.set(deskX, chairSeatHeight / 2, deskZ + deskDepth / 2 + 0.5); // In front of desk

    const chairBack = new THREE.Mesh(chairBackGeo, chairMaterial);
    chairBack.position.set(deskX, chairSeatHeight + chairBackHeight / 2, chairSeat.position.z - chairDepth / 2 + 0.05); // Behind seat

    const leg1 = new THREE.Mesh(chairLegGeo, chairMaterial);
    leg1.position.set(chairSeat.position.x - chairWidth / 2 + 0.025, chairSeatHeight / 2 - 0.05, chairSeat.position.z - chairDepth / 2 + 0.025);
    const leg2 = new THREE.Mesh(chairLegGeo, chairMaterial);
    leg2.position.set(chairSeat.position.x + chairWidth / 2 - 0.025, chairSeatHeight / 2 - 0.05, chairSeat.position.z - chairDepth / 2 + 0.025);
    const leg3 = new THREE.Mesh(chairLegGeo, chairMaterial);
    leg3.position.set(chairSeat.position.x - chairWidth / 2 + 0.025, chairSeatHeight / 2 - 0.05, chairSeat.position.z + chairDepth / 2 - 0.025);
    const leg4 = new THREE.Mesh(chairLegGeo, chairMaterial);
    leg4.position.set(chairSeat.position.x + chairWidth / 2 - 0.025, chairSeatHeight / 2 - 0.05, chairSeat.position.z + chairDepth / 2 - 0.025);

    scene.add(chairSeat, chairBack, leg1, leg2, leg3, leg4);

    // NEW: Create a trigger zone for the billing counter
    createTriggerZone(
        new THREE.Vector3(deskX, eyeLevel, deskZ + deskDepth / 2 + 1.0), // Position slightly in front of the chair/desk
        billingZoneSize,
        'billingCounter'
    );
}
createPaymentSection(); // Call this function to add the payment section

// --- Keyboard Input Handling ---
const onKeyDown = function (event) {
    switch (event.code) {
        case 'KeyW':
            moveForward = true;
            break;
        case 'KeyA':
            moveLeft = true;
            break;
        case 'KeyS':
            moveBackward = true;
            break;
        case 'KeyD':
            moveRight = true;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            isRunning = true;
            break;
        // NEW: Interaction Keys
        case 'KeyI': // Purchase interaction (select car)
            if (controls.isLocked === true && currentCarForPurchase && !isCarSelectedForPurchase && !isNearBillingCounter) {
                isCarSelectedForPurchase = true;
                currentCarPrice = currentCarForPurchase.userData.carPrice;
                currentCarName = currentCarForPurchase.userData.carName;
                hideAllUI(); // Hide purchase prompt after selection
                console.log(`Car selected for purchase: ${currentCarName} - $${currentCarPrice}`);
            }
            break;
        case 'KeyE': // Confirm purchase at billing counter
            if (controls.isLocked === true && isNearBillingCounter && isCarSelectedForPurchase && !hasConfirmedPurchase) {
                hideAllUI();
                UI_elements.purchaseConfirmation.style.display = 'block';
                console.log("Purchase Confirmed!");
                hasConfirmedPurchase = true; // Prevent multiple confirmations
                setTimeout(() => {
                    hideAllUI();
                    resetPurchaseState();
                }, 4000); // Display for 4 seconds
            } else if (controls.isLocked === true && isNearBillingCounter && !isCarSelectedForPurchase) {
                 // Player at billing counter but no car selected
                 hideAllUI();
                 UI_elements.billingTotalText.textContent = "No car selected! Go pick one!";
                 UI_elements.billingPrompt.style.display = 'block'; // Show billing prompt with new text
                 setTimeout(() => {
                     hideAllUI(); // Hide after a short delay
                 }, 2000);
            }
            break;
        case 'KeyQ': // Decline purchase at billing counter
            if (controls.isLocked === true && isNearBillingCounter && isCarSelectedForPurchase) {
                hideAllUI();
                UI_elements.purchaseDeclined.style.display = 'block';
                console.log("Purchase Declined.");
                setTimeout(() => {
                    hideAllUI();
                    resetPurchaseState();
                }, 2000); // Display for 2 seconds
            }
            break;
            // NEW/MODIFIED: Teleport IN/OUT of car with 'K'
        case 'KeyK': // K for Kontrol (Enter/Exit)
            if (controls.isLocked) {
                console.log('DEBUG: K pressed. isInsideCar:', isInsideCar, 'currentCarForPurchase:', currentCarForPurchase);
                if (!isInsideCar && currentCarForPurchase) {
                    // ENTER THE CAR
                   if (currentCarForPurchase.userData.cameraInteriorOffset) {
                // 1. Save current player world position and rotation
                previousCameraPosition.copy(camera.position);
                previousPlayerRotationY = controls.object.rotation.y; // Save current world rotation Y

                isInsideCar = true;
                isCollisionDisabled = true;

                // 2. Parent the camera to the car's platform
                currentCarForPurchase.add(camera); // Make camera a child of the platform

                // 3. Set camera's LOCAL position and rotation relative to the platform
                //    These are the values you pass in createCarDisplay:
                const interiorOffset = currentCarForPurchase.userData.cameraInteriorOffset;
                const interiorRotationY = currentCarForPurchase.userData.cameraInteriorRotationY;

                camera.position.copy(interiorOffset); // Set camera's position relative to platform's origin
                camera.rotation.set(0, interiorRotationY, 0); // Set camera's local rotation (reset X and Z to 0)

                // The controls object (camera) is now a child, so its local rotation will be handled by PointerLockControls.
                // We just need to make sure controls' internal state is refreshed for smooth mouse input relative to the car.
                controls.connect(document.body); // Re-connect to re-initialize controls' rotation based on camera's new local rotation

                hideAllUI();
                console.log(`Teleporting into ${currentCarForPurchase.userData.carName}`);
            } else {
                console.warn(`Camera interior offset not defined for ${currentCarForPurchase.userData.carName}.`);
            }
                } else if (isInsideCar) {
            // EXIT THE CAR

            // 1. Un-parent the camera from the platform and add it back to the scene
            scene.add(camera); // Add camera back to the scene as a top-level object

            // 2. Restore previous player world position and rotation
            camera.position.copy(previousCameraPosition); // Restore player's world position
            controls.object.rotation.y = previousPlayerRotationY; // Restore player's original world rotation Y

            controls.object.rotation.x = 0; // Reset X-axis rotation (pitch)
            controls.object.rotation.z = 0; // Reset Z-axis rotation (roll)
            // --- NEW: Stop idle sound and reset car state ---
            /*if (carIdleSound && carIdleSound.isPlaying) {
                carIdleSound.stop();
                console.log('Car engine stopped.');
            }*/
            isCarStarted = false; // Ensure this is set to false when exiting
            // --- END NEW ---
            isInsideCar = false;
            isCollisionDisabled = false;
            console.log("Exiting car.");

            // Important: Re-connect controls to ensure its internal state aligns with the restored camera rotation
            controls.connect(document.body);
        }
            }
            break;
        case 'ArrowUp':
            if (controls.isLocked && isInsideCar) { // Check if locked and inside car
                if (carStartupSound) { // Ensure the sound object exists
                    if (carStartupSound.isPlaying) {
                        // If playing, stop it
                        carStartupSound.stop();
                        isCarStarted = false; // Reset car started state
                        console.log('Car engine manually stopped.');
                    } else if (!isCarStarted) { // Only start if not already "started"
                        // If not playing and not started, play it
                        carStartupSound.play();
                        isCarStarted = true;
                        console.log('Car engine starting...');
                    }
                } else {
                    console.warn('Car startup sound not loaded yet.');
                }
            }
            break;
    }
};

const onKeyUp = function (event) {
    switch (event.code) {
        case 'KeyW':
            moveForward = false;
            break;
        case 'KeyA':
            moveLeft = false;
            break;
        case 'KeyS':
            moveBackward = false;
            break;
        case 'KeyD':
            moveRight = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            isRunning = false;
            break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// --- Helper function for linear interpolation (NEW) ---
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

// --- Reset Purchase State (NEW Helper Function) ---
function resetPurchaseState() {
    currentCarForPurchase = null;
    currentCarPrice = 0;
    currentCarName = '';
    isCarSelectedForPurchase = false;
    hasConfirmedPurchase = false;
    // Ensure billing prompt total is reset if it's currently shown
    UI_elements.billingTotalText.textContent = `Total: $0`; // Reset text immediately
}
// --- Audio Setup (NEW) ---
// Create an AudioListener and add it to the camera
const listener = new THREE.AudioListener();
camera.add(listener);

// Create a global audio source
const sound = new THREE.Audio(listener);

// Load a sound and set it as the Audio object's buffer
const audioLoader = new THREE.AudioLoader();
audioLoader.load('F1.mp3', function(buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true); // Make the music loop
    sound.setVolume(0.5); // Set volume (0.0 to 1.0)
    // Only start playing when controls are locked (player starts interacting)
    // This ensures music doesn't play before the user clicks to play
    controls.addEventListener('lock', function () {
        if (!sound.isPlaying) {
            sound.play();
        }
    });
    controls.addEventListener('unlock', function () {
        if (sound.isPlaying) {
            sound.pause(); // Pause when user exits pointer lock
        }
    });
});

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked === true) {

        // MODIFY THIS BLOCK: Only allow player movement if NOT inside a car
        if (!isInsideCar) {
            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;

            direction.z = Number(moveForward) - Number(moveBackward);
            direction.x = Number(moveRight) - Number(moveLeft);
            direction.normalize();

            const currentSpeed = isRunning ? baseSpeed * runMultiplier : baseSpeed;

            if (moveForward || moveBackward) velocity.z -= direction.z * currentSpeed * delta;
            if (moveLeft || moveRight) velocity.x -= direction.x * currentSpeed * delta;

            controls.moveRight(-velocity.x * delta);
            controls.moveForward(-velocity.z * delta);
        } else {
            // If inside car, ensure velocity is zeroed out to prevent unintended movement
            velocity.set(0, 0, 0);
            // Optional: If you want to disable controls completely while in car,
            // you might set controls.enabled = false here and re-enable on exit.
            // For now, just disabling movement is sufficient.
        }
        /*velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const currentSpeed = isRunning ? baseSpeed * runMultiplier : baseSpeed;

        if (moveForward || moveBackward) velocity.z -= direction.z * currentSpeed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * currentSpeed * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);*/

        camera.position.x = Math.max(minX, Math.min(maxX, camera.position.x));
        camera.position.z = Math.max(minZ, Math.min(maxZ, camera.position.z));
        camera.position.y = eyeLevel;

        // --- Proximity-based platform speed adjustment & Purchase Prompts ---
        let foundCarZone = false;
        let foundBillingZone = false;
        let foundDoorZone = false; // NEW: Flag for door zone

        // Use a 3D vector for player position
        const playerPosition = camera.position.clone();

        // Iterate through all trigger zones
        triggerZones.forEach(zone => {
            const box = new THREE.Box3().setFromObject(zone);
            if (box.containsPoint(playerPosition)) {
                if (zone.userData.type === 'carPurchase') {
                    foundCarZone = true;
                    console.log('DEBUG: Player is in carPurchase zone. Current car for purchase:', zone.userData.carPlatform.userData.carName);

                    // Only show prompt if no car is selected yet for purchase
                    if (!isCarSelectedForPurchase) {
                        currentCarForPurchase = zone.userData.carPlatform;
                        UI_elements.carNameForPurchase.textContent = currentCarForPurchase.userData.carName;
                        // Format price with commas for readability
                        UI_elements.carPriceForPurchase.textContent = `$${currentCarForPurchase.userData.carPrice.toLocaleString()}`;
                        hideAllUI(); // Hide others before showing this one
                        UI_elements.purchasePrompt.style.display = 'block';
                    }
                    // Apply speed up regardless of selection status
                    zone.userData.carPlatform.userData.currentRotationSpeed = defaultPlatformSpeed * interactSpeedMultiplier;
                } else if (zone.userData.type === 'billingCounter') {
                    foundBillingZone = true;
                    isNearBillingCounter = true;
                    if (!hasConfirmedPurchase) { // Don't show billing prompt if purchase just confirmed
                        hideAllUI(); // Hide others before showing this one
                        UI_elements.billingTotalText.textContent = `Total: $${currentCarPrice.toLocaleString()}`;
                        UI_elements.billingPrompt.style.display = 'block';
                    }
                } else if (zone.userData.type === 'doorTrigger') { // NEW: Door Trigger Zone Logic
                    foundDoorZone = true;
                }
            } else {
                // If the player leaves a car purchase zone, reset its speed if it's not the currently selected car
                if (zone.userData.type === 'carPurchase' && zone.userData.carPlatform) {
                    zone.userData.carPlatform.userData.currentRotationSpeed = defaultPlatformSpeed;
                }
            }
        });

        // NEW: Door Animation Logic (Outside the forEach loop, but within animate)
        // Determine target open/close state based on foundDoorZone
        const targetDoorOpen = foundDoorZone;

        // Smoothly animate the doors using lerp
        if (slidingDoorLeft && slidingDoorRight) {
            const currentLeftZ = slidingDoorLeft.position.z;
            const currentRightZ = slidingDoorRight.position.z;

            // Target Z positions for opened and closed states
            // Closed: original position
            // Open: original position - offset for left door, + offset for right door
            const targetLeftZ = targetDoorOpen ? -doorwayWidth / 4 - doorOpenPositionOffset : -doorwayWidth / 4;
            const targetRightZ = targetDoorOpen ? doorwayWidth / 4 + doorOpenPositionOffset : doorwayWidth / 4;

            slidingDoorLeft.position.z = lerp(currentLeftZ, targetLeftZ, doorSpeed * delta);
            slidingDoorRight.position.z = lerp(currentRightZ, targetRightZ, doorSpeed * delta);
        }
        // End NEW Door Animation Logic

        // --- Existing UI Hiding Logic ---
        // If not near any car purchase zone AND no car is selected for purchase, hide the prompt
        if (!foundCarZone && !isCarSelectedForPurchase) {
            UI_elements.purchasePrompt.style.display = 'none';
            currentCarForPurchase = null; // Clear selected car if not near any
        }
        
        // If no car is currently being interacted with (not in a car zone), ensure all platform speeds are default
        if (!foundCarZone) {
            rotatingPlatforms.forEach(platform => {
                if (platform.userData.currentRotationSpeed !== defaultPlatformSpeed) {
                    platform.userData.currentRotationSpeed = defaultPlatformSpeed;
                }
            });
        }

        // If not near the billing counter, hide its prompt and any confirmation/declined messages
        if (!foundBillingZone) {
            isNearBillingCounter = false;
            if (!hasConfirmedPurchase) { // Allow confirmation message to persist if already shown
                UI_elements.billingPrompt.style.display = 'none';
            }
            if (!UI_elements.purchaseConfirmation.style.display === 'block' && !UI_elements.purchaseDeclined.style.display === 'block') {
                 // Only reset if no messages are actively displayed. Messages reset themselves via timeout.
                // This ensures if you step out while a message is showing, it doesn't immediately vanish.
                // The timeouts in onKeyDown handle the clearing.
            }
        }
    }

    // Rotate all car platforms using their individual currentRotationSpeed
    rotatingPlatforms.forEach(platform => {
        platform.rotation.y += platform.userData.currentRotationSpeed * delta;
    });
    if (!isCollisionDisabled) {

        rotatingPlatforms.forEach(platform => {
        const platformPos = platform.position;
        const collisionRadius = platform.userData.collisionRadius;

        // Calculate distance in the XZ plane (ignoring Y for floor-level collision)
        const dx = camera.position.x - platformPos.x;
        const dz = camera.position.z - platformPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // If the camera is inside the forbidden radius, push it out
        if (distance < collisionRadius) {
            if (distance === 0) {
                // Prevent division by zero if camera is exactly at the platform's center
                camera.position.x = platformPos.x + collisionRadius;
                // No change to Z needed in this edge case, as X movement is enough to exit
            } else {
                // Calculate the direction vector from platform to camera
                const directionX = dx / distance;
                const directionZ = dz / distance;

                // Set camera position to the boundary of the collision sphere
                camera.position.x = platformPos.x + directionX * collisionRadius;
                camera.position.z = platformPos.z + directionZ * collisionRadius;
            }
        }
    });
    }
    prevTime = time;

    renderer.render(scene, camera);
}

// --- Handle Window Resizing ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the animation
animate();