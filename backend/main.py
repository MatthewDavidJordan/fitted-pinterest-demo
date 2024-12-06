# main.py
import cv2
import json
import os
import openai
import torch
from PIL import Image
import numpy as np
import albumentations as albu
from iglovikov_helper_functions.utils.image_utils import load_rgb, pad, unpad
from iglovikov_helper_functions.dl.pytorch.utils import tensor_from_rgb_image
from cloths_segmentation.pre_trained_models import create_model
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")


def get_chatgpt_response(prompt, json_data):
    if isinstance(json_data, dict):
        json_data = json.dumps(json_data)

    print(f"\nData length: {len(json_data)} characters")

    # Truncate data if it's too large
    if len(json_data) > 6000:
        print("Warning: Truncating data to fit context window")
        try:
            data_obj = json.loads(json_data)
            if isinstance(data_obj, list):
                truncated_data = data_obj[:1000]
                json_data = json.dumps(truncated_data)
            else:
                json_data = json_data[:6000] + "..."
        except:
            json_data = json_data[:6000] + "..."
        print(f"Truncated data length: {len(json_data)} characters")

    client = openai.OpenAI()
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that responds only with valid JSON. No explanation, no markdown formatting, just pure JSON.",
                },
                {
                    "role": "user",
                    "content": f"Here's some data: {json_data}. {prompt} Remember to respond with only JSON, no other text.",
                },
            ],
            max_tokens=1000,
            temperature=0,
        )

        response_text = response.choices[0].message.content
        print(f"GPT raw response: {response_text}")

        # Try to find JSON in the response
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            import re

            json_match = re.search(r"({[\s\S]*})", response_text)
            if json_match:
                try:
                    return json.loads(json_match.group(1))
                except json.JSONDecodeError:
                    print("Failed to parse extracted JSON")
                    return "error"
            else:
                print("No JSON found in response")
                return "error"
    except Exception as e:
        print(f"OpenAI API error: {str(e)}")
        return "error"


def process_hsv_data(image_name, img):
    print(f"\nProcessing image: {image_name}")
    img = cv2.resize(img, (50, 50))
    hsv_img = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hsv_json = []

    # Sample every other pixel
    for row in hsv_img[::2]:
        for h, s, v in row[::2]:
            if (h, s, v) != (0, 0, 0):
                hsv_json.append({"h": int(h), "s": int(s), "v": int(v)})

    hsv_filename = f"{image_name}_hsv.json"
    with open(hsv_filename, "w") as f:
        json.dump(hsv_json, f)

    print(f"Created HSV file: {hsv_filename} with {len(hsv_json)} pixels")
    return hsv_filename


