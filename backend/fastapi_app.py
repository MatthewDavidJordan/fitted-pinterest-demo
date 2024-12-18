# fastapi_app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pydantic import BaseModel, HttpUrl
import os
import requests
import logging
from typing import Dict, Any, List
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Set default PORT if not in environment
if "PORT" not in os.environ:
    os.environ["PORT"] = "8000"


class ImageRequest(BaseModel):
    image_url: HttpUrl


def verify_env_vars() -> None:
    """Verify required environment variables are set"""
    required_vars = ["OPENAI_API_KEY"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {missing_vars}")


def check_test_images() -> List[str]:
    """
    Check which test images are available
    Returns list of available test image paths
    """
    test_images = [f"./test_images/image_with_mask_{i}.png" for i in range(1, 31)]
    available_images = [img for img in test_images if os.path.exists(img)]
    if not available_images:
        logger.warning("No test images found")
        # Create test_images directory if it doesn't exist
        os.makedirs("test_images", exist_ok=True)
    else:
        logger.info(f"Found {len(available_images)} test images")
    return available_images


def download_image(url: str) -> bytes:
    """Download image from URL and return bytes"""
    try:
        logger.info(f"Downloading image from {url}")
        response = requests.get(url, stream=True)
        response.raise_for_status()
        logger.info("Image downloaded successfully")
        return response.content
    except requests.RequestException as e:
        logger.error(f"Failed to download image: {str(e)}")
        raise HTTPException(
            status_code=400, detail=f"Failed to download image: {str(e)}"
        )


# Lazy loading of ML models
_model = None


def get_model():
    """Lazy load the ML model only when needed"""
    global _model
    if _model is None:
        try:
            from main import process_images

            _model = process_images
            logger.info("Successfully loaded image processing model")
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")
            raise HTTPException(
                status_code=500, detail="Failed to load image processing model"
            )
    return _model


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Initialize state
    app.state.test_images = []

    # Startup
    logger.info("Starting up FastAPI server")
    try:
        verify_env_vars()
        available_images = check_test_images()
        app.state.test_images = available_images
        logger.info("Server startup completed successfully")
    except Exception as e:
        logger.error(f"Startup check failed: {str(e)}")
        # Still set test_images even if empty
        app.state.test_images = []

    yield

    # Shutdown
    logger.info("Shutting down FastAPI server")
    global _model
    _model = None  # Clear model from memory


app = FastAPI(title="Image Analysis API", lifespan=lifespan)

# Mount the test_images directory if it exists
if os.path.exists("test_images"):
    app.mount("/test-images", StaticFiles(directory="test_images"), name="test_images")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "status": "ok",
        "api_version": "1.0",
        "endpoints": {
            "root": "/",
            "health": "/health",
            "test_images": "/test-images",
            "process_image": "/process-image",
        },
        "documentation": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "test_images_count": len(app.state.test_images),
        "environment": os.getenv("ENVIRONMENT", "development"),
        "base_url": os.getenv("RENDER_EXTERNAL_URL", "http://localhost:8000"),
        "port": os.getenv("PORT", "8000"),
    }


@app.get("/test-images")
async def list_test_images():
    """List all available test images"""
    return {"total": len(app.state.test_images), "images": app.state.test_images}


@app.post("/process-image")
async def process_image(request: ImageRequest):
    """Process an image URL and return matches with URLs to similar images"""
    try:
        logger.info("Starting image processing request")

        if not app.state.test_images:
            raise HTTPException(
                status_code=503, detail="No test images available for comparison"
            )

        # Download and process the image
        image_data = download_image(str(request.image_url))

        # Get model and process
        model = get_model()
        logger.info("Processing image through main pipeline")
        matches = model(app.state.test_images, image_data)

        if not isinstance(matches, dict):
            logger.error(f"Invalid matches format received: {matches}")
            raise HTTPException(
                status_code=500,
                detail="Invalid response format from processing pipeline",
            )

        # Convert file paths to URLs
        matches_with_urls = {}
        # Use environment variable for base URL, fallback to localhost
        base_url = (
            os.getenv("RENDER_EXTERNAL_URL", "http://localhost:8000") + "/test-images"
        )

        for key, image_path in matches.items():
            # Extract the number from the match path
            import re

            if match := re.search(r"mask_(\d+)", image_path):
                number = match.group(1)
                # Construct the correct filename
                image_url = f"{base_url}/image_with_mask_{number}.png"
                matches_with_urls[key] = image_url
            else:
                logger.warning(f"Could not parse image number from path: {image_path}")
                # Fallback to original filename if parsing fails
                filename = os.path.basename(image_path)
                image_url = f"{base_url}/{filename}"
                matches_with_urls[key] = image_url

        logger.info("Image processing completed successfully")
        return {"matches": matches_with_urls}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
