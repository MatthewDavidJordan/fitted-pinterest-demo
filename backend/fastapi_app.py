# fastapi_app.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
import os
import requests
from main import main as process_images
import logging
from tempfile import NamedTemporaryFile

app = FastAPI()
logging.basicConfig(level=logging.INFO)


class ImageRequest(BaseModel):
    image_url: HttpUrl


class ImageMatches(BaseModel):
    matches: dict


def download_image(url: str) -> bytes:
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        return response.content
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to download image: {str(e)}"
        )


@app.post("/process-image", response_model=ImageMatches)
async def process_image(request: ImageRequest):
    try:
        # Download image from URL
        image_data = download_image(str(request.image_url))

        # Generate paths for test images
        test_images = [f"./test_images/image_with_mask_{i}.png" for i in range(1, 16)]

        # Verify all test images exist
        missing_images = [img for img in test_images if not os.path.exists(img)]
        if missing_images:
            raise HTTPException(
                status_code=404,
                detail=f"Missing test images: {', '.join(missing_images)}",
            )

        # Process images
        matches = process_images(test_images, image_data)
        return ImageMatches(matches=matches)

    except Exception as e:
        logging.error(f"Error processing image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
