import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const [postRepository, draftRepository, versionPreview, compose, preview, rootLayout] =
  await Promise.all([
    readFile(
      new URL("./database/post/post.repository.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("./database/draft/draft.repository.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL(
        "../../mobile/src/features/thread/PoemVersionPreviewScreen.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../../mobile/src/features/compose/ComposeScreen.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../../mobile/src/features/compose/ComposePreviewScreen.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(new URL("../../mobile/app/_layout.tsx", import.meta.url), "utf8")
  ]);

assert(
  /private async mapComments/.test(postRepository) &&
    /\.in\("comment_id", commentIds\)/.test(postRepository) &&
    !/rows\.map\([^)]*=>\s*this\.mapComment/.test(postRepository),
  "Post comments must load profiles and viewer engagement in batches."
);
assert(
  /private async mapDrafts/.test(draftRepository) &&
    /\.in\("draft_id", rows\.map/.test(draftRepository) &&
    !/Promise\.all\([\s\S]{0,200}\.map\([^)]*=>\s*this\.mapDraft/.test(
      draftRepository
    ),
  "Draft lists must batch collaborators and profiles."
);
assert(
  /detail\?\.allContinuations/.test(versionPreview) &&
    !/getThreadContinuationTree/.test(versionPreview) &&
    !/getContinuationDetail/.test(versionPreview),
  "Poem Version preview must build from the Thread detail without recursive requests."
);
assert(
  /createPoemDraft/.test(compose) &&
    /setQueryData\(\["compose-draft", draft\.id\], draft\)/.test(compose) &&
    /queryKey:\s*\["poem-design-catalog"\]/.test(compose),
  "Compose must prepare its Draft and design catalog before opening Layout."
);
assert(
  /queryKey:\s*\["poem-design-catalog"\][\s\S]{0,160}staleTime:\s*Infinity/.test(
    preview
  ) &&
    /\.\.\.\(layout \? \{ layout \} : \{\}\)/.test(preview) &&
    /\.\.\.\(settings \? \{ settings \} : \{\}\)/.test(preview),
  "Compose Preview must cache its catalog and merge final Draft settings updates."
);
assert(
  /staleTime:\s*30_000/.test(rootLayout) &&
    /gcTime:\s*30 \* 60_000/.test(rootLayout),
  "The mobile Query Client must retain recently loaded content."
);

process.stdout.write(
  "Performance structure check passed: Version, Post comments, Drafts, Compose preparation, publish preparation, and query caching avoid known loading bottlenecks.\n"
);
