import os
import sys
from PIL import Image

input_dir = 'screenshots'
output_dir = 'play_store_screenshots'

if not os.path.exists(input_dir):
    print(f"Creating '{input_dir}' directory. Please place your raw screenshots here and run this script again.")
    os.makedirs(input_dir)
    sys.exit(0)

os.makedirs(output_dir, exist_ok=True)

files = [f for f in os.listdir(input_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

if not files:
    print(f"No images found in '{input_dir}'. Please add your screenshots and run again.")
    sys.exit(0)

for file in files:
    img_path = os.path.join(input_dir, file)
    try:
        img = Image.open(img_path)
        img = img.convert('RGB')
        
        width, height = img.size
        
        # Google Play requires screenshots to have an aspect ratio no more than 2:1.
        # Most tall phones (1080x2400) are ~2.2:1. We need to pad the width.
        target_height = height
        target_width = max(width, height // 2)
        
        if width == target_width and height == target_height:
             print(f"Skipping {file}: Aspect ratio is already valid ({width}x{height})")
             # Still copy to the output dir
             output_file = os.path.splitext(file)[0] + '.jpg'
             output_path = os.path.join(output_dir, output_file)
             img.save(output_path, 'JPEG', quality=95)
             continue
             
        print(f"Padding {file}: {width}x{height} -> {target_width}x{target_height}")
        
        # #0b0f19 corresponds to a dark theme background color
        new_img = Image.new('RGB', (target_width, target_height), (11, 15, 25))
        
        # Paste original image in the center
        x_offset = (target_width - width) // 2
        y_offset = (target_height - height) // 2
        new_img.paste(img, (x_offset, y_offset))
        
        output_file = os.path.splitext(file)[0] + '_padded.jpg'
        output_path = os.path.join(output_dir, output_file)
        new_img.save(output_path, 'JPEG', quality=95)
        print(f"Saved {output_file}")
    except Exception as e:
        print(f"Error processing {file}: {e}")

print("Done! Check the 'play_store_screenshots' folder.")
