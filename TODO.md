# TODOs

features
[ ] avatar / public space picture
[ ] moderation for user input content and just content in general i feel? fuck how do i tackle this
[ ] custom user notes for saves
[ ] collection auto-visibility: default public/private setting for saves added to a collection
[ ] hidden collections: hide collections from main list/search (for sensitive content), with a toggle in settings to reveal
[ ] figure out app icon (need to basically create new images zzz https://stackoverflow.com/a/76992849
[ ] bulk operations for collections

## Platform Integrations (Domain-Specific Extractors)

These platforms don't work well with Mozilla Readability and need custom parsing.
Pattern: `lib/snapshots/domains/<platform>.ts` → register in `lib/snapshots/domains/index.ts`

### Social Media / Microblogging
- [~] Twitter/X - WIP, uses oEmbed + FxTwitter fallback
- [ ] Threads (threads.net) - no public API, may need scraping
- [ ] Bluesky (bsky.app) - has public API (AT Protocol)
- [ ] Mastodon - has oEmbed support, federated instances
- [ ] LinkedIn posts - requires auth, probably limited

### Video Platforms
- [ ] YouTube - has oEmbed, can extract title/description/thumbnail; consider transcript via captions API
- [ ] Vimeo - has oEmbed support
- [ ] TikTok - has oEmbed; may need oembed.tiktok.com or nitter-style proxies
- [ ] Twitch clips - has oEmbed for clips
- [ ] Dailymotion - has oEmbed

### Discussion / Forums
- [ ] Reddit - no oEmbed; consider old.reddit.com or teddit/libreddit for scraping
- [ ] Hacker News - simple HTML structure, easy to parse
- [ ] Stack Overflow - has structured data, relatively easy
- [ ] Discourse forums - varies by instance

### Image Sharing
- [ ] Instagram - no public API anymore, very locked down; consider bibliogram proxies
- [ ] Pinterest - has oEmbed (limited)
- [ ] Imgur - has API
- [ ] Flickr - has oEmbed

### Code / Developer Platforms
- [ ] GitHub - repos, gists, issues, PRs; has API; consider rendering README previews
- [ ] GitLab - similar to GitHub
- [ ] CodePen - has oEmbed
- [ ] JSFiddle - has oEmbed
- [ ] Gist (gist.github.com) - has oEmbed

### Long-form / Newsletters
- [ ] Substack - generally works with Readability but may need paywall handling
- [ ] Medium - paywall bypass needed; consider scribe.rip or freedium proxies
- [ ] Notion public pages - dynamic rendering, may need special handling
- [ ] Google Docs (published) - export as HTML?

### Audio / Podcasts
- [ ] Spotify - has oEmbed for tracks/episodes/playlists
- [ ] SoundCloud - has oEmbed
- [ ] Apple Podcasts - no oEmbed, would need scraping

### Other
- [ ] Google Maps - has embed URLs, extract place info
- [ ] Amazon products - scrape product details, images
- [ ] Goodreads - book info extraction
- [ ] Wikipedia - already works well, but could enhance with infobox extraction

### Priority Order (suggested)
1. YouTube (very common, has oEmbed)
2. Reddit (very common, needs custom parsing)
3. GitHub (common for devs, has API)
4. Instagram (common but difficult)
5. TikTok (growing, has oEmbed)
