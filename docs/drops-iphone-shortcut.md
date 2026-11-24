# Posting drops from an iPhone

Every X post can show up on the site as a **drop** (decision D25). From the X app it
takes two taps: **Share → Drop to Grails**. You don't need to sort anything; the site
works out whether it's a video or a meme.

## How it works

1. The Shortcut saves a tiny file to the website's GitHub repo:
   `src/content/drops/<post id>.json` with the post's link and the time.
2. A GitHub Action ("Sync drops") copies the post's caption, author and media links into
   that file. It uses the same public data X's own embed uses: no X API key, no cost.
3. The site draws the post in its own retro style: photos open in the image viewer,
   videos play right on the page, and **View on X** is the only thing that leaves the
   site.
4. If the copy fails (deleted post, X changes something), the site shows X's official
   embed for that post instead. The Action retries every six hours.

New drops go live whenever the site is next built and deployed. Deploying is still on
hold (D22).

## One-time setup

### 1. Make a GitHub token (on the account that owns the repo)

Fine-grained tokens can only reach repos owned by the account that makes them, so this
has to be done signed in as **actuallykatsu**.

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained
   tokens** → Generate new token.
2. Name: `Drop to Grails`. Expiration: 1 year (set a reminder to renew it).
3. Repository access: **Only select repositories** → `internet-grails`.
4. Permissions → Repository permissions → **Contents: Read and write**. Nothing else.
5. Generate, and copy the token. It's only shown once.

This token can change files in that one repo and nothing else. If the phone is lost,
delete the token on GitHub and make a new one.

### 2. Build the Shortcut

In the Shortcuts app, tap **+** and name it `Drop to Grails`. Tap the **ⓘ** button and
turn on **Show in Share Sheet**. Then add these actions in order:

| #   | Action                    | Set it up like this                                                                                                                                                                                                                                         |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Receive** (top of list) | Receive **URLs** and **Text** from **Share Sheet**. If there's no input: **Stop and Respond**.                                                                                                                                                             |
| 2   | **Match Text**            | Pattern `status/(\d+)` in **Shortcut Input**.                                                                                                                                                                                                              |
| 3   | **Get Group from Matches** | Group at index **1** in **Matches**.                                                                                                                                                                                                                      |
| 4   | **Set Variable**          | Name `PostID`, value **Text from Group**.                                                                                                                                                                                                                  |
| 5   | **Date**                  | **Current Date**.                                                                                                                                                                                                                                          |
| 6   | **Format Date**           | **ISO 8601**, include time.                                                                                                                                                                                                                                |
| 7   | **Text**                  | `{"url":"https://x.com/i/status/PostID","addedAt":"Formatted Date"}` (tap to insert the `PostID` and `Formatted Date` variables where the names are).                                                                                                      |
| 8   | **Base64 Encode**         | Encode **Text**. Tap **Show More** and set **Line Breaks** to **None**.                                                                                                                                                                                    |
| 9   | **Get Contents of URL**   | URL `https://api.github.com/repos/actuallykatsu/internet-grails/contents/src/content/drops/PostID.json`. Method **PUT**. Headers: `Authorization` = `Bearer <your token>`, `Accept` = `application/vnd.github+json`. Request Body **JSON**: `message` (Text) = `Add drop PostID`, `content` (Text) = **Base64 Encoded**. |
| 10  | **Show Notification**     | `Dropped to Internet Grails`.                                                                                                                                                                                                                              |

### 3. Try it

In the X app, open one of your posts → **Share** → **Share via…** → **Drop to Grails**.
Within a minute or two the repo's **Actions** tab shows a green "Sync drops" run, and the
file in `src/content/drops/` has the post's caption and media.

## Good to know

- **Sharing the same post twice** does nothing: GitHub refuses to overwrite the file
  (the Shortcut shows an error from GitHub; that's fine).
- **Removing a drop:** delete its file in `src/content/drops/` on github.com (or ask
  whoever runs the site). To hide it without deleting, add `"draft": true` to the file.
- **Wrong section?** Add `"kind": "video"` or `"kind": "meme"` to the file to override.
- **Always use X's embed for a post:** add `"embedOnly": true`.
- **Days** roll over at midnight New York time; change `DROPS_TIMEZONE` in
  `src/lib/drop.ts` to move that.
- Fixing up a drop by hand on a computer: `npm run drops:sync` fills in any drops that
  are missing their copy; `npm run drops:sync -- --force` refreshes all of them.
