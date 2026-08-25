#!/usr/bin/env python3
"""
keepBoard Pixel Pet Sprite Generator
Uses Pillow for high-quality pixel art generation.
Integrates with pixel-asset-master for post-processing.

Usage:
    python scripts/generate_sprites.py [--scale 4] [--output src/assets/pets/hd]
"""
import argparse
import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("[ERROR] Pillow required: pip install Pillow")
    sys.exit(1)

# Get project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Default output directory
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "assets" / "pets" / "hd"

# Grid size (32x32 base resolution)
GRID = 32

def rgba(r, g, b, a=255):
    return (r, g, b, a)

def hex_to_rgba(hex_color):
    """Convert hex color to RGBA tuple."""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return (r, g, b, 255)

# ========== PALETTES ==========

PALETTES = {
    'piranha': {
        'o': rgba(110, 27, 16),    # outline
        'd': rgba(194, 59, 34),    # dark
        'm': rgba(232, 93, 58),    # mid
        'l': rgba(255, 140, 66),   # light
        's': rgba(255, 194, 77),   # specular
        'w': rgba(255, 255, 255),  # white
        'b': rgba(24, 24, 40),     # black
        't': rgba(255, 246, 216),  # teeth
        'k': rgba(240, 138, 138),  # cheek
        'g': rgba(45, 90, 39),     # stem dark
        'G': rgba(74, 143, 60),    # stem
        'L': rgba(168, 224, 99),   # leaf
        'n': rgba(92, 58, 26),     # pot dark
        'N': rgba(139, 90, 43),    # pot mid
        'B': rgba(176, 120, 66),   # pot light
        'P': rgba(140, 60, 30),    # petal dark
    },
    'cactus': {
        'o': rgba(23, 58, 23),
        'd': rgba(45, 122, 45),
        'm': rgba(63, 163, 63),
        'l': rgba(102, 204, 85),
        's': rgba(155, 232, 122),
        'y': rgba(255, 217, 61),
        'r': rgba(232, 93, 58),
        'R': rgba(255, 140, 66),
        'w': rgba(255, 255, 255),
        'b': rgba(24, 24, 40),
        'n': rgba(92, 58, 26),
        'N': rgba(139, 90, 43),
        'B': rgba(176, 120, 66),
        'G': rgba(80, 180, 70),
    },
    'slime': {
        'o': rgba(31, 95, 139),
        'd': rgba(46, 134, 171),
        'm': rgba(84, 185, 223),
        'l': rgba(138, 216, 239),
        's': rgba(234, 251, 255),
        'b': rgba(24, 24, 40),
        'k': rgba(240, 138, 138),
        't': rgba(255, 246, 216),
        'G': rgba(180, 240, 255),
    },
    'cat': {
        'o': rgba(51, 48, 74),
        'd': rgba(85, 79, 112),
        'm': rgba(133, 125, 166),
        'l': rgba(167, 159, 196),
        's': rgba(220, 214, 240),
        'w': rgba(255, 255, 255),
        'b': rgba(24, 24, 40),
        'k': rgba(240, 138, 138),
        'n': rgba(232, 155, 176),
        'N': rgba(200, 120, 150),
    },
    'mushroom': {
        'o': rgba(122, 21, 21),
        'd': rgba(194, 59, 34),
        'm': rgba(232, 93, 58),
        'l': rgba(255, 140, 66),
        's': rgba(255, 194, 77),
        'w': rgba(255, 246, 224),
        'W': rgba(255, 255, 255),
        'b': rgba(24, 24, 40),
        'k': rgba(240, 138, 138),
        'n': rgba(201, 174, 114),
        'N': rgba(242, 223, 182),
        'L': rgba(123, 201, 90),
        'g': rgba(45, 90, 39),
    },
    'ghost': {
        'o': rgba(73, 83, 122),
        'd': rgba(136, 145, 176),
        'm': rgba(198, 204, 228),
        'l': rgba(234, 238, 250),
        's': rgba(255, 255, 255),
        'b': rgba(35, 39, 67),
        'k': rgba(240, 138, 138),
        'G': rgba(200, 220, 255),
    },
    'dino': {
        'o': rgba(30, 77, 30),
        'd': rgba(63, 137, 41),
        'm': rgba(106, 190, 48),
        'l': rgba(143, 217, 76),
        's': rgba(198, 242, 115),
        'w': rgba(255, 255, 255),
        'b': rgba(24, 24, 40),
        't': rgba(255, 246, 216),
        'k': rgba(200, 60, 60),
    },
    'robot': {
        'o': rgba(34, 42, 56),
        'd': rgba(74, 85, 104),
        'm': rgba(138, 151, 173),
        'l': rgba(195, 206, 223),
        's': rgba(239, 244, 251),
        'G': rgba(123, 247, 123),
        'R': rgba(255, 78, 80),
        'y': rgba(255, 217, 61),
        'b': rgba(14, 17, 24),
    },
    'pumpkin': {
        'o': rgba(122, 58, 16),
        'd': rgba(192, 90, 29),
        'm': rgba(242, 132, 37),
        'l': rgba(255, 166, 77),
        's': rgba(255, 208, 138),
        'b': rgba(20, 20, 32),
        'G': rgba(255, 224, 138),
        'g': rgba(45, 90, 39),
    },
    'penguin': {
        'o': rgba(16, 20, 28),
        'd': rgba(32, 40, 58),
        'm': rgba(57, 68, 92),
        'l': rgba(255, 255, 255),
        's': rgba(244, 247, 255),
        'y': rgba(255, 179, 71),
        'Y': rgba(232, 145, 45),
        'b': rgba(20, 20, 32),
        'k': rgba(240, 138, 138),
    },
    'alien': {
        'o': rgba(18, 59, 18),
        'd': rgba(46, 125, 50),
        'm': rgba(87, 200, 77),
        'l': rgba(143, 224, 138),
        's': rgba(200, 255, 196),
        'b': rgba(24, 24, 40),
        'w': rgba(255, 255, 255),
        'r': rgba(255, 78, 80),
        'G': rgba(120, 255, 120),
    },
    'fox': {
        'o': rgba(92, 42, 13),
        'd': rgba(184, 92, 30),
        'm': rgba(232, 130, 58),
        'l': rgba(255, 168, 92),
        's': rgba(255, 220, 168),
        'w': rgba(255, 255, 255),
        'b': rgba(24, 24, 40),
        'k': rgba(240, 138, 138),
        't': rgba(255, 246, 216),
    },
}

