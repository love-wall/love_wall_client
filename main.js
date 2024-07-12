import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
const baseUrl = "http://localhost:3000";

// Constants
const canvas = document.getElementById("bg");

// Three.js setup
const scene = new THREE.Scene();

// Infinite wall geometry
const wallGeometry = new THREE.PlaneGeometry(1000, 1000, 10, 10);
// Load chain texture
const chainTexture = new THREE.TextureLoader().load("./heart.jpg");
chainTexture.wrapS = THREE.RepeatWrapping;
chainTexture.wrapT = THREE.RepeatWrapping;
chainTexture.repeat.set(600, 600);
const wallMaterial = new THREE.MeshBasicMaterial({ map: chainTexture });
const wall = new THREE.Mesh(wallGeometry, wallMaterial);
scene.add(wall);

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

// Camera
const camera = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 1000);
camera.position.z = 3;
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableRotate = false;
controls.enableDamping = true;

// Light
const light = new THREE.PointLight(0xffffff, 100, 100);
light.position.set(0, 10, 10);
scene.add(light);

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(2);

// Array to store uploaded images
const uploadedImages = [];
let currentWallId = null;

// Function to add an image to the scene
function addImage(x, y, imageUrl) {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(imageUrl, (texture) => {
    const imageSize = 1; // Adjust the size of the image plane
    const imageGeometry = new THREE.PlaneGeometry(imageSize, imageSize);
    const imageMaterial = new THREE.MeshBasicMaterial({ map: texture });
    const imageMesh = new THREE.Mesh(imageGeometry, imageMaterial);
    imageMesh.position.set(x, y, 0); // Set image position
    scene.add(imageMesh);
    uploadedImages.push(imageMesh);
  });
}

// Function to create a new wall
function createWall() {
  fetch(`${baseUrl}/api/walls`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title: "New Wall", description: "A beautiful wall" })
  })
    .then(response => response.json())
    .then(data => {
      console.log("Wall created:", data);
      currentWallId = data.wall.id;
      const queryString = `?wallId=${currentWallId}`;
      window.history.pushState({ wallId: currentWallId }, '', queryString);
    })
    .catch(error => {
      console.error("Error creating wall:", error);
    });
}

// Function to upload image to server
function uploadImage(file, x, y) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("x", x);
  formData.append("y", y);
  formData.append("wallId", currentWallId);

  fetch(`${baseUrl}/api/images`, {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to upload image");
      }
      return response.json();
    })
    .then((data) => {
      console.log("Image uploaded:", data);
    })
    .catch((error) => {
      console.error("Error uploading image:", error);
    });
}

// Event listener for canvas click to upload images
canvas.addEventListener("click", (event) => {
  if (!currentWallId) {
    alert("Please create a wall first.");
    return;
  }

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target.result;
        // Calculate click position in normalized device coordinates (-1 to +1)
        const mouseX = (event.clientX / sizes.width) * 2 - 1;
        const mouseY = -(event.clientY / sizes.height) * 2 + 1;

        // Raycasting to determine intersection point with the wall
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);
        const intersects = raycaster.intersectObject(wall);

        if (intersects.length > 0) {
          // Get intersection point coordinates
          const intersectPoint = intersects[0].point;
          // Add image at intersection point
          addImage(intersectPoint.x, intersectPoint.y, imageUrl);

          uploadImage(file, intersectPoint.x, intersectPoint.y);
        }
      };
      reader.readAsDataURL(file);
    }
  });

  fileInput.click();
});

// Debounce function to limit the frequency of API calls
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Function to get the current min and max visible coordinates
function getVisibleCoordinates() {
  const raycaster = new THREE.Raycaster();

  const leftBottom = new THREE.Vector2(-1, -1);
  const rightTop = new THREE.Vector2(1, 1);

  raycaster.setFromCamera(leftBottom, camera);
  const intersectLeftBottom = raycaster.intersectObject(wall)[0]?.point;

  raycaster.setFromCamera(rightTop, camera);
  const intersectRightTop = raycaster.intersectObject(wall)[0]?.point;

  if (!intersectLeftBottom || !intersectRightTop) {
    return null;
  }

  const minX = intersectLeftBottom.x;
  const maxX = intersectRightTop.x;
  const minY = intersectLeftBottom.y;
  const maxY = intersectRightTop.y;

  return { minX, maxX, minY, maxY };
}

// Function to fetch images based on visible area
function fetchVisibleImages() {
  if (!currentWallId) {
    return; // Do not attempt to fetch images if there is no wall ID
  }

  const visibleCoordinates = getVisibleCoordinates();
  if (!visibleCoordinates) {
    return; // Do not attempt to fetch images if coordinates could not be determined
  }

  const { minX, maxX, minY, maxY } = visibleCoordinates;

  // Fetch images from backend
  fetch(
    `${baseUrl}/api/images?minX=${minX}&maxX=${maxX}&minY=${minY}&maxY=${maxY}&wallId=${currentWallId}`
  )
    .then((response) => response.json())
    .then((images) => {
      images.forEach((image) => {
        // Check if image already exists
        if (
          !uploadedImages.some(
            (uploadedImage) => uploadedImage.userData && uploadedImage.userData.imageUrl === image.url
          )
        ) {
          // Add image to the wall if it doesn't exist
          addImage(image.x, image.y, `${baseUrl}${image.url}`);
        }
      });
    })
    .catch((error) => {
      console.error("Error fetching images:", error);
    });
}

// Debounced version of fetchVisibleImages
const debouncedFetchVisibleImages = debounce(fetchVisibleImages, 300);

// Event listener for OrbitControls change (includes zoom and pan)
controls.addEventListener("change", debouncedFetchVisibleImages);

// Initial fetch when the page loads, only if there's a wall ID
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const wallIdFromUrl = urlParams.get('wallId');
  if (wallIdFromUrl) {
    currentWallId = wallIdFromUrl;
    fetchVisibleImages();
  }
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

// Event listener for the create wall button
document.getElementById("createWallBtn").addEventListener("click", createWall);
