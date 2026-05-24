# Romantasy Library

A searchable, sortable interface over the top-performing posts from the My Dark Romantasy Facebook page. Built from a 999-post Apify scrape.

## What it does

- Browse posts in a sortable spreadsheet-style table (engagement, likes, comments, shares, views, date)
- Filter by photo vs reel; search captions and image text
- Click any row to see the full post with image, caption, OCR text, and engagement breakdown
- "Rewrite for another genre" opens Claude with the post's text pre-loaded for adaptation

## How it's built

- Next.js 14 (App Router)
- Image proxy via Edge route to bypass Facebook's referrer block
- Data bundled at build time (single static page + one API route)
