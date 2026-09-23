# Fix playback and add multiview

## Changes
- Verify the actual iframe markup and remove any remaining sandbox restriction from the player path.
- Add a Multiview page that accepts up to four selected live events and shows them in a responsive 1–4 player grid.
- Add selection controls on the home page, including a four-event limit and a clear path into Multiview.
- Keep each tile tied to its selected event, use the best available stream first, and provide per-tile source switching.

## Validation
- Check desktop and mobile layouts in the running preview.
- Confirm rendered player iframes have no sandbox attribute.
- Confirm one, two, three, and four selected streams render without overlap and retain correct titles.
