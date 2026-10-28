<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep source names and public shortcut mappings in the shared source catalog so search, navigation, and credits agree.
- Fetch alternate providers through server-only adapters with allowlisted source IDs; never mix another provider's events into a source-specific homepage or accept arbitrary upstream URLs.
- Parse external listing HTML with cheerio/slim and return plain event data, never render upstream HTML or scripts in LiveCast.
