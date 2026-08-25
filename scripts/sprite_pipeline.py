#!/usr/bin/env python3
"""
keepBoard Sprite Pipeline
Integrates sprite generation with pixel-asset-master post-processing.

Usage:
    python scripts/sprite_pipeline.py [--skip-generate] [--skip-finalize]
"""
import argparse
import os
import sys
import subprocess
from pathlib import Path

# Get project root
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
PIXEL_ASSET_DIR = PROJECT_ROOT / "pixel-asset-master-skills-v1.0" / "skills" / "pixel-asset-master"
SPRITE_OUTPUT = PROJECT_ROOT / "src" / "assets" / "pets" / "hd"

# Create a temporary project structure for finalize_assets.py
TEMP_PROJECT = PROJECT_ROOT / "temp_sprite_project"


def create_project_structure():
    """Create temp project structure for pixel-asset-master."""
    # Create directories
    (TEMP_PROJECT / "assets" / "characters").mkdir(parents=True, exist_ok=True)
    (TEMP_PROJECT / "notes").mkdir(parents=True, exist_ok=True)
    
    # Create spec_lock.md with palette
    spec_lock_content = """# Spec Lock - keepBoard Pet Sprites

## Canvas
- Width: 128
- Height: 128
- Format: RGBA PNG

## Palette
- #6E1B10
- #C23B22
- #E85D3A
- #FF8C42
- #FFC24D
- #FFFFFF
- #181828
- #FFF6D8
- #F08A8A
- #2D5A27
- #4A8F3C
- #A8E063
- #5C3A1A
- #8B5A2B
- #B07842
- #173A17
- #2D7A2D
- #3FA33F
- #66CC55
- #9BE87A
- #FFD93D
- #1F5F8B
- #2E86AB
- #54B9DF
- #8AD8EF
- #EAFBFF
- #33304A
- #554F70
- #857DA6
- #A79FC4
- #DCD6F0
- #E89BB0
- #7A1515
- #C9AE72
- #F2DFB6
- #7BC95A
- #49537A
- #8891B0
- #C6CCE4
- #EAEEFA
- #232743
- #1E4D1E
- #3F8929
- #6ABE30
- #8FD94C
- #C6F273
- #222A38
- #4A5568
- #8A97AD
- #C3CEDF
- #EFF4FB
- #7BF77B
- #FF4E50
- #0E1118
- #7A3A10
- #C05A1D
- #F28425
- #FFA64D
- #FFD08A
- #141420
- #FFE08A
- #7BC95A
- #10141C
- #20283A
- #39445C
- #F4F7FF
- #FFB347
- #E8912D
- #123B12
- #2E7D32
- #57C84D
- #8FE08A
- #C8FFC4
- #FF4E50
- #5C2A0D
- #B85C1E
- #E8823A
- #FFA85C
- #FFDCA8

## Style
- Type: Pixel Art
- Scale: 4x (32x32 -> 128x128)
- Border: None
- Anti-aliasing: Disabled
"""
    (TEMP_PROJECT / "spec_lock.md").write_text(spec_lock_content, encoding='utf-8')


def copy_sprites_to_project():
    """Copy generated sprites to temp project structure."""
    import shutil
    
    assets_dir = TEMP_PROJECT / "assets" / "characters"
    # Clear existing
    for f in assets_dir.glob("*.png"):
        f.unlink()
    
    # Copy new sprites
    for png in SPRITE_OUTPUT.glob("*.png"):
        shutil.copy2(png, assets_dir / png.name)
    
    print(f"Copied {len(list(assets_dir.glob('*.png')))} sprites to temp project")


def run_finalize():
    """Run pixel-asset-master finalize_assets.py."""
    finalize_script = PIXEL_ASSET_DIR / "scripts" / "finalize_assets.py"
    
    if not finalize_script.exists():
        print(f"[WARN] finalize_assets.py not found at {finalize_script}")
        return False
    
    print("\nRunning pixel-asset-master post-processing...")
    
    # Run clean (remove stray pixels)
    result = subprocess.run(
        [sys.executable, str(finalize_script), str(TEMP_PROJECT), "--clean"],
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        print(result.stdout)
    else:
        print(f"[WARN] Clean failed: {result.stderr}")
    
    return True


def copy_back_sprites():
    """Copy processed sprites back to output directory."""
    import shutil
    
    assets_dir = TEMP_PROJECT / "assets" / "characters"
    
    # Clear original output
    for f in SPRITE_OUTPUT.glob("*.png"):
        f.unlink()
    
    # Copy back
    for png in assets_dir.glob("*.png"):
        shutil.copy2(png, SPRITE_OUTPUT / png.name)
    
    print(f"\nCopied {len(list(SPRITE_OUTPUT.glob('*.png')))} processed sprites back to {SPRITE_OUTPUT}")


def cleanup():
    """Remove temp project directory."""
    import shutil
    if TEMP_PROJECT.exists():
        shutil.rmtree(TEMP_PROJECT)
        print("Cleaned up temp project directory")


def main():
    parser = argparse.ArgumentParser(description='keepBoard Sprite Pipeline')
    parser.add_argument('--skip-generate', action='store_true', help='Skip sprite generation')
    parser.add_argument('--skip-finalize', action='store_true', help='Skip post-processing')
    args = parser.parse_args()
    
    try:
        # Step 1: Generate sprites (using Node.js script or Python)
        if not args.skip_generate:
            print("=" * 60)
            print("Step 1: Generating sprites...")
            print("=" * 60)
            
            # Try Python generator first
            python_gen = SCRIPT_DIR / "generate_sprites.py"
            if python_gen.exists():
                result = subprocess.run(
                    [sys.executable, str(python_gen)],
                    cwd=str(PROJECT_ROOT),
                    capture_output=True,
                    text=True
                )
                print(result.stdout)
                if result.returncode != 0:
                    print(f"[ERROR] Python generation failed: {result.stderr}")
                    return 1
            else:
                # Fallback to Node.js
                result = subprocess.run(
                    ["node", "scripts/generate-sprites.mjs"],
                    cwd=str(PROJECT_ROOT),
                    capture_output=True,
                    text=True
                )
                print(result.stdout)
                if result.returncode != 0:
                    print(f"[ERROR] Node.js generation failed: {result.stderr}")
                    return 1
        
        # Step 2: Post-processing with pixel-asset-master
        if not args.skip_finalize:
            print("\n" + "=" * 60)
            print("Step 2: Post-processing with pixel-asset-master...")
            print("=" * 60)
            
            create_project_structure()
            copy_sprites_to_project()
            run_finalize()
            copy_back_sprites()
        
        print("\n" + "=" * 60)
        print("Pipeline completed successfully!")
        print("=" * 60)
        
        return 0
        
    finally:
        cleanup()


if __name__ == '__main__':
    sys.exit(main())
