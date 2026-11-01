# Brand MITI

A company that delivers MITI to its customers can show its own name, logo, browser icon and accent color instead of MITI's, without rebuilding MITI.

## Make a branding folder

Put `branding.json` and the image files in one folder:

```
branding/
├── branding.json
├── logo.svg
└── icon.svg
```

```json
{
  "name": "Acme Robotics",
  "title": "Acme Robot Console",
  "logo": "logo.svg",
  "icon": "icon.svg",
  "accent": "#e30613"
}
```

name
: The logo's text alternative. Default `MITI`.

title
: The browser tab's title. Default the name.

logo
: The logo at the left of the title bar, an `.svg`, `.png` or `.webp` file in the folder. It is fitted into 106 × 42 pixels; a wide SVG looks best.

icon
: The browser tab's icon, an `.svg`, `.png` or `.ico` file in the folder.

accent
: The color of selections, focus and highlights, as `#rrggbb`. MITI derives its lighter and darker shades.

Every field is optional; what is missing stays MITI's. A field that cannot be used, such as a file that does not exist, is left out and reported once in MITI's log.

## Point MITI at it

Set `MITI_BRANDING_DIR` to the folder where MITI runs:

| MITI runs with  | Set it in                                                                          |
| --------------- | ---------------------------------------------------------------------------------- |
| The apt package | `/etc/miti/miti.env`, e.g. `MITI_BRANDING_DIR=/etc/miti/branding`                  |
| Docker          | `environment:` in `docker-compose.yml`, with the folder mounted into the container |
| pixi            | The shell, before `pixi run miti`                                                  |

Restart MITI after setting the variable. Later changes to the folder's files show on the next reload of the page.
