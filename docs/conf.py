# The MITI manual, built with Sphinx for Read the Docs (.readthedocs.yaml). Build it locally:
#   python3 -m venv .venv-docs && .venv-docs/bin/pip install -r docs/requirements.txt
#   .venv-docs/bin/sphinx-build -W docs docs/_build/html
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent

# Screenshots come from the docs-images branch (docs/fetch-images.sh).
if not any((root / 'docs' / 'images').glob('*.webp')):
    subprocess.run(['bash', str(root / 'docs' / 'fetch-images.sh')], check=True)

project = 'MITI'
author = 'MITI Contributors'
copyright = '2026, MITI Contributors'
release = json.loads((root / 'package.json').read_text())['version']
version = release

extensions = ['myst_parser', 'sphinx_copybutton']
root_doc = 'index'
include_patterns = ['index.md', '*/*.md']
exclude_patterns = ['_build', 'images']

myst_enable_extensions = ['colon_fence', 'deflist']
myst_heading_anchors = 3

# Laid out like the MoveIt documentation: Read the Docs theme, dark sidebar, MITI's teal accent.
html_theme = 'sphinx_rtd_theme'
html_title = f'MITI {release} documentation'
html_short_title = 'MITI'
html_logo = '../public/main_logo.svg'
html_favicon = '../public/robot_logo.svg'
html_static_path = ['_static']
templates_path = ['_templates']
html_css_files = ['miti.css']
html_show_sourcelink = False
html_theme_options = {
    'logo_only': True,
    'navigation_depth': 3,
    'collapse_navigation': False,
    'prev_next_buttons_location': 'bottom',
    'style_nav_header_background': '#191a1c',
}
copybutton_prompt_text = r'^\$ '
copybutton_prompt_is_regexp = True
