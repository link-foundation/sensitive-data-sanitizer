# Auditing and remediating Git history

Deleting a file in the current checkout does not remove its older blobs. The sanitizer's `history` command reads all local refs and reflog-reachable objects, scanning blobs, commit authors/messages and annotated tag metadata. It emits object IDs and safe findings only, and never changes refs or pushes.

```sh
sensitive-data-sanitizer history /path/to/audit-clone --config /private/policy.json
```

Exit 1 means findings; exit 2 means incomplete analysis or failure. Trees are traversed by Git but their filename bytes are not sanitized. Binary/non-UTF-8 objects are skipped with `complete: false`. Input/object/count limits prevent treating a partial audit as success. Unreachable objects without refs/reflogs, un-fetched branches, Git LFS storage, PR refs not fetched locally, submodules, release artifacts and remote mirrors are outside that local scope. A local report cannot certify erasure on GitHub.

## Reviewed rewrite procedure

1. Revoke/rotate exposed credentials immediately. Removing their text does not undo exposure.
2. Inventory affected branches, tags, PR refs, authors/messages, filenames and external artifacts. Keep a separate offline restricted backup of the original mirror and the private value list. Do not refresh the only backup after a rewrite.
3. Create a fresh disposable clone for rewriting with the maintained [git-filter-repo](https://github.com/newren/git-filter-repo) tool. Record its version and follow its fresh-clone safety requirements. Install it separately; this package does not install or invoke a rewrite automatically.
4. Create mode-0600 replacement and optional mailmap files outside the repository, using the tool's documented literal syntax. Include known date/phone/name spellings and case/transliteration variants that require removal. Values containing delimiters or newlines require appropriately reviewed callback logic; do not interpolate them into shell commands.
5. Run the following only in the disposable clone, with reviewed private inputs. Text replacements handle blobs; message replacements and a mailmap address different kinds of metadata. Path filtering requires separate decisions.

   ```sh
   git filter-repo --sensitive-data-removal --replace-text /private/replacements.txt \
     --replace-message /private/replacements.txt --mailmap /private/mailmap
   ```

6. Audit complete rewritten commit snapshots, messages and tags with the sanitizer and independent scanners. Inspect selected revisions, run the repository's tests, and check that intended public values and structure survive. A scan of only added diff lines cannot prove historical removal.
7. Compare refs and commit mappings against the immutable backup. Remove retained original refs from the _disposable cleaned clone_ according to git-filter-repo documentation; keep the backup private. Re-audit the cleaned clone, including reflogs. Partial rewrites that retain old refs can still expose old objects.
8. Have the repository owner review the actual rewritten refs, then coordinate publication and collaborator recloning. GitHub branch protections, PR references, caches, forks, Actions artifacts and other clones may require separate cleanup. Follow [GitHub's sensitive-data removal guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository), including Support assistance where applicable. Do not issue an unreviewed blanket force push.

The automated regression creates a repository with a credential-bearing file, commits its deletion, and confirms the audit still finds the old blob and author email while leaving refs unchanged. It tests local discovery, not destructive rewriting or remote erasure.
