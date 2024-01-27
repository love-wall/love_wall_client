import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
const baseUrl = "http://164.92.235.132:3000";

// Constants
const canvas = document.getElementById("bg");

// Three.js setup
const scene = new THREE.Scene();

// Infinite wall geometry
const wallGeometry = new THREE.PlaneGeometry(1000, 1000, 10, 10);
// Load chain texture
const chainTexture = new THREE.TextureLoader().load("heart.jpg");
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
const camera = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1);
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

// Function to upload image to server
function uploadImage(file, x, y) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("x", x);
  formData.append("y", y);

  fetch("http://164.92.235.132:3000/upload", {
    // Change the URL to your server address
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

// Event listener for canvas click
canvas.addEventListener("click", (event) => {
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

// Function to fetch images based on visible area
function fetchVisibleImages() {
  // Calculate visible area
  const minX = camera.position.x - (sizes.width / 2) * camera.aspect;
  const maxX = camera.position.x + (sizes.width / 2) * camera.aspect;
  const minY = camera.position.y - sizes.height / 2;
  const maxY = camera.position.y + sizes.height / 2;

  // Fetch images from backend
  fetch(
    `http://164.92.235.132:3000/images?minX=${minX}&maxX=${maxX}&minY=${minY}&maxY=${maxY}`
  )
    .then((response) => response.json())
    .then((images) => {
      images.forEach((image) => {
        // Check if image already exists
        if (
          !uploadedImages.some(
            (uploadedImage) => uploadedImage.userData.imageUrl === image.url
          )
        ) {
          // Add image to the wall if it doesn't exist
          addImage(image.x, image.y, `${baseUrl}/uploads/${image.url}`);
        }
      });
    })
    .catch((error) => {
      console.error("Error fetching images:", error);
    });
}

// Event listener for scroll
window.addEventListener("scroll", fetchVisibleImages);

// Initial fetch when the page loads
fetchVisibleImages();

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