def mask_image(image_data, output_path="input_image_with_mask.png"):
    print("\nMasking image...")
    model = create_model("Unet_2020-10-30")
    model.eval()

    nparr = np.frombuffer(image_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    image = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    transform = albu.Compose([albu.Normalize(p=1)], p=1)
    padded_image, pads = pad(image, factor=32, border=cv2.BORDER_CONSTANT)
    x = transform(image=padded_image)["image"]
    x = torch.unsqueeze(tensor_from_rgb_image(x), 0)

    with torch.no_grad():
        prediction = model(x)[0][0]
    mask = (prediction > 0).cpu().numpy().astype(np.uint8)
    mask = unpad(mask, pads)

    rgba_image = np.dstack([image, np.full(image.shape[:2], 255, dtype=np.uint8)])
    rgba_image[:, :, 3] = mask * 255

    Image.fromarray(rgba_image).save(output_path)
    print(f"Masked image saved at: {output_path}")
    return output_path


def process_test_images(image_paths):
    print("\nProcessing test images...")
    masked_image_paths = []
    for image_path in image_paths:
        if os.path.exists(image_path):
            img = cv2.imread(image_path)
            if img is not None:
                image_name = os.path.splitext(os.path.basename(image_path))[0]
                hsv_file = process_hsv_data(image_name, img)
                masked_image_paths.append(hsv_file)
                print(f"Processed test image: {image_path}")
            else:
                print(f"Could not read image: {image_path}")
        else:
            print(f"File does not exist: {image_path}")
    return masked_image_paths


def process_input_image(image_data):
    print("\nProcessing input image...")
    try:
        masked_path = mask_image(image_data)
        img = cv2.imread(masked_path)

        if img is not None:
            image_name = "input_image"
            hsv_file = process_hsv_data(image_name, img)
            print(f"Input image processed: {hsv_file}")
            return hsv_file
        return None
    except Exception as e:
        print(f"Error processing input image: {str(e)}")
        return None


def get_clusters(masked_image_path):
    print(f"\nGenerating clusters for: {masked_image_path}")
    clustering_prompt = """Please read this JSON File data. It contains h,s,v values associated with pixels in an image. Please cluster using python, sklearn k-means, with n=5 clusters. Use only the h values of the hsv when clustering, as this is the hue value. Once you cluster based on h, count the pixels in the cluster and compute the percentage of the image the cluster represents. Average the s and v values for all the clusters and use that as the s and v value. Compute the mean h value and the averaged s and v value to create a json. Format it as "cluster_[number]" and "h","s","v", and "percent". Do not include the cluster if it is less than 5% of the image. Return the json format like this, no other information or commentary."""

    try:
        with open(masked_image_path, "r") as file:
            json_data = json.load(file)
        cluster_data = get_chatgpt_response(clustering_prompt, json_data)
        cluster_path = masked_image_path.split(".")[0] + "_cluster.json"

        with open(cluster_path, "w") as f:
            json.dump(cluster_data, f)

        print(f"Clusters generated: {cluster_path}")
        return cluster_path
    except Exception as e:
        print(f"Error generating clusters: {str(e)}")
        return None


def combine_json_files(json_files):
    print("\nCombining JSON files...")
    combined_data = {}

    try:
        test_file = json_files[0]
        with open(test_file, "r") as f:
            test_filename = os.path.splitext(os.path.basename(test_file))[0]
            combined_data[f"test_{test_filename}"] = json.load(f)

        for json_file in json_files[1:]:
            with open(json_file, "r") as f:
                data_filename = os.path.splitext(os.path.basename(json_file))[0]
                combined_data[f"data_{data_filename}"] = json.load(f)

        output_file = f"combined_{test_filename}.json"
        with open(output_file, "w") as f:
            json.dump(combined_data, f, indent=4)

        print(f"Combined JSON created: {output_file}")
        return output_file
    except Exception as e:
        print(f"Error combining JSON files: {str(e)}")
        return None


def get_matches(combined_file):
    print(f"\nProcessing matches from {combined_file}")
    color_comparison_prompt = """Please read this JSON File data, which contains clusters of colors from related images. Each cluster is defined by hue, saturation, and value color as well as an associated percent that the cluster represents in the associated image. The image I want to relate is labeled "test" in the data. I want to relate this image to the images labeled "data". Use Euclidean distance to find the images with the smallest distance. Use the Hue value when relating clusters, and use a geometric mean of the percent of the two clusters when comparing to weight its distance. Please give me the 5 closest images to "test" using the HSV and percent for cluster similarity. Format this as a JSON dictionary with keys 'match1' through 'match5' and values being the image names."""

    try:
        with open(combined_file, "r") as file:
            json_data = json.load(file)
            print(
                f"Combined file contents (first 500 chars): {str(json_data)[:500]}..."
            )
    except Exception as e:
        print(f"Error reading combined file: {str(e)}")
        return get_fallback_matches()

    response = get_chatgpt_response(color_comparison_prompt, json_data)
    print(f"GPT response: {response}")

    if response == "error" or not isinstance(response, dict):
        print(f"Invalid response format: {response}")
        return get_fallback_matches()

    return response


def get_fallback_matches():
    return {
        "match1": "No match found",
        "match2": "No match found",
        "match3": "No match found",
        "match4": "No match found",
        "match5": "No match found",
    }


def process_images(test_images: list, image_data: bytes):
    """
    Process input image against test images and return matches
    """
    print("\nStarting image processing pipeline...")

    print("Processing test images...")
    masked_image_paths = process_test_images(test_images)
    print(f"Processed {len(masked_image_paths)} test images")

    print("\nProcessing input image...")
    input_hsv = process_input_image(image_data)
    if not input_hsv:
        print("Failed to process input image")
        return get_fallback_matches()
    print(f"Input HSV file: {input_hsv}")

    print("\nGenerating clusters...")
    all_files = [input_hsv] + masked_image_paths
    cluster_files = []
    for file_path in all_files:
        print(f"Clustering {file_path}...")
        cluster_file = get_clusters(file_path)
        if cluster_file:
            cluster_files.append(cluster_file)

    if not cluster_files:
        print("No cluster files generated")
        return get_fallback_matches()
    print(f"Generated {len(cluster_files)} cluster files")

    print("\nCombining JSON files...")
    combined_file = combine_json_files(cluster_files)
    if not combined_file:
        print("Failed to combine JSON files")
        return get_fallback_matches()
    print(f"Combined file created: {combined_file}")

    print("\nGetting matches...")
    matches = get_matches(combined_file)
    print(f"Final matches: {matches}")

    return matches


if __name__ == "__main__":
    test_images = [f"./test_images/image_with_mask_{i}.png" for i in range(1, 16)]
    with open("test_image.jpg", "rb") as f:
        image_data = f.read()
    matches = process_images(test_images, image_data)
    print(json.dumps(matches, indent=4))
