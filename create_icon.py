import math
from PIL import Image, ImageDraw, ImageFilter

def create_free_games_icon():
    size = 512  # Render at 512x512 for super sharp downsampling
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Subtle Outer Glow / Shadow
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    margin = 36
    glow_draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=100,
        fill=(138, 43, 226, 120)  # Neon purple glow
    )
    glow = glow.filter(ImageFilter.GaussianBlur(24))
    img.alpha_composite(glow)

    # 2. Base Squircle with Obsidian-to-Dark-Violet Gradient
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    base_draw = ImageDraw.Draw(base)
    base_margin = 44
    
    # Gradient background
    for y in range(base_margin, size - base_margin):
        factor = (y - base_margin) / (size - 2 * base_margin)
        r = int(18 * (1 - factor) + 38 * factor)
        g = int(14 * (1 - factor) + 12 * factor)
        b = int(32 * (1 - factor) + 68 * factor)
        base_draw.line([(base_margin, y), (size - base_margin, y)], fill=(r, g, b, 255))

    # Mask with rounded rectangle
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(
        [base_margin, base_margin, size - base_margin, size - base_margin],
        radius=90,
        fill=255
    )
    
    # Border stroke
    border = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    border_draw = ImageDraw.Draw(border)
    border_draw.rounded_rectangle(
        [base_margin, base_margin, size - base_margin, size - base_margin],
        radius=90,
        outline=(168, 85, 247, 200),  # Electric purple border
        width=6
    )

    card = Image.composite(base, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask)
    card.alpha_composite(border)
    img.alpha_composite(card)

    # 3. Draw Stylized Modern Gamepad / Gift Emblem
    emblem = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    e_draw = ImageDraw.Draw(emblem)

    # Center is (256, 256)
    # Gamepad body:
    # Outer pill-like rounded shape
    gp_left = 120
    gp_top = 180
    gp_right = 392
    gp_bottom = 330
    
    # Gamepad shadow
    e_draw.rounded_rectangle(
        [gp_left, gp_top + 10, gp_right, gp_bottom + 10],
        radius=55,
        fill=(10, 5, 20, 160)
    )

    # Gamepad gradient body (Cyan to Violet / Neon Green)
    # Main gamepad chassis:
    e_draw.rounded_rectangle(
        [gp_left, gp_top, gp_right, gp_bottom],
        radius=55,
        fill=(30, 27, 46, 255),
        outline=(192, 132, 252, 220),
        width=5
    )

    # Left grip & Right grip accent wings
    # D-pad (Plus sign on left):
    d_cx, d_cy = 195, 255
    d_w, d_len = 14, 40
    # Horiz
    e_draw.rounded_rectangle([d_cx - d_len//2, d_cy - d_w//2, d_cx + d_len//2, d_cy + d_w//2], radius=4, fill=(168, 85, 247, 255))
    # Vert
    e_draw.rounded_rectangle([d_cx - d_w//2, d_cy - d_len//2, d_cx + d_w//2, d_cy + d_len//2], radius=4, fill=(168, 85, 247, 255))

    # Action Buttons (4 dots on right in emerald / diamond pattern):
    b_cx, b_cy = 317, 255
    b_rad = 7
    b_dist = 18
    # Top (North)
    e_draw.ellipse([b_cx - b_rad, (b_cy - b_dist) - b_rad, b_cx + b_rad, (b_cy - b_dist) + b_rad], fill=(52, 211, 153, 255)) # Emerald
    # Right (East)
    e_draw.ellipse([(b_cx + b_dist) - b_rad, b_cy - b_rad, (b_cx + b_dist) + b_rad, b_cy + b_rad], fill=(251, 191, 36, 255)) # Gold
    # Bottom (South)
    e_draw.ellipse([b_cx - b_rad, (b_cy + b_dist) - b_rad, b_cx + b_rad, (b_cy + b_dist) + b_rad], fill=(244, 63, 94, 255)) # Rose
    # Left (West)
    e_draw.ellipse([(b_cx - b_dist) - b_rad, b_cy - b_rad, (b_cx - b_dist) + b_rad, b_cy + b_rad], fill=(56, 189, 248, 255)) # Sky Blue

    # Center Logo: Glowing Gift Box Ribbon / Crown
    # Stylized Gift Ribbon above gamepad:
    # Gift box base
    gb_x1, gb_y1 = 232, 225
    gb_x2, gb_y2 = 280, 273
    e_draw.rounded_rectangle([gb_x1, gb_y1, gb_x2, gb_y2], radius=8, fill=(88, 28, 135, 255), outline=(216, 180, 254, 255), width=3)
    # Vertical ribbon
    e_draw.rectangle([252, gb_y1, 260, gb_y2], fill=(250, 204, 21, 255))
    # Horizontal ribbon
    e_draw.rectangle([gb_x1, 245, gb_x2, 253], fill=(250, 204, 21, 255))
    # Ribbon Bow on top
    e_draw.ellipse([240, 210, 255, 227], outline=(250, 204, 21, 255), width=3)
    e_draw.ellipse([257, 210, 272, 227], outline=(250, 204, 21, 255), width=3)

    # 4. Floating 4-point Sparkles / Stars (Free Loot vibe)
    def draw_star(cx, cy, r_outer, r_inner, color):
        points = []
        for i in range(8):
            angle = i * math.pi / 4
            r = r_outer if i % 2 == 0 else r_inner
            points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
        e_draw.polygon(points, fill=color)

    draw_star(160, 140, 20, 6, (250, 204, 21, 255))  # Gold star top-left
    draw_star(355, 145, 15, 5, (52, 211, 153, 255))  # Emerald star top-right
    draw_star(256, 360, 18, 5, (168, 85, 247, 255))  # Violet star bottom-center

    img.alpha_composite(emblem)

    # 5. Export high-res PNG & Multi-size Windows ICO
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    
    png_path = r"D:\Scripts\free-games-claimer\app_icon.png"
    ico_path = r"D:\Scripts\free-games-claimer\app_icon.ico"
    
    img.save(png_path, "PNG")
    img.save(ico_path, format="ICO", sizes=ico_sizes)
    print(f"Generated {png_path} and {ico_path} successfully!")

if __name__ == "__main__":
    create_free_games_icon()