# ========== SPRITE TEMPLATES ==========

SPRITES = {
    'piranha': [
        '................................',
        '................................',
        '................................',
        '................................',
        '..........oooooooooo............',
        '........ooddddddddoo...........',
        '.......odmmllllllmdo...........',
        '......odmllwsswwllmdo..........',
        '.....odmlwwswwswwlmdo.........',
        '.....odmlbbwlbwwbbmlmo........',
        '.odmlwwblwwlwwlwwblmdo........',
        '.odmlllllllllllllllmdo........',
        '.odmttttttttttttttmdo.........',
        '.odtbbbbbbbbbbbbbbtdo.........',
        '.odbtbtbbbbbbbtbtbmdo.........',
        '.odtbbbbbbbbbbbbbbmdo.........',
        '..odttbbbbbbbbbbttddo.........',
        '..oddmmtttttttmdddo...........',
        '...oddmddddddmddo.............',
        '....oggggggggggo..............',
        '..gL.oGGggggGGo.lg............',
        '.gLggoGGnGGnGGogLgg...........',
        '..ggo.oGnnnnnGo.ogg...........',
        '.gg....onnnno....gg...........',
        '.g......oooooo.....g..........',
        '......oBBBBBBo...............',
        '.....oBBBBBBBBo..............',
        '....oBBnnnnnnBBo.............',
        '....oBnnNNNNnnBo.............',
        '...oBnnnNNNnnnnBo............',
        '...obnnnnnnnnnnbo............',
        '....oooooooooooo.............',
    ],
    'cactus': [
        '................................',
        '................................',
        '................................',
        '...........oyyo................',
        '..........orRRro...............',
        '...........oyyo................',
        '.........oommmmoo..............',
        '........omllllllmm.............',
        '.......omlkmmmmklmmo...........',
        '......odmmmmmmmmmmmdo..........',
        '......odmdmmdmmdmmdo..........',
        '.oo..odmdmmdmmdmmdo....oo.....',
        'omo.odmdmmdmmdmmdo....omo.....',
        'ommo.odmdmmdmmdmmdo..ommo.....',
        '.ommoodmmmmmmmmmmoommo........',
        '..ommmmmmmmmmmmmmmmmo.........',
        '...ommmmmmmmmmmmmmmo..........',
        '....odddddddddddddd...........',
        '.....ooooooooooooooo...........',
        '......oBBBBBBBBBo.............',
        '.....oBBBnnnnnBBBo............',
        '.....oBnnnNNNnnnBo............',
        '....oBnnnnNNNnnnnBo...........',
        '....obnnnnnnnnnnnbo...........',
        '.....ooooooooooooo............',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
    ],
    'slime': [
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '........oooooo................',
        '......oomlllmmoo..............',
        '.....omlssssllmmo.............',
        '....omlslllllllmmo............',
        '...ommsllmmmmmmmmo............',
        '..ommmmmmmmmmmmmmmo...........',
        '..ommmmmmmmmmmmmmmo...........',
        '.ommmmmmmmmmmmmmmmmo..........',
        '.ommmmmmmmmmmmmmmmmo..........',
        '.ommmbbbmmmmmbbbmmmo..........',
        'ommmbbsbmmmmmbbsbmmmo.........',
        'ommmbbbbmmkmmmbbbbmmo.........',
        'ommmmmmmmkkmkmmmmmmmmo........',
        'ommmmmmmkkkkmmmmmmmmmo........',
        'ommmmmmmmmmmmmmmmmmmmmdo......',
        'ommmmmmmmmmmmmmmmmmmmddo......',
        'odmmmmmmmmmmmmmmmmmmdddo......',
        'oddddddddddddddddddddddo.....',
        '.oooooooooooooooooooooooo.....',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
    ],
    'cat': [
        '................................',
        '................................',
        '................................',
        '................................',
        'oo......................oo.....',
        'oddo....................oddo...',
        'odndo..................ondno...',
        'odkdo....oommoo......odkdo....',
        '..oddommmmmmmmmmmmmoddo.......',
        '..odmllmmmmmmmmmllmmmdo.......',
        '.odmllmmmmmmmmmmmllmmmdo......',
        '.odmmmmmmmmmmmmmmmmmmmdo......',
        'odmmmbbwmmmmmmmwwbmmmmmo......',
        'odmmmbwkbmmmmmmkwkbmmmmo......',
        'odmmmbbbmmmmmmmbbbmmmmmo......',
        'odmmmmmmmmknkmmmmmmmmmmo......',
        'odmmmmmmmmwwwmmmmmmmmmmo......',
        '.odmmmmmmmwwmmmmmmmmmdo.......',
        '.odmmwwmmmmwwmmmwwmmmdo.......',
        '.odmwwwwwwwwwwwwwwwmmdo.......',
        '.odmwwwwwwwwwwwwwwwmmdo.......',
        '..odmwwwwwwwwwwwwwwmmdo.......',
        '..odmmmwwwwwwwwwmmmmdo........',
        '...odmmmmmmmmmmmmmmmdo........',
        '...odmmmmmmmmmmmmmmmdo........',
        '....oddddddddddddddddo........',
        '.....oooooooooooooooo..........',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
    ],
    'mushroom': [
        '................................',
        '................................',
        '................................',
        '................................',
        '.......ooooooooooo.............',
        '.....ooolldddddloo.............',
        '...oolmmmddddddmmloo...........',
        '..olmmmdddddddddmmlo..........',
        '.olmmWWdddddsdddWWmlo.........',
        '.olmWWWdddddsssssddWmlo.......',
        'olmmWWdddddddssssddmlo........',
        'olmmddddddsdddddddmmlo........',
        'olmmddddddddsddddssmlo........',
        '.ollllllllllllllllllo..........',
        '..onNNNNNNNNNNNNNNNno..........',
        '..onNNNNNNNNNNNNNNNno..........',
        '..onNbwbNNNNNNNbwbNno..........',
        '..onNbbNNNNNNNbbNNNno..........',
        '..onnNNNkkkNNNNNNnno..........',
        '..onNNNNNbbNNNNNNNno..........',
        '...onNNNNNNNNNNNNNno..........',
        '....onnnnnnnnnnnnno...........',
        '.....oLLoo..ooLLo.............',
        '....ogLo......oLgo............',
        '.....oo........oo.............',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
    ],
    'ghost': [
        '................................',
        '................................',
        '................................',
        '................................',
        '.......ooooooooo...............',
        '.....oommmmmmmmoo..............',
        '....omllllllllllmo.............',
        '...omllllllllllllmo............',
        '..omllmmllllllmllmmo..........',
        '..omllmmllllllllmllmo..........',
        '.omllmmllllllllllllmo..........',
        '.omllbbbbbmmmlbbbbbmo..........',
        '.omlmbwsbbmmlmbwsbbmo..........',
        '.omlmbbbbmmlmbbbbmlo..........',
        '.omllmmmmmmmmmmmmlo...........',
        '.omlkmmmmmbbmmmmmmo...........',
        '.ommmmmmmmbbbmmmmmo...........',
        '.ommmmmmmmbbmmmmmmmo..........',
        '.ommmmmmmmmmmmmmmmmdo.........',
        '.ommmmmmmmmmmmmmmmddo.........',
        '..ommmmmmmmmmmmmddo...........',
        '...omlommmmmmmomlo............',
        '....o..oooooo..o..............',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
    ],
    'dino': [
        '................................',
        '................................',
        '................................',
        '......ooooooooo................',
        '.....oddddddmo................',
        '....odmwslmmmo...............',
        '....ombbwslmmo...............',
        '....ombbwslmmmo..............',
        '....odmmllmmmmoddmmo..........',
        '.....odmmmmmmmddddo...........',
        '..oo.odmttmmmmmmmo...........',
        '.oddo.dmmmmmmmmmo............',
        '.odmoommmmmmmmmo.............',
        '..odmmmmmmmmmmmmo............',
        '..odmmmmmmdmmmmmo............',
        '...odmmmddddmmmmo............',
        '...odmmmddddmmmmo............',
        '....odmmmddmmmmdo............',
        '....odmmmmmmmmdmo............',
        '.....odmmmmmmmmdo............',
        '.....odmmmmmmmmdo............',
        '......odmmmmmmmdo............',
        '......odmmmdmmdo.............',
        '.....odmmdodmmmdo............',
        '....odmdo.odmdodo............',
        '....oddo...oddo.o............',
        '.....oo.....oo...............',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
    ],
    'robot': [
        '................................',
        '................................',
        '................................',
        '................................',
        '............yy.................',
        '............yy.................',
        '...........oddo................',
        '........ooomddmooo.............',
        '.....oommmmmmmmmmmmo..........',
        '....omllmmmmmmmmmlmo..........',
        '...omlldbbbbbbbbdllmo.........',
        '..omlldbddddddddbdllmo........',
        '..omldbdbbbbbbbdbdblmo........',
        '..omldbdbGGdbGGdbdblmo........',
        '..omldbdbbbbbbbdbdblmo........',
        '..ommldbdddddddddblmmo........',
        '..ommmlbdbbdbbdbblmmo.........',
        '...ommmlbbbbbbbbblmmo.........',
        '....oommmmllllmmmmoo..........',
        '.....odmmmmmmmmmmmdo..........',
        '....odmddddddddmmmmdo.........',
        '....odmdddddmmmdddmddo........',
        '....odmmdddddmmmmmmdo.........',
        '....odmmmmmmmmmmmmmdo.........',
        '.....odddddddddddddo..........',
        '....oddooodddooodddo..........',
        '....oddo..oddo..oddo..........',
        '.....oo....oo....oo...........',
        '................................',
        '................................',
        '................................',
        '................................',
    ],
    'pumpkin': [
        '................................',
        '................................',
        '................................',
        '................................',
        '............ogo................',
        '...........ognno...............',
        '...........ognno...............',
        '........oooonnnooo.............',
        '.....oommmmmmmmmmmmo..........',
        '...ommmmmmllmmmmmmmmmo........',
        '..ommmmllllmmmmmmmmmmmo.......',
        '..ommllmmmmmmmddmmmmmmdo......',
        '.ommllmmmmmmmmmddmmmmmmdo.....',
        '.ommmmmGGGmmmdddmmmGGGmmo.....',
        'ommmmmGGGGGmmmddmmGGGGGmmo....',
        'ommmmmmGGGmmmmmmmmmmmmmmmo....',
        'ommmmmmmmmmmmmmmmmmmmmmmmo....',
        'ommmmmbbbmmmmmmmmmbbbmmmmo....',
        'ommmmmbsbbmmmmmmmbsbbmmmo.....',
        'ommmmmmmmmmmmmmmmmmmmmmmdo....',
        'ommmmmbbbbbbbbbbbbbbbmmmdo....',
        'ommmmbGbGbGbGbGbGbGbmmmddo...',
        'ommmmmbbbbbbbbbbbbbbmmmddo....',
        '.ommmmmmmmmmmmmmmmmmmmddo.....',
        '..ommmmmmmmmmmmmmmmmmmddo.....',
        '...ommmmmmmmmmmmmmmmmddo......',
        '....odddddddddddddddddddo.....',
        '.....oooooooooooooooooo........',
        '................................',
        '................................',
        '................................',
        '................................',
    ],
    'penguin': [
        '................................',
        '................................',
        '................................',
        '................................',
        '.......ooooooooo...............',
        '.....oommmmmmmmoo..............',
        '....ommmmmmmmmmmo.............',
        '...ommmmmmmmmmmmo.............',
        '..ommlilllllllllmmo...........',
        '..ommlilllllllllmmo...........',
        '.ommlillbblllbblllmo..........',
        '.ommlilsbbllsbblllmo..........',
        '.ommlilllyyilllllmmo..........',
        '.ommlilllyyilllllmmo..........',
        '.omlkllllllllllllkmo..........',
        '.ommlilllllllllllmmo..........',
        'odmmillllllllllmmdo...........',
        'odmmillllllllllmmdo...........',
        'odmillllllllllllmdo...........',
        'odmmillllllllllmmo............',
        '.odmillllllllllmmdo...........',
        '.odmmillllllllmmmo............',
        '..odmmillllllmmddo............',
        '...odmmmmmmmdddo..............',
        '....odddddddddo...............',
        '.....oYYo...oYYo..............',
        '....oYYYo....oYYYo............',
        '.....ooo......ooo.............',
        '................................',
        '................................',
        '................................',
        '................................',
    ],
    'alien': [
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '..or.................ro........',
        '...or...............ro.........',
        '...odo.............odo........',
        '....odo...........odo.........',
        '.....odoooooooodo.............',
        '....odmllllllmmo.............',
        '...odmllllllllmmo.............',
        '..odmllllllllllmmo............',
        '.odmllbbbbbbbbblmmo...........',
        '.odmlbbbbbbbbbbbmmo...........',
        'odmlbbwwbbbbbbwwbbmmo.........',
        'odmlbbwsbbbbbbswbbmmo.........',
        'odmmbbbbbbbbbbbbbbmmo.........',
        'odmmmmbbbbbbbbbmmmmo..........',
        'odmmmmbbwwwwwbbmmmmo..........',
        '.odmmmmbbbbbbbmmmmmo..........',
        '.odmmmmmmmmmmmmmmmo...........',
        '..odmmmmmmmmmmmmmo............',
        '...oddo.oddo.odo..............',
        '....odo..odo..odo.............',
        '.....oo...oo...oo.............',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
    ],
    'fox': [
        '................................',
        '................................',
        '................................',
        '................................',
        'oo......................oo.....',
        'oddo....................oddo...',
        'odkdo..................odkdo...',
        'odkdo....oommoo.......odkdo...',
        '..oddommmmmmmmmmmmoddo........',
        '..odmmllmmmmmmmmllmmmdo.......',
        '.odmmllmmmmmmmmmmllmmmo.......',
        '.odmmmmmmmmmmmmmmmmmmo........',
        'odmmmbbmmmmmmmmmbbmmo.........',
        'odmmbwsbmmmmmmmbwsbmmo........',
        'odmmmbbbmmmmmmmmbbbmmo........',
        'odmmmmmmmmmwwmmmmmmmo.........',
        'odmmmmmmmwwwuwmmmmmo..........',
        '.odmmmmmwwbbwwmmmmmo..........',
        '.odmmmmmwwbbwwmmmmmmdo........',
        '.odmmmmwwwwwwwmmmmmmdo........',
        '..odmmmwwwwwwwmmmmmmdo........',
        '...odmmwwwwwwmmmmmmddo........',
        '...odmmmmmmmmmmmmmddo.........',
        '...odmmmwwwwwmmmmmmdo.........',
        '....odmmmmmmmmmmmmddo.........',
        '....odmmmmmmmmmmmmmdo.........',
        '.....odmmmmmmmmmmmmdo.........',
        '.....odmmdoodmmmdmddo.........',
        '....odmdo..odmdodddo..........',
        '....oddo...oddo.ooo...........',
        '.....oo.....oo................',
        '................................',
    ],
}

