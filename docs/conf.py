# The MITI manual, built with Sphinx for Read the Docs (.readthedocs.yaml). Build it locally:
#   python3 -m venv .venv-docs && .venv-docs/bin/pip install -r docs/requirements.txt
#   .venv-docs/bin/sphinx-build -W docs docs/_build/html
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent

# Screenshots come from the docs-images branch (docs/fetch-images.sh).
if not any((root / 'docs' / 'manual' / 'images').glob('*.webp')):
    subprocess.run(['bash', str(root / 'docs' / 'fetch-images.sh')], check=True)

project = 'MITI'
author = 'MITI Contributors'
copyright = '2026, MITI Contributors'
release = json.loads((root / 'package.json').read_text())['version']
version = release

extensions = ['myst_parser', 'sphinx_copybutton']
root_doc = 'index'
include_patterns = ['index.md', 'manual/*.md', 'reference/*.md', 'develop/*.md']
exclude_patterns = ['_build']

myst_enable_extensions = ['colon_fence', 'deflist']
myst_heading_anchors = 3

html_theme = 'furo'
html_title = f'MITI {release}'
html_logo = '../public/main_logo.svg'
html_favicon = '../public/robot_logo.svg'
html_theme_options = {
    'sidebar_hide_name': True,
    'source_repository': 'https://github.com/hiran-t/MITI/',
    'source_branch': 'main',
    'source_directory': 'docs/',
    'light_css_variables': {
        'color-brand-primary': '#13606b',
        'color-brand-content': '#13606b',
    },
    'dark_css_variables': {
        'color-brand-primary': '#2fb4c4',
        'color-brand-content': '#4cc4d2',
    },
}
copybutton_prompt_text = r'^\$ '
copybutton_prompt_is_regexp = True
