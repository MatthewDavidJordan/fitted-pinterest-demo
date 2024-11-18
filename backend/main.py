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

load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")


def get_chatgpt_response(prompt, json_data):
    if isinstance(json_data, dict):
        json_data = json.dumps(json_data)

    client = openai.OpenAI()
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": f"Here's some data: {json_data}. {prompt}"},
        ],
        max_tokens=1000,
        temperature=0,
    )

    response_text = response.choices[0].message.content
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        return "error"


def process_image(image_name, img):
    img = cv2.resize(img, (100, 100))
    hsv_img = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hsv_json = []

    for row in hsv_img:
        for h, s, v in row:
            if (h, s, v) != (0, 0, 0):
                hsv_json.append({"h": int(h), "s": int(s), "v": int(v)})

    hsv_filename = f"{image_name}_hsv.json"
    with open(hsv_filename, "w") as f:
        json.dump(hsv_json, f)
    return hsv_filename


def mask_image_from_path(image_data, output_path="input_image_with_mask.png"):
    model = create_model("Unet_2020-10-30")
    model.eval()

    # Convert image data to numpy array
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
    return output_path


def process_test_images_from_paths(image_paths):
    masked_image_paths = []
    for image_path in image_paths:
        if os.path.exists(image_path):
            img = cv2.imread(image_path)
            if img is not None:
                image_name = os.path.splitext(os.path.basename(image_path))[0]
                hsv_file = process_image(image_name, img)
                masked_image_paths.append(hsv_file)
                print(f"Saved {hsv_file}")
    return masked_image_paths


def process_input_image(image_data):
    try:
        masked_path = mask_image_from_path(image_data)
        img = cv2.imread(masked_path)

        if img is not None:
            image_name = "input_image"
            hsv_file = process_image(image_name, img)
            return hsv_file
    except Exception as e:
        print(f"Error processing input image: {str(e)}")
        return None


def get_clusters_from_gpt(masked_image_path):
    clustering_prompt = """Please read this JSON File data. It contains h,s,v values associated with pixels in an image. Please cluster using python, sklearn k-means, with n=5 clusters. Use only the h values of the hsv when clustering, as this is the hue value. Once you cluster based on h, count the pixels in the cluster and compute the percentage of the image the cluster represents. Average the s and v values for all the clusters and use that as the s and v value. Compute the mean h value and the averaged s and v value to create a json. Format it as "cluster_[number]" and "h","s","v", and "percent". Do not include the cluster if it is less than 5% of the image. Return the json format like this, no other information or commentary."""
    with open(masked_image_path, "r") as file:
        json_data = json.load(file)
    cluster_data = get_chatgpt_response(clustering_prompt, json_data)
    cluster_path = masked_image_path.split(".")[0] + "_cluster.json"
    with open(cluster_path, "w") as f:
        json.dump(cluster_data, f)
    return cluster_path


def combine_json(json_files):
    combined_data = {}

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

    return output_file


def get_matches_from_gpt(combined_file):
    color_comparison_prompt = """Please read this JSON File data, which contains clusters of colors from related images. Each cluster is defined by hue, saturation, and value color as well as an associated percent that the cluster represents in the associated image. The image I want to relate is labeled "test" in the data. I want to relate this image to the images labeled "data". Use Euclidean distance to find the images with the smallest distance. Use the Hue value when relating clusters, and use a geometric mean of the percent of the two clusters when comparing to weight its distance. Please give me the 5 closest images to "test" using the HSV and percent for cluster similarity. Format this as JSON data with the list of the closest 5."""
    with open(combined_file, "r") as file:
        json_data = json.load(file)
    return get_chatgpt_response(color_comparison_prompt, json_data)


def main(test_images: list, image_data: bytes):
    masked_image_paths = process_test_images_from_paths(test_images)
    input_hsv = process_input_image(image_data)

    all_files = [input_hsv] + masked_image_paths
    cluster_files = [get_clusters_from_gpt(file_path) for file_path in all_files]

    combined_file = combine_json(cluster_files)
    matches = get_matches_from_gpt(combined_file)

    return matches


if __name__ == "__main__":
    test_images = [f"image_with_mask_{i}.png" for i in range(1, 16)]
    with open("test_image.jpg", "rb") as f:
        image_data = f.read()
    matches = main(test_images, image_data)
    print(json.dumps(matches, indent=4))