# Eye positions for blink animation [x, y, w, h]
EYE_POSITIONS = {
    'piranha': {'left': [10, 5, 3, 3], 'right': [16, 5, 3, 3]},
    'cactus': {'left': [7, 5, 3, 3], 'right': [13, 5, 3, 3]},
    'slime': {'left': [6, 9, 3, 3], 'right': [13, 9, 3, 3]},
    'cat': {'left': [6, 9, 4, 3], 'right': [14, 9, 4, 3]},
    'mushroom': {'left': [7, 17, 3, 3], 'right': [14, 17, 3, 3]},
    'ghost': {'left': [5, 8, 4, 3], 'right': [13, 8, 4, 3]},
    'dino': {'left': None, 'right': [7, 3, 3, 3]},
    'robot': {'left': [9, 10, 3, 2], 'right': [15, 10, 3, 2]},
    'pumpkin': {'left': [8, 13, 3, 3], 'right': [17, 13, 3, 3]},
    'penguin': {'left': [6, 7, 3, 3], 'right': [13, 7, 3, 3]},
    'alien': {'left': [9, 11, 3, 2], 'right': [16, 11, 3, 2]},
    'fox': {'left': [6, 9, 4, 3], 'right': [16, 9, 4, 3]},
}


def render_sprite(template, palette, scale=4):
    """Render a 32x32 sprite template to a scaled PNG image."""
    output_size = GRID * scale
    img = Image.new('RGBA', (output_size, output_size), (0, 0, 0, 0))
    
    for y, row in enumerate(template):
        for x, char in enumerate(row):
            if char == '.':
                continue
            color = palette.get(char, (0, 0, 0, 0))
            # Draw scaled pixel
            for dy in range(scale):
                for dx in range(scale):
                    img.putpixel(
                        (x * scale + dx, y * scale + dy),
                        color
                    )
    
    return img


