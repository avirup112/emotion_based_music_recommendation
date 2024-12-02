// HTML Elements
const video = document.getElementById("webcam");
const toggleVideoButton = document.getElementById("toggleVideo");
const cameraOffMessage = document.getElementById("cameraOffMessage");
const recommendedPlaylistButton = document.getElementById("recommendedPlaylist");
const uploadImageButton = document.getElementById("uploadImage");
const fileInput = document.getElementById("imageUpload");

let isVideoOn = true;
let mediaStream = null;
let detectedEmotion = null; // Store detected emotion
let faceBox = null; // Store face bounding box data
let frameInterval = 500; // Process a frame every 500ms
let lastFrameTime = Date.now();

// CSRF Token
function getCSRFToken() {
  const cookieValue = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrftoken="))
    ?.split("=")[1];
  return cookieValue || "";
}

// Initialize Webcam
function startWebcam() {
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
      mediaStream = stream;
      video.srcObject = stream;
      video.style.display = "block"; // Show video
      cameraOffMessage.style.display = "none"; // Hide message
      isVideoOn = true; // Update state
      toggleVideoButton.textContent = "Turn Video Off"; // Update button text
    })
    .catch((err) => {
      console.error("Error accessing webcam:", err);
      alert("Please allow access to the webcam.");
    });
}

// Stop Webcam
function stopWebcam() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  video.style.display = "none"; // Hide video
  cameraOffMessage.style.display = "flex"; // Show message
  isVideoOn = false; // Update state
  toggleVideoButton.textContent = "Turn Video On"; // Update button text
}

// Add overlay canvas to match video feed
const overlayCanvas = document.createElement("canvas");
const overlayCtx = overlayCanvas.getContext("2d");
overlayCanvas.style.position = "absolute";
overlayCanvas.style.top = "0";
overlayCanvas.style.left = "0";
overlayCanvas.style.zIndex = "10"; // Ensure it's above the video
overlayCanvas.width = 640; // Set dimensions matching the video feed
overlayCanvas.height = 480;
document.body.appendChild(overlayCanvas);

// Align overlay canvas with video
function alignCanvas() {
  const rect = video.getBoundingClientRect();
  overlayCanvas.style.width = `${rect.width}px`;
  overlayCanvas.style.height = `${rect.height}px`;
  overlayCanvas.style.top = `${rect.top}px`;
  overlayCanvas.style.left = `${rect.left}px`;
}
window.addEventListener("resize", alignCanvas);
video.addEventListener("loadeddata", alignCanvas);

// Detect Emotion from Video
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
canvas.width = 640; // Set dimensions matching the video feed
canvas.height = 480;

// Draw the rectangle and emotion overlay
function drawFaceOverlay() {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height); // Clear previous drawings

  if (faceBox) {
    const { x, y, width, height } = faceBox; // Extract face bounding box dimensions
    overlayCtx.strokeStyle = "red";
    overlayCtx.lineWidth = 2;
    overlayCtx.strokeRect(x, y, width, height); // Draw the rectangle

    overlayCtx.font = "18px Arial";
    overlayCtx.fillStyle = "yellow";
    overlayCtx.fillText(detectedEmotion, x, y - 10); // Display emotion above the rectangle
  }
}
// Function to detect emotion from video
async function detectEmotionFromVideo() {
  const currentTime = Date.now();
  if (isVideoOn && video.readyState === 4 && currentTime - lastFrameTime >= frameInterval) {
    // Draw video frame on canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert frame to base64 image data
    const frameData = canvas.toDataURL("image/jpeg");

    try {
      // Send frame to backend for emotion detection
      const response = await fetch("/detect-emotion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        body: JSON.stringify({ frame: frameData }),
      });

      const result = await response.json();
      detectedEmotion = result.emotion; // Update detected emotion
      faceBox = result.face_box; // Get bounding box data from the backend

      // Draw emotion and rectangle
      drawFaceOverlay();
      if (detectedEmotion) {
        recommendedPlaylistButton.disabled = false; // Enable button
      }
    } catch (error) {
      console.error("Error in emotion detection:", error);
      alert("Error detecting emotion. Please try again.");
    }

    lastFrameTime = currentTime;
  }

  // Schedule next detection
  requestAnimationFrame(detectEmotionFromVideo);
}

// Handle the toggle video button
toggleVideoButton.addEventListener("click", () => {
  if (isVideoOn) {
    stopWebcam();
  } else {
    startWebcam();
  }
});

// Redirect to Playlist Based on Detected Emotion
recommendedPlaylistButton.addEventListener("click", () => {
  if (detectedEmotion) {
    const playlists = {
      happy: "/happy_playlist",
      sad: "/sad_playlist",
      angry: "/angry_playlist",
      neutral: "/neutral_playlist",
      surprise: "/surprise_playlist",
    };

    const redirectUrl = playlists[detectedEmotion] || null;
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      alert("Emotion not recognized. Please try again.");
    }
  } else {
    alert("No emotion detected yet!");
  }
});

// Handle Image Upload and Emotion Detection
fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target.result; // Base64 image data

      try {
        const response = await fetch("/detect-emotion", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCSRFToken(),
          },
          body: JSON.stringify({ frame: imageData }),
        });

        const result = await response.json();
        detectedEmotion = result.emotion;

        if (detectedEmotion) {
          alert(`Detected Emotion: ${detectedEmotion}`);
          recommendedPlaylistButton.disabled = false;
          // Redirect to the playlist based on the detected emotion
          const playlists = {
            happy: "/happy_playlist",
            sad: "/sad_playlist",
            angry: "/angry_playlist",
            neutral: "/neutral_playlist",
            surprise: "/surprise_playlist",
            fear : "/fear_playlist",
            surprise : "/surprise_playlist"
          };

          const redirectUrl = playlists[detectedEmotion] || null;
          if (redirectUrl) {
            window.location.href = redirectUrl;
          }
        } else {
          alert("No emotion detected.");
        }
      } catch (error) {
        console.error("Error in image emotion detection:", error);
        alert("Error detecting emotion. Please try again.");
      }
    };
    reader.readAsDataURL(file);
  }
});

// Start webcam and emotion detection
startWebcam();
detectEmotionFromVideo();