def make_blink(template, eye_left, eye_right, bg_char='m'):
    """Create blink frame by closing eyes."""
    blink = [list(row) for row in template]
    
    # Close left eye
    if eye_left:
        x, y, w, h = eye_left
        for dy in range(h):
            for dx in range(w):
                if y + dy < len(blink) and x + dx < len(blink[y + dy]):
                    blink[y + dy][x + dx] = bg_char
        # Draw closed eye line
        mid_y = y + h // 2
        if mid_y < len(blink):
            blink[mid_y][x] = 'b'
            blink[mid_y][x + w - 1] = 'b'
    
    # Close right eye
    if eye_right:
        x, y, w, h = eye_right
        for dy in range(h):
            for dx in range(w):
                if y + dy < len(blink) and x + dx < len(blink[y + dy]):
                    blink[y + dy][x + dx] = bg_char
        # Draw closed eye line
        mid_y = y + h // 2
        if mid_y < len(blink):
            blink[mid_y][x] = 'b'
            blink[mid_y][x + w - 1] = 'b'
    
    return [''.join(row) for row in blink]


def generate_sprites(output_dir, scale=4):
    """Generate all pet sprites."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Generating {len(SPRITES)} pet sprites at {GRID}x{GRID} -> {GRID*scale}x{GRID*scale}...")
    
    for theme_name, template in SPRITES.items():
        palette = PALETTES[theme_name]
        eyes = EYE_POSITIONS[theme_name]
        
        # Generate open frame
        open_img = render_sprite(template, palette, scale)
        open_path = output_dir / f"{theme_name}_idle_open.png"
        open_img.save(open_path, 'PNG')
        print(f"  [OK] {theme_name}_idle_open.png")
        
        # Generate blink frame
        blink_template = make_blink(template, eyes['left'], eyes['right'])
        blink_img = render_sprite(blink_template, palette, scale)
        blink_path = output_dir / f"{theme_name}_idle_blink.png"
        blink_img.save(blink_path, 'PNG')
        print(f"  [OK] {theme_name}_idle_blink.png")
    
    print(f"\nAll {len(SPRITES)} sprites generated successfully!")
    print(f"Output: {output_dir}")
    
    return True


def main():
    parser = argparse.ArgumentParser(description='keepBoard Pixel Pet Sprite Generator')
    parser.add_argument('--scale', type=int, default=4, help='Scale factor (default: 4)')
    parser.add_argument('--output', type=str, default=str(DEFAULT_OUTPUT), 
                        help='Output directory')
    args = parser.parse_args()
    
    success = generate_sprites(args.output, args.scale)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
